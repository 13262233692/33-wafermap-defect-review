const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openKlarfFile: () => ipcRenderer.invoke('open-klarf-file'),
  parseKlarf: (filePath) => ipcRenderer.invoke('parse-klarf', filePath),
});
