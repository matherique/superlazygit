# Repository Guidelines

## Project Structure & Module Organization
This repository is an Electron desktop app for browsing Git history in a local repository.

- `src/main/`: Electron main-process code, native menu setup, Git access, and recent-project persistence.
- `src/preload/`: secure bridge between Electron and the renderer.
- `src/renderer/`: Vite-based React UI. Main UI code lives in `src/renderer/src/`.
- `src/shared/`: shared TypeScript types used by main, preload, and renderer.
- `scripts/dev.mjs`: development launcher for Vite, TypeScript watch, and Electron.
- `icon.png`: app icon asset.

Keep Git logic in `src/main/`, UI state/rendering in `src/renderer/src/`, and shared contracts in `src/shared/types.ts`.

## Build, Test, and Development Commands
- `npm run dev`: starts Vite, TypeScript watch for Electron files, and launches Electron.
- `npm run dev:renderer`: runs only the renderer dev server on `127.0.0.1:5173`.
- `npm run dev:main`: watches and compiles Electron main/preload TypeScript.
- `npm run build`: builds renderer and Electron output.
- `npm run build:renderer`: builds the React/Vite frontend into `dist/renderer`.
- `npm run build:main`: compiles `src/main`, `src/preload`, and `src/shared` into `dist-electron`.
- `npm run typecheck`: runs TypeScript checks for both renderer and Electron code.

## Coding Style & Naming Conventions
Use TypeScript throughout. Follow existing style:

- 2-space indentation
- single quotes
- semicolons required
- `camelCase` for variables/functions
- `PascalCase` for React components and TypeScript interfaces
- descriptive file names such as `recent-projects.ts`, `App.tsx`, `types.ts`

No formatter or linter is configured yet, so match surrounding code exactly when editing.

## Testing Guidelines
There is no automated test framework configured yet. Until one is added:

- run `npm run typecheck`
- run `npm run build`
- manually verify Electron flows such as opening repositories, switching recent projects, and viewing diffs

When adding tests later, place renderer tests near UI modules and main-process tests near `src/main/`.

## Commit & Pull Request Guidelines
Git history is minimal, so use clear, imperative commit messages. Prefer concise conventional-style messages, for example:

- `feat: add recent projects menu`
- `fix: handle invalid repository selection`

Pull requests should include:

- a short summary of behavior changes
- screenshots or screen recordings for UI changes
- manual verification notes (`npm run typecheck`, `npm run build`, key flows tested)
- linked issue or task when applicable

## Security & Configuration Notes
Keep filesystem and Git execution in the Electron main process. Do not expose Node APIs directly to the renderer; extend the preload bridge instead.
