const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const os = require('os');

/**
 * SOVEREIGN DESKTOP v2.1 - CINEMATIC EDITION
 * Premium UI Architecture for High-End Orchestration.
 */

const BASE_URL = 'https://wall.60sec.shop'; 
const hardwareId = os.hostname();

let controlWindow = null;

function createWindows() {
  const primaryDisplay = screen.getPrimaryDisplay();

  controlWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1100,
    minHeight: 750,
    frame: false, 
    transparent: false, // Solid for better performance on millions of users
    backgroundColor: '#0a0a0c', // Pure Sovereign Dark
    titleBarStyle: 'hidden', // Extra layer of protection for frameless
    titleBarOverlay: false, // Ensure our custom UI wins
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  controlWindow.loadURL(`${BASE_URL}/`);
  controlWindow.removeMenu();
}

// IPC Handlers
ipcMain.on('window-minimize', () => controlWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (controlWindow?.isMaximized()) {
    controlWindow.unmaximize();
  } else {
    controlWindow.maximize();
  }
});
ipcMain.on('window-close', () => app.quit());

app.whenReady().then(createWindows);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
