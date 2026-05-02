'use strict';

const { app, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Required for Three.js WebGL to initialise correctly in packaged Electron apps.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// logUpdate writes to %APPDATA%\Terrain Layout Tool\updater.log so it's
// visible after the fact even when DevTools isn't open.
let logFilePath = null;
function logUpdate(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (logFilePath) {
    try { fs.appendFileSync(logFilePath, line); } catch (_) {}
  }
  console.log(line.trim());
}

autoUpdater.logger = {
  info:  (m) => logUpdate(`INFO  ${m}`),
  warn:  (m) => logUpdate(`WARN  ${m}`),
  error: (m) => logUpdate(`ERROR ${m}`),
  debug: (m) => logUpdate(`DEBUG ${m}`),
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
  // app.getPath is only valid after app is ready, so set logFilePath here.
  logFilePath = path.join(app.getPath('userData'), 'updater.log');
  logUpdate(`app version: ${app.getVersion()}, isPackaged: ${app.isPackaged}`);

  if (!app.isPackaged) {
    logUpdate('skipped — app is not packaged');
    return;
  }

  autoUpdater.on('checking-for-update',  ()     => logUpdate('checking for update…'));
  autoUpdater.on('update-available',     (info) => logUpdate(`update available: ${info.version}`));
  autoUpdater.on('update-not-available', (info) => logUpdate(`up to date: ${info.version}`));
  autoUpdater.on('error',                (err)  => logUpdate(`ERROR: ${err}`));
  autoUpdater.on('download-progress',    (p)    => logUpdate(`downloading… ${Math.round(p.percent)}%`));

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
    logUpdate(`checkForUpdates failed: ${err}`);
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
