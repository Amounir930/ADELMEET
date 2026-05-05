const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isElectron: true
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('[SOVEREIGN] Desktop v2.0 Preload Initialized');
});
