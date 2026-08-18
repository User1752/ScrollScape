#!/usr/bin/env python3
"""ScrollScape terminal monitoring dashboard.

Polls a running ScrollScape server over its existing REST API and renders
source health, a library snapshot, and active bulk downloads as a live
terminal UI. Does not touch ScrollScape's own store or process — it's a
read-only client, safe to run alongside the normal web UI.

Usage:
    python dashboard.py --url http://localhost:4000 [--password ...] [--interval 8]

Environment variables (used when the matching flag is omitted):
    SCROLLSCAPE_URL       default: http://localhost:4000
    SCROLLSCAPE_PASSWORD  only needed if the instance has a password set
"""

import argparse
import os

import httpx
from textual.app import App, ComposeResult
from textual.containers import Horizontal, Vertical
from textual.widgets import DataTable, Footer, Header, ProgressBar, Static

STATUS_COLOR = {"pass": "green", "warning": "yellow", "fail": "red"}


def _color(status: str) -> str:
    return STATUS_COLOR.get(status, "white")


def _fmt_bytes_per_sec(n: float) -> str:
    n = max(0.0, n)
    if n < 1024:
        return f"{n:.0f} B/s"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB/s"
    return f"{n / (1024 * 1024):.1f} MB/s"


def _fmt_bytes(n: float) -> str:
    n = max(0.0, n)
    for unit, size in (("GB", 1024**3), ("MB", 1024**2), ("KB", 1024)):
        if n >= size:
            return f"{n / size:.0f} {unit}"
    return f"{n:.0f} B"


class ScrollScapeDashboard(App):
    CSS = """
    Screen {
        layout: horizontal;
    }
    #left-col, #right-col {
        width: 1fr;
        padding: 1 2;
    }
    .panel-title {
        text-style: bold;
        color: $accent;
        margin-top: 1;
    }
    #health-panel, #library-panel {
        border: round $primary;
        padding: 1;
        margin-bottom: 1;
        height: auto;
    }
    #jobs-table {
        height: 1fr;
        border: round $primary;
    }
    #resource-panel {
        border: round $primary;
        padding: 1;
        margin-bottom: 1;
        height: auto;
    }
    #resource-panel ProgressBar {
        width: 100%;
        margin-bottom: 1;
    }
    """

    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh_now", "Refresh now"),
    ]

    def __init__(self, base_url: str, password: str | None, interval: float):
        super().__init__()
        self.base_url = base_url.rstrip("/")
        self.password = password
        self.interval = interval
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=10.0)

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal():
            with Vertical(id="left-col"):
                yield Static("Server & Sources", classes="panel-title")
                yield Static("Connecting…", id="health-panel")
                yield Static("Library Snapshot", classes="panel-title")
                yield Static("Connecting…", id="library-panel")
            with Vertical(id="right-col"):
                yield Static("Resource Usage", classes="panel-title")
                with Vertical(id="resource-panel"):
                    yield Static("CPU", id="cpu-label")
                    yield ProgressBar(total=100, id="cpu-bar", show_eta=False)
                    yield Static("RAM", id="ram-label")
                    yield ProgressBar(total=100, id="ram-bar", show_eta=False)
                    yield Static("Connecting…", id="network-panel")
                yield Static("Active Downloads", classes="panel-title")
                yield DataTable(id="jobs-table")
        yield Footer()

    async def on_mount(self) -> None:
        self.title = "ScrollScape"
        self.sub_title = self.base_url
        table = self.query_one("#jobs-table", DataTable)
        table.add_columns("Manga", "Progress", "Status")
        table.cursor_type = "row"
        await self._ensure_login()
        self.set_interval(self.interval, self.refresh_all)
        await self.refresh_all()

    async def action_refresh_now(self) -> None:
        await self.refresh_all()

    async def _ensure_login(self) -> None:
        try:
            status = (await self.client.get("/api/auth/status")).json()
        except httpx.HTTPError as e:
            self._show_connection_error(e)
            return

        if status.get("passwordSet") and not status.get("authenticated"):
            if not self.password:
                self.query_one("#health-panel", Static).update(
                    "[red]This instance has a password set.[/red]\n"
                    "Restart with --password or SCROLLSCAPE_PASSWORD."
                )
                return
            try:
                await self.client.post("/api/auth/login", json={"password": self.password})
            except httpx.HTTPError as e:
                self._show_connection_error(e)

    def _show_connection_error(self, e: Exception) -> None:
        msg = f"[red]Could not reach {self.base_url}[/red]\n{e}"
        self.query_one("#health-panel", Static).update(msg)
        self.query_one("#library-panel", Static).update("-")
        self.query_one("#network-panel", Static).update("-")

    async def refresh_all(self) -> None:
        await self._refresh_health()
        await self._refresh_library()
        await self._refresh_jobs()
        await self._refresh_resources()

    async def _refresh_resources(self) -> None:
        cpu_bar = self.query_one("#cpu-bar", ProgressBar)
        ram_bar = self.query_one("#ram-bar", ProgressBar)
        cpu_label = self.query_one("#cpu-label", Static)
        ram_label = self.query_one("#ram-label", Static)
        net_panel = self.query_one("#network-panel", Static)

        try:
            data = (await self.client.get("/api/system/resources")).json()
        except httpx.HTTPError:
            cpu_label.update("CPU  [red]unreachable[/red]")
            ram_label.update("RAM")
            net_panel.update("—")
            return

        cpu = data.get("cpu") or {}
        mem = data.get("memory") or {}
        net = data.get("network") or {}

        cpu_percent = min(100.0, max(0.0, float(cpu.get("percent", 0))))
        cpu_bar.update(progress=cpu_percent)
        cpu_label.update(f"CPU  {cpu_percent:.1f}%  ({cpu.get('cores', '?')} cores)")

        rss = mem.get("rssBytes", 0)
        sys_total = mem.get("systemTotalBytes", 0) or 1
        ram_percent = min(100.0, (rss / sys_total) * 100)
        ram_bar.update(progress=ram_percent)
        ram_label.update(f"RAM  {_fmt_bytes(rss)} / {_fmt_bytes(sys_total)}  ({ram_percent:.1f}%)")

        net_panel.update(
            f"Net In:   {_fmt_bytes_per_sec(net.get('bytesInPerSec', 0))}\n"
            f"Net Out:  {_fmt_bytes_per_sec(net.get('bytesOutPerSec', 0))}\n"
            f"Requests: {net.get('requestsPerSec', 0)}/s\n"
            f"Uptime:   {data.get('uptimeSec', 0) // 60}m"
        )

    async def _refresh_health(self) -> None:
        panel = self.query_one("#health-panel", Static)
        try:
            data = (await self.client.get("/api/system/health")).json()
        except httpx.HTTPError as e:
            self._show_connection_error(e)
            return

        overall = data.get("overallStatus", "?")
        sources = data.get("sources", {})
        db = data.get("database", {})

        summary = sources.get("summary") or {}
        if isinstance(summary, dict):
            summary_text = (
                f"{summary.get('passing', 0)}/{summary.get('total', 0)} passing"
            )
            if summary.get("degraded"):
                summary_text += f", {summary['degraded']} degraded"
            if summary.get("failing"):
                summary_text += f", {summary['failing']} failing"
        else:
            summary_text = str(summary)

        lines = [
            f"App:      [{_color(overall)}]{overall.upper()}[/]",
            f"Store:    [{_color(db.get('status', ''))}]{db.get('status', '?')}[/]  ({db.get('engine', '')})",
            f"Sources:  [{_color(sources.get('status', ''))}]{sources.get('status', '?')}[/]  {summary_text}",
        ]

        errors = (sources.get("recentErrors") or [])[:5]
        if errors:
            lines.append("")
            lines.append("[red]Recent source errors:[/red]")
            for err in errors:
                text = err if isinstance(err, str) else err.get("message", str(err))
                lines.append(f"  - {text}")

        warnings = data.get("warnings") or []
        if warnings:
            lines.append("")
            lines.append("[yellow]Warnings:[/yellow]")
            for w in warnings[:5]:
                lines.append(f"  - {w}")

        panel.update("\n".join(lines))

    async def _refresh_library(self) -> None:
        panel = self.query_one("#library-panel", Static)
        try:
            lib = (await self.client.get("/api/library")).json()
            user_status = (await self.client.get("/api/user/status")).json()
        except httpx.HTTPError as e:
            self._show_connection_error(e)
            return

        favorites = lib.get("favorites", [])
        reading_status = user_status.get("readingStatus", {})
        counts: dict[str, int] = {}
        for entry in reading_status.values():
            st = entry.get("status", "unknown")
            counts[st] = counts.get(st, 0) + 1

        lines = [f"Favorites: {len(favorites)}"]
        for st in ("reading", "completed", "on_hold", "dropped", "plan_to_read"):
            if counts.get(st):
                lines.append(f"  {st}: {counts[st]}")

        # AniList entries that were imported but never got linked to a real,
        # readable source — see docs/manual/06-integracao-anilist.md for why
        # this can legitimately stay above 0 (some titles just aren't in any
        # installed source) vs. when it's worth re-running the AniList import.
        unresolved = sum(1 for m in favorites if m.get("sourceId") == "anilist")
        if unresolved:
            lines.append(f"[yellow]AniList placeholders unresolved: {unresolved}[/yellow]")

        try:
            sync = (await self.client.get("/api/anilist/sync-meta")).json()
        except httpx.HTTPError:
            sync = None

        if sync and sync.get("lastImportAt"):
            lines.append("")
            lines.append(f"Last AniList sync: {sync['lastImportAt']}")
            lines.append(
                f"  +{sync.get('importedCount', 0)} new, "
                f"{sync.get('overwriteCount', 0)} updated, "
                f"{sync.get('failedCount', 0)} failed"
            )

        panel.update("\n".join(lines))

    async def _refresh_jobs(self) -> None:
        table = self.query_one("#jobs-table", DataTable)
        table.clear()
        try:
            jobs = (await self.client.get("/api/download/bulk/jobs")).json().get("jobs", [])
        except httpx.HTTPError:
            table.add_row("-", "-", "[red]unreachable[/red]")
            return

        if not jobs:
            table.add_row("-", "-", "no active downloads")
            return

        for job in jobs:
            title = job.get("mangaTitle") or job["jobId"][:8]
            progress = f"{job.get('done', 0)}/{job.get('total', 0)}"
            status = job.get("status", "")
            style = {"done": "green", "error": "red", "running": "yellow"}.get(status, "white")
            table.add_row(title, progress, f"[{style}]{status}[/]")

    async def on_unmount(self) -> None:
        await self.client.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description="ScrollScape terminal monitoring dashboard")
    parser.add_argument("--url", default=os.environ.get("SCROLLSCAPE_URL", "http://localhost:4000"))
    parser.add_argument("--password", default=os.environ.get("SCROLLSCAPE_PASSWORD"))
    parser.add_argument("--interval", type=float, default=8.0, help="Refresh interval in seconds")
    args = parser.parse_args()

    app = ScrollScapeDashboard(base_url=args.url, password=args.password, interval=args.interval)
    app.run()


if __name__ == "__main__":
    main()
