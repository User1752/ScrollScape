// ============================================================================
// FULL LIBRARY BACKUP / RESTORE
//
// The app's user data is split across two places: the server-side store
// (library, history, custom lists, achievements, AniList sync stats,
// settings — everything server/routes/backup.js can read) and a handful of
// browser-only localStorage keys (reading progress, per-manga spine/cover
// choices, bookshelf ordering, the AniList link map, purchased-theme cache).
// A useful backup needs both, so this module fetches the server half and
// merges it with a snapshot of the known localStorage keys into one file.
// ============================================================================

// Keep this list in sync whenever a new localStorage key is introduced —
// anything not listed here is silently left out of backups.
const BACKUP_LOCALSTORAGE_KEYS = [
  'bookshelfCustomOrder',
  'genreFilterCollapsed',
  'scrollscape.libraryCardSettings',
  'scrollscape.librarySpineColors',
  'scrollscape.selectedMangaSpines',
  'scrollscapeChapterCounts',
  'scrollscapeFlaggedChapters',
  'scrollscapeReadChapters',
  'scrollscapeReadingProgress',
  'scrollscapeSettings',
  'scrollscapeTheme',
  'scrollscape_active_theme',
  'scrollscape_al_links',
  'scrollscape_anilist_clientid',
  'scrollscape_anilist_user',
  'scrollscape_ap_bonus',
  'scrollscape_ap_spent',
  'scrollscape_purchased_themes',
  // scrollscape_anilist_token is deliberately excluded: it's a live OAuth
  // credential, not app data, and shouldn't end up in a file the user might
  // store or share. Reconnecting AniList after a restore is one click.
];

async function exportBackup() {
  try {
    const resp = await fetch('/api/backup/export');
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Export failed');

    const localStorageSnapshot = {};
    for (const key of BACKUP_LOCALSTORAGE_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) localStorageSnapshot[key] = val;
    }

    const backup = {
      app: 'ScrollScape',
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      store: data.store,
      localStorage: localStorageSnapshot,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrollscape-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast('Backup', 'Backup file downloaded.', 'success');
  } catch (e) {
    dbg.warn(dbg.ERR_SETTINGS, 'Backup export failed', e);
    showToast('Error', `Failed to export backup: ${e.message}`, 'error');
  }
}

async function importBackupFile(file) {
  try {
    const text = await file.text();
    let backup;
    try {
      backup = JSON.parse(text);
    } catch (_) {
      throw new Error('That file is not valid JSON.');
    }
    if (!backup || typeof backup !== 'object' || !backup.store || typeof backup.store !== 'object') {
      throw new Error('That file does not look like a ScrollScape backup.');
    }

    const favCount     = Array.isArray(backup.store.favorites)    ? backup.store.favorites.length    : 0;
    const listCount    = Array.isArray(backup.store.customLists)  ? backup.store.customLists.length  : 0;
    const historyCount = Array.isArray(backup.store.history)      ? backup.store.history.length      : 0;
    const exportedAt   = backup.exportedAt ? new Date(backup.exportedAt).toLocaleString() : 'an unknown date';

    const confirmed = confirm(
      `This backup was exported on ${exportedAt} and contains ${favCount} library manga, ` +
      `${listCount} custom lists and ${historyCount} history entries.\n\n` +
      `Restoring will REPLACE your current library, settings and history. This cannot be undone. Continue?`
    );
    if (!confirmed) return;

    const resp = await fetch('/api/backup/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store: backup.store }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) throw new Error(data.error || 'Import failed');

    if (backup.localStorage && typeof backup.localStorage === 'object') {
      for (const key of BACKUP_LOCALSTORAGE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(backup.localStorage, key)) {
          localStorage.setItem(key, backup.localStorage[key]);
        }
      }
    }

    showToast('Backup', 'Library restored. Reloading...', 'success');
    setTimeout(() => location.reload(), 800);
  } catch (e) {
    dbg.warn(dbg.ERR_SETTINGS, 'Backup import failed', e);
    showToast('Error', `Failed to import backup: ${e.message}`, 'error');
  }
}
