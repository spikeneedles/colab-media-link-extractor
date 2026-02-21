# -*- coding: utf-8 -*-
"""
Main entry point for Media Link Scanner program addon
Shows a menu dialog with scan options
"""

import sys
import os

try:
    import xbmc  # type: ignore
    import xbmcgui  # type: ignore
    import xbmcaddon  # type: ignore
except ImportError:
    # Fallback for linting outside Kodi
    class xbmc:  # type: ignore
        LOGDEBUG = 0
        LOGINFO = 2
        @staticmethod
        def log(msg, level=0):
            print(f"[LOG {level}] {msg}")
        @staticmethod
        def executebuiltin(cmd):
            print(f"[EXEC] {cmd}")
    
    class xbmcgui:  # type: ignore
        class Dialog:
            def select(self, title, options):
                print(f"Dialog: {title}")
                for i, opt in enumerate(options):
                    print(f"  {i}: {opt}")
                return 0
            def ok(self, title, message):
                print(f"OK Dialog: {title} - {message}")
        class DialogProgress:
            def create(self, title, message=''):
                print(f"Progress: {title} - {message}")
            def update(self, percent, message=''):
                print(f"Progress: {percent}% - {message}")
            def close(self):
                print("Progress closed")
            def iscanceled(self):
                return False
    
    class xbmcaddon:  # type: ignore
        class Addon:
            def __init__(self, id=None):
                pass
            def getAddonInfo(self, key):
                return "/fake/path" if key == "path" else "1.0.0"
            def openSettings(self):
                print("[SETTINGS] Opening settings")


def show_scan_menu():
    """Show main scan menu dialog"""
    dialog = xbmcgui.Dialog()
    addon = xbmcaddon.Addon()
    addon_path = addon.getAddonInfo('path')
    scan_script = os.path.join(addon_path, 'scan.py')
    
    options = [
        'Scan All Addons & Configs',
        'Scan Local Configs Only',
        'Scan Extension Sources',
        'Scan Backend Repos',
        'Install Guide for Archive Libs',
        'Open Settings'
    ]
    
    modes = ['all', 'local', 'extension', 'backend', 'help']
    
    selection = dialog.select('Media Link Scanner', options)
    
    if selection == -1:
        # User cancelled
        return
    elif selection == 5:
        # Open settings
        addon.openSettings()
    else:
        # Run scan with selected mode
        mode = modes[selection]
        xbmc.log(f"MediaLinkScanner: Running scan mode={mode}", xbmc.LOGINFO)
        xbmc.executebuiltin(f'RunScript({scan_script},mode={mode})')


if __name__ == '__main__':
    show_scan_menu()
