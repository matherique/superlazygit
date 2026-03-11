import { app, BrowserWindow, Menu, dialog, ipcMain, nativeImage } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { ensureRepository, getBranches, getCommitDiff, getCommits } from './git';
import { getRecentProjects, removeRecentProject, saveRecentProject } from './recent-projects';
import type { RepositorySelection } from '../shared/types';
import type { MenuItemConstructorOptions } from 'electron';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged && Boolean(process.env.VITE_DEV_SERVER_URL);
const WINDOW_WIDTH = 1480;
const WINDOW_HEIGHT = 920;
const APP_ICON_PATH = path.join(__dirname, '../../icon.png');

function getAppIcon() {
  if (!existsSync(APP_ICON_PATH)) {
    return undefined;
  }

  const icon = nativeImage.createFromPath(APP_ICON_PATH);
  return icon.isEmpty() ? undefined : icon;
}

async function promptForRepository(): Promise<RepositorySelection> {
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
}

async function activateRepository(repositoryPath: string): Promise<RepositorySelection> {
  try {
    await ensureRepository(repositoryPath);
    await saveRecentProject(repositoryPath);

    return { path: repositoryPath };
  } catch (error) {
    await removeRecentProject(repositoryPath);

    return {
      error: error instanceof Error ? error.message : 'Não foi possível abrir o repositório.',
    };
  }
}

async function openRepositoryFromMenu() {
  const promptedSelection = await promptForRepository();

  if ('cancelled' in promptedSelection || 'error' in promptedSelection) {
    mainWindow?.webContents.send('repo:selected', promptedSelection);
    return;
  }

  const selection = await activateRepository(promptedSelection.path);
  mainWindow?.webContents.send('repo:selected', selection);
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Repository...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            void openRepositoryFromMenu();
          },
        },
        ...(isMac ? [] : [{ type: 'separator' as const }, { role: 'quit' as const }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? ([{ role: 'selectAll' as const }] as const) : [{ type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' as const }, { role: 'close' as const }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const appIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    title: 'Superlazygit',
    backgroundColor: '#0a0f13',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  try {
    if (isDev) {
      await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    } else {
      await mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
    }
  } catch (error) {
    console.error('Failed to load renderer:', error);
    throw error;
  }
}

ipcMain.handle('git:getBranches', async (_event, repoPath: string) => {
  return getBranches(repoPath);
});

ipcMain.handle('projects:getRecent', async () => {
  return getRecentProjects();
});

ipcMain.handle('projects:openRecent', async (_event, repositoryPath: string) => {
  const selection = await activateRepository(repositoryPath);
  mainWindow?.webContents.send('repo:selected', selection);
  return selection;
});

ipcMain.handle('git:getCommits', async (_event, repoPath: string, branchName: string) => {
  return getCommits(repoPath, branchName);
});

ipcMain.handle('git:getCommitDiff', async (_event, repoPath: string, commitHash: string) => {
  return getCommitDiff(repoPath, commitHash);
});

app.whenReady().then(async () => {
  const appIcon = getAppIcon();

  if (process.platform === 'darwin' && appIcon && app.dock) {
    app.dock.setIcon(appIcon);
  }

  buildAppMenu();
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
