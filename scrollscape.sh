#!/usr/bin/env bash
# =============================================================================
# scrollscape.sh — ScrollScape Docker launcher for Linux & macOS
# Usage: chmod +x scrollscape.sh && ./scrollscape.sh
# =============================================================================

set -Eeuo pipefail

R='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
PUR='\033[35m'
BPUR='\033[95m'
CYN='\033[36m'
BCYN='\033[96m'
GRN='\033[32m'
BGRN='\033[92m'
RED='\033[31m'
BRED='\033[91m'
WHT='\033[97m'
GRY='\033[90m'
YLW='\033[33m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3000
CONTAINER_STARTED=0
COMPOSE_CMD=()

trap cleanup EXIT INT TERM

banner() {
  clear
  echo
  echo -e "  ${GRY}+=======================================================+${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}    ${BOLD}${BPUR}_____  _____${R}                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}/ ____|/ ____|${R}      ${BOLD}ScrollScape${R}                     ${GRY}|${R}"
  echo -e "  ${GRY}|${R}  ${BOLD}${PUR}| (___ | (___${R}        ${DIM}Linux / macOS Launcher${R}         ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${BOLD}${PUR}\\___ \\ \\___ \\${R}                                     ${GRY}|${R}"
  echo -e "  ${GRY}|${R}   ${DIM}${PUR}____) |____) |${R}      ${DIM}Docker-powered startup${R}        ${GRY}|${R}"
  echo -e "  ${GRY}|${R}  ${DIM}${PUR}|_____/|_____/${R}       ${DIM}Same R / Q menu as Windows${R}     ${GRY}|${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}+=======================================================+${R}"
  echo
}

status_box() {
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo -e "  ${GRY}|${R}    ${BGRN}[ OK ]${R}  ${BOLD}Ready to launch ScrollScape${R}                ${GRY}|${R}"
  echo -e "  ${GRY}|${R}                                                       ${GRY}|${R}"
  echo -e "  ${GRY}|${R}       ${BOLD}${WHT}http://localhost:${PORT}${R}                           ${GRY}|${R}"
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo
}

err() {
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo -e "  ${GRY}|${R}    ${BRED}[ ERR ]${R}  ${BOLD}$1${R}"
  if [ -n "${2:-}" ]; then
    echo -e "  ${GRY}|${R}    ${DIM}$2${R}"
  fi
  echo -e "  ${GRY}+-------------------------------------------------------+${R}"
  echo
}

info_line() {
  echo -e "  ${CYN}[ .. ]${R}  $1"
}

ok_line() {
  echo -e "  ${BGRN}[ OK ]${R}  $1"
}

warn_line() {
  echo -e "  ${YLW}[ ! ]${R}  $1"
}

detect_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi

  err "Docker Compose not found." "Install Docker Compose v2 or the docker-compose legacy binary."
  exit 1
}

open_browser() {
  local url="http://localhost:${PORT}"
  case "$(uname -s)" in
    Darwin)
      open "$url" >/dev/null 2>&1 || true
      ;;
    Linux)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
      elif command -v sensible-browser >/dev/null 2>&1; then
        sensible-browser "$url" >/dev/null 2>&1 &
      fi
      ;;
  esac
}

wait_for_docker() {
  local tries=0
  while ! docker info >/dev/null 2>&1; do
    if (( tries >= 60 )); then
      err "Docker daemon did not start in time." "Start Docker manually and re-run scrollscape.sh."
      exit 1
    fi
    sleep 1
    ((tries+=1))
  done
}

ensure_docker_running() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  warn_line "Docker daemon is not running."
  case "$(uname -s)" in
    Darwin)
      info_line "Trying to open Docker Desktop..."
      open -a Docker >/dev/null 2>&1 || true
      ;;
    Linux)
      info_line "Trying to start the docker service..."
      if command -v systemctl >/dev/null 2>&1; then
        sudo -n systemctl start docker >/dev/null 2>&1 || true
      fi
      ;;
  esac

  wait_for_docker
}

compose_up() {
  "${COMPOSE_CMD[@]}" -f "$ROOT_DIR/docker/docker-compose.yml" up -d --build
}

compose_down() {
  "${COMPOSE_CMD[@]}" -f "$ROOT_DIR/docker/docker-compose.yml" down >/dev/null 2>&1 || true
}

cleanup() {
  if (( CONTAINER_STARTED )); then
    compose_down
  fi
}

wait_for_port() {
  local tries=0
  while ! (echo > "/dev/tcp/127.0.0.1/${PORT}") >/dev/null 2>&1; do
    if (( tries >= 20 )); then
      warn_line "Server did not respond in time."
      return 1
    fi
    sleep 1
    ((tries+=1))
  done
  return 0
}

start_flow() {
  banner
  info_line "Scanning for Docker runtime environment..."
  detect_compose_cmd
  ensure_docker_running

  ok_line "Using Docker Compose command: ${COMPOSE_CMD[*]}"
  echo
  status_box
  info_line "Building image and starting container..."

  if ! compose_up; then
    err "Failed to start container." "Check Docker output above and try again."
    exit 1
  fi

  CONTAINER_STARTED=1

  if ! wait_for_port; then
    err "ScrollScape did not become ready." "The container started, but port ${PORT} is not responding yet."
    exit 1
  fi

  echo
  status_box
  info_line "Opening browser at http://localhost:${PORT} ..."
  open_browser
}

menu_loop() {
  while true; do
    echo
    echo -e "  ${GRY}+-------------------------------------------------------+${R}"
    echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}R${R}  ${WHT}Restart & refresh                                ${GRY}|${R}"
    echo -e "  ${GRY}|${R}   ${BOLD}${BPUR}Q${R}  ${WHT}Quit                                              ${GRY}|${R}"
    echo -e "  ${GRY}+-------------------------------------------------------+${R}"
    IFS= read -rsn1 choice || choice="q"
    echo

    case "${choice,,}" in
      r)
        banner
        info_line "Restarting server..."
        compose_down
        CONTAINER_STARTED=0
        start_flow
        ;;
      q)
        info_line "Stopping ScrollScape..."
        exit 0
        ;;
      *)
        warn_line "Press R to restart or Q to quit."
        ;;
    esac
  done
}

main() {
  if ! command -v docker >/dev/null 2>&1; then
    err "Docker not found." "Install it from https://docs.docker.com/get-docker/"
    exit 1
  fi

  start_flow
  menu_loop
}

main "$@"
