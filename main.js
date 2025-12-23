const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1200, // Ancho inicial de la ventana
    height: 800, // Alto inicial
    webPreferences: {
      preload: path.join(__dirname, 'preload.js') // Opcional, para funciones más avanzadas
    }
  });

  // Carga tu index.html
  mainWindow.loadFile('index.html');

  // Opcional: Abre las herramientas de desarrollador (como F12 en Chrome)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// (Opcional) Crea un archivo preload.js vacío por ahora si lo referenciaste arriba
// Puedes dejarlo vacío o borrar la línea 'preload' en webPreferences