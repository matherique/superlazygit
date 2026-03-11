export interface BranchInfo {
  name: string;
  current: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface DiffLine {
  kind: 'context' | 'added' | 'removed';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  previousPath?: string;
  added: number;
  removed: number;
  binary: boolean;
  hunks: DiffHunk[];
}

export interface CommitDiff {
  files: DiffFile[];
}

export type RepositorySelection =
  | {
      path: string;
    }
  | {
      cancelled: true;
    }
  | {
      error: string;
    };

export interface GitViewerApi {
  selectRepository: () => Promise<RepositorySelection>;
  getBranches: (repoPath: string) => Promise<BranchInfo[]>;
  getCommits: (repoPath: string, branchName: string) => Promise<CommitInfo[]>;
  getCommitDiff: (repoPath: string, commitHash: string) => Promise<CommitDiff>;
}
