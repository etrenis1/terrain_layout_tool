'use strict';

const { app, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Required for Three.js WebGL to initialise correctly in packaged Electron apps.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

autoUpdater.logger = {
  info:  (m) => console.log('[updater]',  m),
  warn:  (m) => console.warn('[updater]',  m),
  error: (m) => console.error('[updater]', m),
  debug: (m) => console.log('[updater:debug]', m),
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Terrain Layout Tool',
    backgroundColor: '#2a2a2a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  Menu.setApplicationMenu(null);

  // Toggle DevTools with Cmd+Option+I (Mac) or F12 (Windows/Linux).
  win.webContents.on('before-input-event', (_event, input) => {
    if (
      (input.meta && input.alt && input.key === 'i') ||
      input.key === 'F12'
    ) {
      win.webContents.isDevToolsOpened()
        ? win.webContents.closeDevTools()
        : win.webContents.openDevTools();
    }
  });

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[electron] failed to load: ${code} — ${desc}`);
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));
  return win;
}

function setupAutoUpdater(win) {
  // Only run in packaged app — not during development.
  if (!app.isPackaged) {
    console.log('[updater] skipped — app is not packaged');
    return;
  }

  autoUpdater.on('checking-for-update',  () => console.log('[updater] checking for update…'));
  autoUpdater.on('update-available',     (info) => console.log('[updater] update available:', info.version));
  autoUpdater.on('update-not-available', (info) => console.log('[updater] up to date:', info.version));
  autoUpdater.on('error',                (err)  => console.error('[updater] error:', err));
  autoUpdater.on('download-progress',    (p)    => console.log(`[updater] downloading… ${Math.round(p.percent)}%`));

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of Terrain Layout Tool has been downloaded.',
        detail: 'Restart the app now to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[updater] checkForUpdates failed:', err);
  });
}

app.whenReady().then(() => {
  const win = createWindow();
  setupAutoUpdater(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
