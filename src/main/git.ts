import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { promisify } from 'node:util';

import type { BranchInfo, CommitDiff, CommitInfo, DiffFile, DiffHunk, DiffLine } from '../shared/types';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 15_000;
const GIT_MAX_BUFFER = 10 * 1024 * 1024;

async function runGit(repoPath: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd: repoPath,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true,
    });

    return stdout;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException & { stderr?: string };

    if (nodeError.code === 'ENOENT') {
      throw new Error('Git não está instalado ou não está disponível no PATH.');
    }

    const stderr = nodeError.stderr?.trim();
    throw new Error(stderr || 'Falha ao executar comando Git.');
  }
}

export async function ensureRepository(repoPath: string): Promise<void> {
  await access(repoPath);

  const stdout = await runGit(repoPath, ['rev-parse', '--is-inside-work-tree']);

  if (stdout.trim() !== 'true') {
    throw new Error('A pasta selecionada não é um repositório Git válido.');
  }
}

export async function getBranches(repoPath: string): Promise<BranchInfo[]> {
  await ensureRepository(repoPath);

  const stdout = await runGit(repoPath, ['branch', '--format=%(refname:short)|%(HEAD)']);

  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, marker] = line.split('|');

      return {
        name,
        current: marker?.trim() === '*',
      };
    });
}

export async function getCommits(repoPath: string, branchName: string): Promise<CommitInfo[]> {
  await ensureRepository(repoPath);

  let stdout = '';

  try {
    stdout = await runGit(repoPath, [
      'log',
      branchName,
      '--date=iso-strict',
      '--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1e',
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('does not have any commits yet')) {
      return [];
    }

    throw error;
  }

  return stdout
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash, shortHash, author, date, message] = entry.split('\x1f');

      return {
        hash,
        shortHash,
        author,
        date,
        message,
      };
    });
}

function deriveDiffPath(lines: string[]): { path: string; previousPath?: string } {
  const renameFrom = lines.find((line) => line.startsWith('rename from '));
  const renameTo = lines.find((line) => line.startsWith('rename to '));

  if (renameTo) {
    return {
      path: renameTo.replace('rename to ', ''),
      previousPath: renameFrom?.replace('rename from ', ''),
    };
  }

  const plusPlus = lines.find((line) => line.startsWith('+++ '));
  const minusMinus = lines.find((line) => line.startsWith('--- '));

  if (plusPlus && plusPlus !== '+++ /dev/null') {
    return { path: plusPlus.replace('+++ b/', '') };
  }

  if (minusMinus && minusMinus !== '--- /dev/null') {
    return { path: minusMinus.replace('--- a/', '') };
  }

  const header = lines[0] ?? '';
  const gitMatch = header.match(/^diff --git a\/(.+?) b\/(.+)$/);

  if (gitMatch) {
    const [, previousPath, currentPath] = gitMatch;
    return { path: currentPath, previousPath };
  }

  const genericMatch = header.match(/^diff --\w+\s+(.+)$/);

  if (genericMatch) {
    return { path: genericMatch[1] };
  }

  return { path: 'arquivo-desconhecido' };
}

function parseHunkHeader(line: string): { oldLineNumber: number; newLineNumber: number } | null {
  const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);

  if (!match) {
    return null;
  }

  const [, oldLineNumber, newLineNumber] = match;

  return {
    oldLineNumber: Number(oldLineNumber),
    newLineNumber: Number(newLineNumber),
  };
}

function parseHunks(lines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 0;
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const parsedHeader = parseHunkHeader(line);

      if (!parsedHeader) {
        continue;
      }

      oldLineNumber = parsedHeader.oldLineNumber;
      newLineNumber = parsedHeader.newLineNumber;
      currentHunk = { lines: [] };
      hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith('\\ No newline at end of file')) {
      continue;
    }

    let diffLine: DiffLine | null = null;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      diffLine = {
        kind: 'added',
        newLineNumber,
        content: line.slice(1),
      };
      newLineNumber += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      diffLine = {
        kind: 'removed',
        oldLineNumber,
        content: line.slice(1),
      };
      oldLineNumber += 1;
    } else if (line.startsWith(' ')) {
      diffLine = {
        kind: 'context',
        oldLineNumber,
        newLineNumber,
        content: line.slice(1),
      };
      oldLineNumber += 1;
      newLineNumber += 1;
    }

    if (diffLine) {
      currentHunk.lines.push(diffLine);
    }
  }

  return hunks;
}

function parsePatchSection(section: string): DiffFile {
  const lines = section.split('\n');
  const pathInfo = deriveDiffPath(lines);
  const hunks = parseHunks(lines);

  let added = 0;
  let removed = 0;
  let binary = false;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed += 1;
    }

    if (line.includes('Binary files') || line.startsWith('GIT binary patch')) {
      binary = true;
    }
  }

  return {
    path: pathInfo.path,
    previousPath: pathInfo.previousPath,
    added,
    removed,
    binary,
    hunks,
  };
}

export async function getCommitDiff(repoPath: string, commitHash: string): Promise<CommitDiff> {
  await ensureRepository(repoPath);

  const stdout = await runGit(repoPath, [
    'show',
    '--format=',
    '--patch',
    '--find-renames',
    '--find-copies-harder',
    '--no-ext-diff',
    commitHash,
  ]);

  const normalized = stdout.trim();

  if (!normalized) {
    return { files: [] };
  }

  const sections = normalized
    .split(/^diff --/m)
    .map((chunk, index) => (index === 0 ? chunk : `diff --${chunk}`))
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return {
    files: sections.map(parsePatchSection),
  };
}
