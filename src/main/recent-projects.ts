import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RecentProject } from '../shared/types';

const RECENT_PROJECTS_FILE = 'recent-projects.json';
const MAX_RECENT_PROJECTS = 10;

function getRecentProjectsFilePath() {
  return path.join(app.getPath('userData'), RECENT_PROJECTS_FILE);
}

function getProjectName(projectPath: string) {
  const normalizedPath = projectPath.replace(/[\\/]+$/, '');
  return path.basename(normalizedPath) || normalizedPath;
}

async function writeRecentProjects(projects: RecentProject[]) {
  const filePath = getRecentProjectsFilePath();

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(projects, null, 2), 'utf8');
}

export async function getRecentProjects(): Promise<RecentProject[]> {
  const filePath = getRecentProjectsFilePath();

  try {
    const contents = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(contents);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (project): project is RecentProject =>
        project &&
        typeof project.path === 'string' &&
        typeof project.name === 'string' &&
        typeof project.lastOpenedAt === 'string',
    );
  } catch {
    return [];
  }
}

export async function saveRecentProject(projectPath: string): Promise<RecentProject[]> {
  const currentProjects = await getRecentProjects();
  const nextProject: RecentProject = {
    path: projectPath,
    name: getProjectName(projectPath),
    lastOpenedAt: new Date().toISOString(),
  };

  const deduped = currentProjects.filter((project) => project.path !== projectPath);
  const nextProjects = [nextProject, ...deduped].slice(0, MAX_RECENT_PROJECTS);

  await writeRecentProjects(nextProjects);
  return nextProjects;
}

export async function removeRecentProject(projectPath: string): Promise<RecentProject[]> {
  const currentProjects = await getRecentProjects();
  const nextProjects = currentProjects.filter((project) => project.path !== projectPath);

  await writeRecentProjects(nextProjects);
  return nextProjects;
}
