import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';

import { getBranches, getCommitDiff, getCommits } from './git';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);
const WINDOW_WIDTH = 1480;
const WINDOW_HEIGHT = 920;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    title: 'Superlayz Git Viewer',
    backgroundColor: '#0a0f13',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

ipcMain.handle('repo:select', async () => {
  if (!mainWindow) {
    return { error: 'Janela principal indisponível.' };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolha um repositório Git',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  return {
    path: result.filePaths[0],
  };
});

ipcMain.handle('git:getBranches', async (_event, repoPath: string) => {
  return getBranches(repoPath);
});

ipcMain.handle('git:getCommits', async (_event, repoPath: string, branchName: string) => {
  return getCommits(repoPath, branchName);
});

ipcMain.handle('git:getCommitDiff', async (_event, repoPath: string, commitHash: string) => {
  return getCommitDiff(repoPath, commitHash);
});

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
