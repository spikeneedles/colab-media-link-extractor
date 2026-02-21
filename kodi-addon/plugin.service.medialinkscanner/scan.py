"""
scan.py — Manual Kodi scan entry point

Provides three manual scan modes:
  1) local     — scan Kodi config/addon files for media URLs
  2) extension — scan addon_data configs for media URLs
  3) backend   — extract addon repo URLs from addon.xml for backend crawling

Invoked via Kodi settings action buttons (RunScript).
"""

import os
import re
import sys
import sqlite3

try:
    import xbmc  # type: ignore[import-not-found]
    import xbmcgui  # type: ignore[import-not-found]
    import xbmcaddon  # type: ignore[import-not-found]
    import xbmcvfs  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGINFO = 1
        LOGWARNING = 2

        def log(self, *args, **kwargs):
            pass

        def sleep(self, *args, **kwargs):
            pass

    class _KodiGuiStub:
        NOTIFICATION_INFO = 0
        NOTIFICATION_WARNING = 1

        class Dialog:
            def notification(self, *args, **kwargs):
                pass

            def ok(self, *args, **kwargs):
                pass

        class DialogProgress:
            def create(self, *args, **kwargs):
                pass

            def update(self, *args, **kwargs):
                pass

            def iscanceled(self):
                return False

            def close(self):
                pass

    class _AddonStub:
        def __init__(self, *args, **kwargs):
            pass

        def getAddonInfo(self, *args, **kwargs):
            return 'Media Link Scanner'

    class _AddonModuleStub:
        def Addon(self, *args, **kwargs):
            return _AddonStub()

    class _VfsStub:
        def translatePath(self, path):
            return path

        def listdir(self, path):
            return ([], [])

        def exists(self, path):
            return False

        class File:
            def __init__(self, *args, **kwargs):
                pass

            def size(self):
                return 0

            def read(self):
                return ''

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

    xbmc = _KodiStub()
    xbmcgui = _KodiGuiStub()
    xbmcaddon = _AddonModuleStub()
    xbmcvfs = _VfsStub()

# Ensure lib/ is on the path
ADDON_DIR = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(ADDON_DIR, 'lib'))

from lib.settings import (
    get_session_id,
    log,
    is_deep_scan_enabled,
    is_archive_scan_enabled,
    is_sqlite_scan_enabled,
    get_max_file_mb,
)
from lib import api_client  # type: ignore[import-not-found]

URL_PATTERN = re.compile(r'(https?|rtsp|rtmps?|rtmp|udp|mms|mmsh)://[^\s"\'<>]+', re.IGNORECASE)

FILE_EXTS = {
    '.m3u', '.m3u8', '.strm', '.nfo', '.xsp', '.xml', '.json', '.txt', '.cfg', '.ini', '.conf', '.py',
    '.log', '.db', '.sqlite', '.sql', '.php', '.js', '.ts', '.html', '.htm'
}
FILE_NAMES = {'sources.xml', 'addon.xml', 'settings.xml'}

ARCHIVE_EXTS = {'.zip', '.rar', '.7z'}

MAX_DB_ROWS = 200

MAX_FILE_SIZE = get_max_file_mb() * 1024 * 1024
_missing_rar = False
_missing_7z = False
BATCH_SIZE = 200


def _parse_mode(argv):
    for arg in argv[1:]:
        if arg.startswith('mode='):
            return arg.split('=', 1)[1].strip()
    return 'local'


def _translate(path):
    try:
        return xbmcvfs.translatePath(path)
    except Exception:
        return path


def _iter_files(root_path):
    stack = [root_path]
    while stack:
        current = stack.pop()
        try:
            dirs, files = xbmcvfs.listdir(current)
        except Exception:
            continue

        for d in dirs:
            stack.append(os.path.join(current, d))
        for f in files:
            yield os.path.join(current, f)


def _should_scan(path):
    filename = os.path.basename(path).lower()
    if filename in FILE_NAMES:
        return True
    _, ext = os.path.splitext(filename)
    return ext.lower() in FILE_EXTS


def _read_text(path):
    try:
        if not xbmcvfs.exists(path):
            return ''
        size = xbmcvfs.File(path).size()
        if size and size > MAX_FILE_SIZE:
            return ''
        with xbmcvfs.File(path) as fh:
            raw = fh.read()
            if isinstance(raw, bytes):
                return raw.decode('utf-8', errors='replace')
            return raw
    except Exception:
        return ''


def _extract_urls(text):
    if not text:
        return []
    return [m.group(0) for m in URL_PATTERN.finditer(text)] if isinstance(text, str) else []


def _extract_m3u_refs(text):
    refs = []
    if not text:
        return refs
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '://' in line:
            continue
        refs.append(line)
    return refs


def _scan_zip(path):
    try:
        import zipfile
        if not xbmcvfs.exists(path):
            return set(), 0
        size = xbmcvfs.File(path).size()
        if size and size > MAX_FILE_SIZE:
            return set(), 0
        data = _read_text(path)
        if not data:
            # Fallback: read via xbmcvfs to temp path not available; skip.
            return set(), 0
        # xbmcvfs can't provide binary stream easily; skip unless local path.
        if not os.path.exists(path):
            return set(), 0
        urls = set()
        files_scanned = 0
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                _, ext = os.path.splitext(name)
                if ext.lower() not in FILE_EXTS:
                    continue
                try:
                    content = zf.read(name).decode('utf-8', errors='replace')
                except Exception:
                    continue
                files_scanned += 1
                for url in _extract_urls(content):
                    urls.add(url)
        return urls, files_scanned
    except Exception:
        return set(), 0


def _scan_rar(path):
    try:
        import rarfile  # type: ignore[import-not-found]
        if not os.path.exists(path):
            return set(), 0
        urls = set()
        files_scanned = 0
        with rarfile.RarFile(path) as rf:
            for name in rf.namelist():
                _, ext = os.path.splitext(name)
                if ext.lower() not in FILE_EXTS:
                    continue
                try:
                    content = rf.read(name).decode('utf-8', errors='replace')
                except Exception:
                    continue
                files_scanned += 1
                for url in _extract_urls(content):
                    urls.add(url)
        return urls, files_scanned
    except Exception as exc:
        global _missing_rar
        _missing_rar = True
        log(f'RAR scan skipped: {exc}', level=xbmc.LOGWARNING)
        return set(), 0


def _scan_7z(path):
    try:
        import py7zr  # type: ignore[import-not-found]
        if not os.path.exists(path):
            return set(), 0
        urls = set()
        files_scanned = 0
        with py7zr.SevenZipFile(path, mode='r') as zf:
            for name, bio in zf.readall().items():
                _, ext = os.path.splitext(name)
                if ext.lower() not in FILE_EXTS:
                    continue
                try:
                    content = bio.read().decode('utf-8', errors='replace')
                except Exception:
                    continue
                files_scanned += 1
                for url in _extract_urls(content):
                    urls.add(url)
        return urls, files_scanned
    except Exception as exc:
        global _missing_7z
        _missing_7z = True
        log(f'7z scan skipped: {exc}', level=xbmc.LOGWARNING)
        return set(), 0


def _scan_archive(path):
    if not is_archive_scan_enabled():
        return set(), 0
    _, ext = os.path.splitext(path)
    ext = ext.lower()
    if ext == '.zip':
        return _scan_zip(path)
    if ext == '.rar':
        return _scan_rar(path)
    if ext == '.7z':
        return _scan_7z(path)
    return set(), 0


def _scan_sqlite(path):
    if not is_sqlite_scan_enabled():
        return set(), 0
    if not os.path.exists(path):
        return set(), 0

    urls = set()
    files_scanned = 0

    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        for row in tables:
            table = row['name']
            try:
                columns = cur.execute(f"PRAGMA table_info('{table}')").fetchall()
            except Exception:
                continue

            text_cols = [c['name'] for c in columns if str(c['type']).lower() in ('text', 'varchar', 'char')]
            if not text_cols:
                continue

            col_list = ','.join([f'"{c}"' for c in text_cols])
            try:
                rows = cur.execute(f"SELECT {col_list} FROM '{table}' LIMIT {MAX_DB_ROWS}").fetchall()
            except Exception:
                continue

            for r in rows:
                for c in text_cols:
                    value = r[c]
                    if isinstance(value, str):
                        for url in _extract_urls(value):
                            urls.add(url)
            files_scanned += 1

        conn.close()
    except Exception as exc:
        log(f'SQLite scan skipped: {exc}', level=xbmc.LOGWARNING)

    return urls, files_scanned


def _find_urls_in_path(root_path, progress_cb=None):
    urls = set()
    files_scanned = 0

    for file_path in _iter_files(root_path):
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        if ext in ARCHIVE_EXTS:
            archive_urls, archive_scanned = _scan_archive(file_path)
            urls.update(archive_urls)
            files_scanned += archive_scanned
            if progress_cb and archive_scanned:
                progress_cb(files_scanned)
            continue

        if ext in {'.db', '.sqlite'}:
            db_urls, db_scanned = _scan_sqlite(file_path)
            urls.update(db_urls)
            files_scanned += db_scanned
            if progress_cb and db_scanned:
                progress_cb(files_scanned)
            continue

        if not _should_scan(file_path):
            continue

        content = _read_text(file_path)
        if not content:
            continue
        files_scanned += 1
        if progress_cb:
            progress_cb(files_scanned)
        for url in _extract_urls(content):
            urls.add(url)

        # Follow local references from M3U-like files
        if ext in {'.m3u', '.m3u8', '.strm'}:
            for ref in _extract_m3u_refs(content):
                ref_path = os.path.join(os.path.dirname(file_path), ref)
                if xbmcvfs.exists(ref_path):
                    ref_content = _read_text(ref_path)
                    for url in _extract_urls(ref_content):
                        urls.add(url)

    return urls, files_scanned


def _progress_dialog(title):
    dialog = xbmcgui.DialogProgress()
    dialog.create(title, 'Scanning files...')
    return dialog


def _count_scannable_files(root_path):
    count = 0
    for file_path in _iter_files(root_path):
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()

        if ext in ARCHIVE_EXTS and is_archive_scan_enabled():
            count += 1
            continue

        if ext in {'.db', '.sqlite'} and is_sqlite_scan_enabled():
            count += 1
            continue

        if _should_scan(file_path):
            count += 1

    return count


class _ScanCancelled(Exception):
    pass


def _extract_repo_urls(addons_root):
    repo_urls = set()
    files_scanned = 0

    for file_path in _iter_files(addons_root):
        if os.path.basename(file_path).lower() != 'addon.xml':
            continue
        content = _read_text(file_path)
        if not content:
            continue
        files_scanned += 1
        for tag in ('source', 'website', 'forum'):
            match = re.search(rf'<{tag}[^>]*>([^<]+)</{tag}>', content, re.IGNORECASE)
            if match:
                repo_urls.add(match.group(1).strip())

    return repo_urls, files_scanned


def _send_batches(urls, session_id, addon_name, category):
    if not urls:
        log('Manual scan found no URLs to send.', level=xbmc.LOGINFO)
        return {'urls_sent': 0, 'batches': 0}

    urls = list(urls)
    batches = 0
    for i in range(0, len(urls), BATCH_SIZE):
        batch = urls[i:i + BATCH_SIZE]
        payload = {
            'urls': batch,
            'kodi_session_id': session_id,
            'kodi_source': addon_name,
            'metadata': {
                'category': category,
                'media_type': 'unknown',
                'source_name': addon_name,
            },
        }
        api_client.kodi_sync_batch(payload)
        batches += 1

    return {'urls_sent': len(urls), 'batches': batches}


def _notify_summary(title, message, icon=xbmcgui.NOTIFICATION_INFO):
    try:
        xbmcgui.Dialog().notification(title, message, icon, 5000)
        xbmcgui.Dialog().ok(title, message)
    except Exception:
        pass


def _show_missing_libs_help(missing_rar, missing_7z):
    if not missing_rar and not missing_7z:
        return

    lines = []
    if missing_rar:
        lines.append('- rarfile not available')
    if missing_7z:
        lines.append('- py7zr not available')

    lines.append('')
    lines.append('Windows (advanced):')
    lines.append('  1) Install Python for Kodi (if used)')
    lines.append('  2) pip install rarfile py7zr')
    lines.append('  3) Ensure unrar is installed and in PATH')
    lines.append('')
    lines.append('Android:')
    lines.append('  Kodi Python cannot install pip packages easily.')
    lines.append('  ZIP scanning will still work; RAR/7z will be skipped.')

    xbmcgui.Dialog().ok('Media Link Scanner', '\n'.join(lines))


def _show_install_guide():
    lines = []
    lines.append('Archive Scan Dependencies')
    lines.append('')
    lines.append('Windows (advanced):')
    lines.append('  1) Install Python for Kodi (if used)')
    lines.append('  2) pip install rarfile py7zr')
    lines.append('  3) Ensure unrar is installed and in PATH')
    lines.append('')
    lines.append('Android:')
    lines.append('  Kodi Python cannot install pip packages easily.')
    lines.append('  ZIP scanning will still work; RAR/7z will be skipped.')

    xbmcgui.Dialog().ok('Media Link Scanner', '\n'.join(lines))


def run():
    mode = _parse_mode(sys.argv)
    addon = xbmcaddon.Addon(id='plugin.service.medialinkscanner')
    addon_name = addon.getAddonInfo('name')
    session_id = get_session_id()

    log(f'Manual scan started: mode={mode}', level=xbmc.LOGINFO)
    if is_archive_scan_enabled():
        log('Archive scan enabled (ZIP/RAR/7z)', level=xbmc.LOGINFO)
    if is_sqlite_scan_enabled():
        log('SQLite scan enabled (.db/.sqlite)', level=xbmc.LOGINFO)

    if mode == 'local':
        roots = [
            'special://home/addons',
            'special://userdata',
        ]
        if is_deep_scan_enabled():
            roots.extend([
                'special://userdata/Database',
                'special://userdata/Thumbnails',
                'special://home',
            ])
        total_candidates = 0
        for root in roots:
            translated = _translate(root)
            total_candidates += _count_scannable_files(translated)

        dialog = _progress_dialog('Media Link Scanner')
        last_update = {'count': 0}

        def progress_cb(count):
            if dialog.iscanceled():
                raise _ScanCancelled()
            if count - last_update['count'] >= 25:
                percent = 0
                if total_candidates > 0:
                    percent = min(99, int((count / total_candidates) * 100))
                dialog.update(percent, f'Scanning files... {count} / {total_candidates}')
                last_update['count'] = count

        all_urls = set()
        total_files = 0
        try:
            for root in roots:
                translated = _translate(root)
                urls, files = _find_urls_in_path(translated, progress_cb)
                all_urls.update(urls)
                total_files += files
        except _ScanCancelled:
            dialog.close()
            _notify_summary('Media Link Scanner', 'Scan cancelled by user.', xbmcgui.NOTIFICATION_WARNING)
            return
        finally:
            if not dialog.iscanceled():
                dialog.update(100, 'Scan complete')
                xbmc.sleep(500)
            dialog.close()

        url_count = len(all_urls)
        log(f'Local scan complete. Files scanned: {total_files}, URLs found: {url_count}', level=xbmc.LOGINFO)
        send_stats = _send_batches(all_urls, session_id, addon_name, 'kodi-local-scan')
        if _missing_rar or _missing_7z:
            msg = 'Archive scan skipped: missing '
            if _missing_rar:
                msg += 'rarfile '
            if _missing_7z:
                msg += 'py7zr '
            msg += '(Kodi Python may not include these libraries)'
            _notify_summary('Media Link Scanner', msg, xbmcgui.NOTIFICATION_WARNING)
            _show_missing_libs_help(_missing_rar, _missing_7z)
        _notify_summary(
            'Media Link Scanner',
            f'Local scan complete. Files scanned: {total_files}. URLs found: {url_count}. '
            f'Batches sent: {send_stats["batches"]}.'
        )
        return

    if mode == 'all':
        roots = [
            'special://home/addons',
            'special://userdata',
            'special://userdata/addon_data',
        ]
        if is_deep_scan_enabled():
            roots.extend([
                'special://userdata/Database',
                'special://userdata/Thumbnails',
                'special://home',
            ])
        total_candidates = 0
        for root in roots:
            translated = _translate(root)
            total_candidates += _count_scannable_files(translated)

        dialog = _progress_dialog('Media Link Scanner')
        last_update = {'count': 0}

        def progress_cb(count):
            if dialog.iscanceled():
                raise _ScanCancelled()
            if count - last_update['count'] >= 25:
                percent = 0
                if total_candidates > 0:
                    percent = min(99, int((count / total_candidates) * 100))
                dialog.update(percent, f'Scanning files... {count} / {total_candidates}')
                last_update['count'] = count

        all_urls = set()
        total_files = 0
        try:
            for root in roots:
                translated = _translate(root)
                urls, files = _find_urls_in_path(translated, progress_cb)
                all_urls.update(urls)
                total_files += files
        except _ScanCancelled:
            dialog.close()
            _notify_summary('Media Link Scanner', 'Scan cancelled by user.', xbmcgui.NOTIFICATION_WARNING)
            return
        finally:
            if not dialog.iscanceled():
                dialog.update(100, 'Scan complete')
                xbmc.sleep(500)
            dialog.close()

        url_count = len(all_urls)
        log(f'All-addons scan complete. Files scanned: {total_files}, URLs found: {url_count}', level=xbmc.LOGINFO)
        send_stats = _send_batches(all_urls, session_id, addon_name, 'kodi-scan-all')
        if _missing_rar or _missing_7z:
            msg = 'Archive scan skipped: missing '
            if _missing_rar:
                msg += 'rarfile '
            if _missing_7z:
                msg += 'py7zr '
            msg += '(Kodi Python may not include these libraries)'
            _notify_summary('Media Link Scanner', msg, xbmcgui.NOTIFICATION_WARNING)
            _show_missing_libs_help(_missing_rar, _missing_7z)
        _notify_summary(
            'Media Link Scanner',
            f'All-addons scan complete. Files scanned: {total_files}. URLs found: {url_count}. '
            f'Batches sent: {send_stats["batches"]}.'
        )
        return

    if mode == 'help':
        _show_install_guide()
        return

    if mode == 'extension':
        roots = [
            'special://userdata/addon_data',
        ]
        total_candidates = 0
        for root in roots:
            translated = _translate(root)
            total_candidates += _count_scannable_files(translated)

        dialog = _progress_dialog('Media Link Scanner')
        last_update = {'count': 0}

        def progress_cb(count):
            if dialog.iscanceled():
                raise _ScanCancelled()
            if count - last_update['count'] >= 25:
                percent = 0
                if total_candidates > 0:
                    percent = min(99, int((count / total_candidates) * 100))
                dialog.update(percent, f'Scanning files... {count} / {total_candidates}')
                last_update['count'] = count

        all_urls = set()
        total_files = 0
        try:
            for root in roots:
                translated = _translate(root)
                urls, files = _find_urls_in_path(translated, progress_cb)
                all_urls.update(urls)
                total_files += files
        except _ScanCancelled:
            dialog.close()
            _notify_summary('Media Link Scanner', 'Scan cancelled by user.', xbmcgui.NOTIFICATION_WARNING)
            return
        finally:
            if not dialog.iscanceled():
                dialog.update(100, 'Scan complete')
                xbmc.sleep(500)
            dialog.close()

        url_count = len(all_urls)
        log(f'Extension scan complete. Files scanned: {total_files}, URLs found: {url_count}', level=xbmc.LOGINFO)
        send_stats = _send_batches(all_urls, session_id, addon_name, 'kodi-extension-scan')
        if _missing_rar or _missing_7z:
            msg = 'Archive scan skipped: missing '
            if _missing_rar:
                msg += 'rarfile '
            if _missing_7z:
                msg += 'py7zr '
            msg += '(Kodi Python may not include these libraries)'
            _notify_summary('Media Link Scanner', msg, xbmcgui.NOTIFICATION_WARNING)
            _show_missing_libs_help(_missing_rar, _missing_7z)
        _notify_summary(
            'Media Link Scanner',
            f'Extension scan complete. Files scanned: {total_files}. URLs found: {url_count}. '
            f'Batches sent: {send_stats["batches"]}.'
        )
        return

    if mode == 'backend':
        addons_root = _translate('special://home/addons')
        repo_urls, files_scanned = _extract_repo_urls(addons_root)
        url_count = len(repo_urls)
        log(f'Backend scan complete. addon.xml scanned: {files_scanned}, repo URLs found: {url_count}', level=xbmc.LOGINFO)
        send_stats = _send_batches(repo_urls, session_id, addon_name, 'kodi-backend-repo-scan')
        _notify_summary(
            'Media Link Scanner',
            f'Backend scan complete. addon.xml scanned: {files_scanned}. Repo URLs found: {url_count}. '
            f'Batches sent: {send_stats["batches"]}.'
        )
        return

    log(f'Unknown scan mode: {mode}', level=xbmc.LOGWARNING)


if __name__ == '__main__':
    run()
