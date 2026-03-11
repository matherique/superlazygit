import { contextBridge, ipcRenderer } from 'electron';

import type { GitViewerApi, RepositorySelection } from '../shared/types';

const api: GitViewerApi = {
  onRepositorySelected: (listener) => {
    const wrappedListener = (_event: unknown, selection: RepositorySelection) => {
      listener(selection);
    };

    ipcRenderer.on('repo:selected', wrappedListener);

    return () => {
      ipcRenderer.removeListener('repo:selected', wrappedListener);
    };
  },
  getRecentProjects: () => ipcRenderer.invoke('projects:getRecent'),
  openRecentProject: (path) => ipcRenderer.invoke('projects:openRecent', path),
  getBranches: (repoPath) => ipcRenderer.invoke('git:getBranches', repoPath),
  getCommits: (repoPath, branchName) => ipcRenderer.invoke('git:getCommits', repoPath, branchName),
  getCommitDiff: (repoPath, commitHash) => ipcRenderer.invoke('git:getCommitDiff', repoPath, commitHash),
};

contextBridge.exposeInMainWorld('gitViewer', api);
