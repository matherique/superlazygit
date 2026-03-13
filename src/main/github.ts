import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { parsePatchSection } from './git';
import type { CommitDiff, PullRequestInfo } from '../shared/types';

const execFileAsync = promisify(execFile);

async function runGhCommand(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('gh', args, {
    cwd: repoPath,
    timeout: 15_000,
    env: { ...process.env, NO_COLOR: '1', GH_NO_UPDATE_NOTIFIER: '1', TERM: 'dumb' },
  });

  const raw = stdout.trim();
  const jsonStart = raw.indexOf('[');
  if (jsonStart === -1) {
    return raw;
  }

  return raw.slice(jsonStart);
}

export async function getPullRequests(repoPath: string): Promise<PullRequestInfo[]> {
  let json: string;

  try {
    json = await runGhCommand(repoPath, [
    'pr',
    'list',
    '--state',
    'all',
    '--limit',
    '30',
    '--json',
    'number,title,state,author,headRefName,baseRefName,createdAt,updatedAt,additions,deletions,isDraft,labels,reviewDecision,url',
    ]);
  } catch {
    return [];
  }

  if (!json) {
    return [];
  }

  const raw = JSON.parse(json) as Array<{
    number: number;
    title: string;
    state: string;
    author: { login: string };
    headRefName: string;
    baseRefName: string;
    createdAt: string;
    updatedAt: string;
    additions: number;
    deletions: number;
    isDraft: boolean;
    labels: Array<{ name: string }>;
    reviewDecision: string;
    url: string;
  }>;

  return raw.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.author.login,
    branch: pr.headRefName,
    baseBranch: pr.baseRefName,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    additions: pr.additions,
    deletions: pr.deletions,
    isDraft: pr.isDraft,
    labels: pr.labels.map((l) => l.name),
    reviewDecision: pr.reviewDecision,
    url: pr.url,
  }));
}

export async function getPullRequestDiff(repoPath: string, prNumber: number): Promise<CommitDiff> {
  let patch: string;

  try {
    const { stdout } = await execFileAsync('gh', ['pr', 'diff', String(prNumber), '--patch'], {
      cwd: repoPath,
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: '1', GH_NO_UPDATE_NOTIFIER: '1', TERM: 'dumb' },
    });
    patch = stdout.trim();
  } catch {
    return { files: [] };
  }

  if (!patch) {
    return { files: [] };
  }

  const sections = patch
    .split(/^diff --/m)
    .map((chunk, index) => (index === 0 ? chunk : `diff --${chunk}`))
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('diff --'));

  return {
    files: sections.map(parsePatchSection),
  };
}
