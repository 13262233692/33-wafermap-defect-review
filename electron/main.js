const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#0a0e17',
    title: 'WaferMap Defect Review',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webgl: true,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('open-klarf-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open KLARF File',
    filters: [
      { name: 'KLARF Files', extensions: ['klar', 'klarf', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('parse-klarf', async (_event, filePath) => {
  try {
    const native = require('../native/index.node');
    const result = native.parseKlarfFile(filePath);
    return { success: true, data: result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
