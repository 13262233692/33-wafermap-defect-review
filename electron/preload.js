const { ipcRenderer } = require('electron');

contextBridge = null;

module.exports = {
  openKlarfFile: () => ipcRenderer.invoke('open-klarf-file'),
};
