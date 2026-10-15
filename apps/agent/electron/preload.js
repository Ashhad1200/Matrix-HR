// Minimal, safe bridge: the onboarding page can only call pair() and read the config path. No Node exposed.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('matrixhr', {
  pair: (data) => ipcRenderer.invoke('pair', data),
  configPath: () => ipcRenderer.invoke('config-path'),
});
