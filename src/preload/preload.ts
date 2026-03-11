import { contextBridge, ipcRenderer } from 'electron';

import type { GitViewerApi } from '../shared/types';

const api: GitViewerApi = {
  selectRepository: () => ipcRenderer.invoke('repo:select'),
  getBranches: (repoPath) => ipcRenderer.invoke('git:getBranches', repoPath),
  getCommits: (repoPath, branchName) => ipcRenderer.invoke('git:getCommits', repoPath, branchName),
  getCommitDiff: (repoPath, commitHash) => ipcRenderer.invoke('git:getCommitDiff', repoPath, commitHash),
};

contextBridge.exposeInMainWorld('gitViewer', api);
