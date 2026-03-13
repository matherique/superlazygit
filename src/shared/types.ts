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

export interface RecentProject {
  path: string;
  name: string;
  lastOpenedAt: string;
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

export interface PullRequestInfo {
  number: number;
  title: string;
  state: string;
  author: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  isDraft: boolean;
  labels: string[];
  reviewDecision: string;
  url: string;
}

export interface GitViewerApi {
  onRepositorySelected: (listener: (selection: RepositorySelection) => void) => () => void;
  getRecentProjects: () => Promise<RecentProject[]>;
  openRecentProject: (path: string) => Promise<RepositorySelection>;
  getBranches: (repoPath: string) => Promise<BranchInfo[]>;
  getCommits: (repoPath: string, branchName: string) => Promise<CommitInfo[]>;
  getCommitDiff: (repoPath: string, commitHash: string) => Promise<CommitDiff>;
  getPullRequests: (repoPath: string) => Promise<PullRequestInfo[]>;
  getPullRequestDiff: (repoPath: string, prNumber: number) => Promise<CommitDiff>;
}
