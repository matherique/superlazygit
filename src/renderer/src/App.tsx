import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-yaml';

import type { BranchInfo, CommitDiff, CommitInfo, DiffFile, DiffLine, RecentProject } from '../../shared/types';

function formatCommitDate(date: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

function getFolderName(repoPath: string) {
  if (!repoPath) {
    return 'Nenhum repositório aberto';
  }

  const normalizedPath = repoPath.replace(/[\\/]+$/, '');
  const parts = normalizedPath.split(/[\\/]/);

  return parts[parts.length - 1] || normalizedPath;
}

function renderLineNumber(value?: number) {
  return value ?? '';
}

function LoadingIndicator({ label = 'carregando' }: { label?: string }) {
  return (
    <span className="loading-indicator" role="status">
      <span className="loading-indicator__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSyntaxLanguage(filePath: string): string | undefined {
  const lastDotIndex = filePath.lastIndexOf('.');
  const extension = lastDotIndex >= 0 ? filePath.slice(lastDotIndex).toLowerCase() : '';

  switch (extension) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'tsx';
    case '.js':
      return 'javascript';
    case '.jsx':
      return 'jsx';
    case '.json':
      return 'json';
    case '.cs':
      return 'csharp';
    case '.css':
    case '.scss':
      return 'css';
    case '.html':
    case '.xml':
    case '.svg':
    case '.cshtml':
      return 'markup';
    case '.sql':
      return 'sql';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      return undefined;
  }
}

function DiffEditorLine({ line, language }: { line: DiffLine; language?: string }) {
  const visibleLineNumber = line.newLineNumber ?? line.oldLineNumber;
  const highlightedContent = useMemo(() => {
    if (!line.content) {
      return ' ';
    }

    if (!language) {
      return escapeHtml(line.content);
    }

    const grammar = Prism.languages[language];

    if (!grammar) {
      return escapeHtml(line.content);
    }

    return Prism.highlight(line.content, grammar, language);
  }, [language, line.content]);

  return (
    <div className={`editor-line editor-line--${line.kind}`}>
      <span className="editor-line__number">{renderLineNumber(visibleLineNumber)}</span>
      <span className="editor-line__marker" aria-hidden="true">
        {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
      </span>
      <div
        className={`editor-line__content ${language ? `language-${language}` : ''}`}
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />
    </div>
  );
}

function DiffPatch({ file }: { file: DiffFile }) {
  const language = getSyntaxLanguage(file.path);

  return (
    <section className="file-card">
      <header className="file-card__header">
        <div>
          <p className="file-card__path">{file.path}</p>
          {file.previousPath && file.previousPath !== file.path ? (
            <p className="file-card__meta">renamed from {file.previousPath}</p>
          ) : null}
        </div>
        <div className="file-card__stats">
          <span className="badge badge--added">+{file.added}</span>
          <span className="badge badge--removed">-{file.removed}</span>
          {file.binary ? <span className="badge">binary</span> : null}
        </div>
      </header>
      <div className="editor">
        {file.binary ? <p className="editor__empty">Arquivo binário. Não há diff textual para exibir.</p> : null}
        {!file.binary && file.hunks.length === 0 ? (
          <p className="editor__empty">Não há linhas de código textuais para esse arquivo.</p>
        ) : null}
        {!file.binary &&
          file.hunks.map((hunk, hunkIndex) => (
            <Fragment key={`${file.path}-hunk-${hunkIndex}`}>
              {hunkIndex > 0 ? <div className="editor__separator">...</div> : null}
              <div className="editor__hunk">
                {hunk.lines.map((line, lineIndex) => (
                  <DiffEditorLine
                    key={`${file.path}-hunk-${hunkIndex}-line-${lineIndex}`}
                    line={line}
                    language={language}
                  />
                ))}
              </div>
            </Fragment>
          ))}
      </div>
    </section>
  );
}

export function App() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string>('');
  const [diff, setDiff] = useState<CommitDiff>({ files: [] });
  const [error, setError] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const recentMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedCommitDetails = useMemo(
    () => commits.find((commit) => commit.hash === selectedCommit) ?? null,
    [commits, selectedCommit],
  );

  async function loadRecentProjects() {
    try {
      const projects = await window.gitViewer.getRecentProjects();
      setRecentProjects(projects);
    } catch {
      setRecentProjects([]);
    }
  }

  useEffect(() => {
    void loadRecentProjects();

    const unsubscribe = window.gitViewer.onRepositorySelected(async (selection) => {
      setError('');
      setRecentMenuOpen(false);

      if ('cancelled' in selection) {
        return;
      }

      if ('error' in selection) {
        setError(selection.error);
        void loadRecentProjects();
        return;
      }

      setLoadingBranches(true);

      try {
        const nextBranches = await window.gitViewer.getBranches(selection.path);
        const nextSelectedBranch =
          nextBranches.find((branch) => branch.current)?.name ?? nextBranches[0]?.name ?? '';

        setRepoPath(selection.path);
        setBranches(nextBranches);
        setSelectedBranch(nextSelectedBranch);
        setCommits([]);
        setSelectedCommit('');
        setDiff({ files: [] });
        void loadRecentProjects();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as branches.');
      } finally {
        setLoadingBranches(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!recentMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!recentMenuRef.current?.contains(event.target as Node)) {
        setRecentMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setRecentMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [recentMenuOpen]);

  useEffect(() => {
    if (!repoPath || !selectedBranch) {
      setCommits([]);
      setSelectedCommit('');
      setDiff({ files: [] });
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingCommits(true);
      setError('');
      setSelectedCommit('');
      setDiff({ files: [] });

      try {
        const nextCommits = await window.gitViewer.getCommits(repoPath, selectedBranch);

        if (cancelled) {
          return;
        }

        setCommits(nextCommits);
        setSelectedCommit(nextCommits[0]?.hash ?? '');
      } catch (loadError) {
        if (!cancelled) {
          setCommits([]);
          setSelectedCommit('');
          setDiff({ files: [] });
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os commits.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCommits(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [repoPath, selectedBranch]);

  useEffect(() => {
    if (!repoPath || !selectedCommit) {
      setDiff({ files: [] });
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingDiff(true);
      setError('');

      try {
        const nextDiff = await window.gitViewer.getCommitDiff(repoPath, selectedCommit);

        if (!cancelled) {
          setDiff(nextDiff);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDiff({ files: [] });
          setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o diff do commit.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDiff(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [repoPath, selectedCommit]);

  return (
    <div className="shell">
      <header className="topbar">
        <h1 className="topbar__title">{getFolderName(repoPath)}</h1>
        <div className="topbar__actions" ref={recentMenuRef}>
          <button
            className="recent-projects-button"
            onClick={() => setRecentMenuOpen((currentValue) => !currentValue)}
            type="button"
          >
            projetos
          </button>

          {recentMenuOpen ? (
            <div className="recent-projects-menu">
              <div className="recent-projects-menu__header">
                <p className="panel__eyebrow">recentes</p>
                <span className="panel__meta">{recentProjects.length}</span>
              </div>

              <div className="recent-projects-menu__content">
                {recentProjects.length === 0 ? (
                  <p className="empty-state empty-state--menu">Nenhum projeto recente.</p>
                ) : (
                  recentProjects.map((project) => (
                    <button
                      className={`recent-project-item ${project.path === repoPath ? 'recent-project-item--active' : ''}`}
                      key={project.path}
                      onClick={() => {
                        void window.gitViewer.openRecentProject(project.path);
                      }}
                      type="button"
                    >
                      <span className="recent-project-item__name">{project.name}</span>
                      <span className="recent-project-item__path">{project.path}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="workspace">
        <aside className="sidebar">
          <section className="stack-panel stack-panel--branches">
            <div className="stack-panel__header">
              <div>
                <p className="panel__eyebrow">branches</p>
                <h2>{`${branches.length} local`}</h2>
              </div>
              {loadingBranches ? <LoadingIndicator /> : null}
            </div>
            <div className="stack-panel__content">
              {loadingBranches && branches.length === 0 ? (
                <p className="empty-state">
                  <LoadingIndicator label="carregando branches" />
                </p>
              ) : branches.length === 0 ? (
                <p className="empty-state">Abra um repositório pelo menu nativo do sistema para listar as branches locais.</p>
              ) : (
                branches.map((branch) => (
                  <button
                    className={`list-item ${branch.name === selectedBranch ? 'list-item--active' : ''}`}
                    key={branch.name}
                    onClick={() => setSelectedBranch(branch.name)}
                    type="button"
                  >
                    <span className="list-item__title">{branch.name}</span>
                    <span className={`status-pill ${branch.current ? 'status-pill--current' : ''}`}>
                      {branch.current ? 'head' : 'local'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="stack-panel stack-panel--commits">
            <div className="stack-panel__header">
              <div>
                <p className="panel__eyebrow">commits</p>
                <h2>{selectedBranch || 'sem branch'}</h2>
              </div>
              {loadingCommits ? <LoadingIndicator label="syncing" /> : <span className="panel__meta">{`${commits.length}`}</span>}
            </div>
            <div className="stack-panel__content stack-panel__content--commits">
              {loadingCommits && commits.length === 0 ? (
                <p className="empty-state">
                  <LoadingIndicator label="carregando commits" />
                </p>
              ) : commits.length === 0 ? (
                <p className="empty-state">Selecione uma branch para carregar os commits.</p>
              ) : (
                commits.map((commit) => (
                  <button
                    className={`commit-card ${commit.hash === selectedCommit ? 'commit-card--active' : ''}`}
                    key={commit.hash}
                    onClick={() => setSelectedCommit(commit.hash)}
                    type="button"
                  >
                    <div className="commit-card__topline">
                      <span className="commit-card__hash">{commit.shortHash}</span>
                      <span className="commit-card__date">{formatCommitDate(commit.date)}</span>
                    </div>
                    <strong className="commit-card__message">{commit.message}</strong>
                    <span className="commit-card__author">{commit.author}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>

        <section className="diff-panel">
          <div className="diff-panel__header">
            <div>
              <p className="panel__eyebrow">diff</p>
              <h2>{selectedCommitDetails?.message || 'Selecione um commit'}</h2>
            </div>
            {loadingDiff ? (
              <LoadingIndicator />
            ) : selectedCommitDetails ? (
              <div className="diff-summary">
                <span>{selectedCommitDetails.shortHash}</span>
                <span>{selectedCommitDetails.author}</span>
                <span>{formatCommitDate(selectedCommitDetails.date)}</span>
              </div>
            ) : null}
          </div>
          <div className="diff-panel__content">
            {loadingDiff ? (
              <p className="empty-state">
                <LoadingIndicator label="carregando alterações do commit" />
              </p>
            ) : null}
            {!loadingDiff && selectedCommit && diff.files.length === 0 ? (
              <p className="empty-state">Esse commit não possui patch textual visível.</p>
            ) : null}
            {!loadingDiff && !selectedCommit ? (
              <p className="empty-state">Escolha um commit para visualizar o que entrou e saiu naquele ponto.</p>
            ) : null}
            {!loadingDiff &&
              diff.files.map((file) => <DiffPatch file={file} key={`${file.previousPath ?? file.path}-${file.path}`} />)}
          </div>
        </section>
      </main>
    </div>
  );
}
