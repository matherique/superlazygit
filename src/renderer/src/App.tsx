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
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-go';

import type { BranchInfo, CommitDiff, CommitInfo, DiffFile, DiffLine, PullRequestInfo, RecentProject } from '../../shared/types';

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
    case '.php':
      return 'php';
    case '.go':
      return 'go';
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

function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `${diffMinutes}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 30) return `${diffDays}d`;

    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
  } catch {
    return dateString;
  }
}

function getReviewStatusLabel(decision: string): { label: string; className: string } {
  switch (decision) {
    case 'APPROVED':
      return { label: 'approved', className: 'pr-review--approved' };
    case 'CHANGES_REQUESTED':
      return { label: 'changes', className: 'pr-review--changes' };
    case 'REVIEW_REQUIRED':
      return { label: 'review', className: 'pr-review--pending' };
    default:
      return { label: '', className: '' };
  }
}

function PullRequestCard({
  pr,
  active,
  onClick,
}: {
  pr: PullRequestInfo;
  active: boolean;
  onClick: () => void;
}) {
  const review = getReviewStatusLabel(pr.reviewDecision);

  return (
    <button
      className={`pr-card ${active ? 'pr-card--active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <div className="pr-card__topline">
        <span className="pr-card__number">#{pr.number}</span>
        <div className="pr-card__badges">
          {pr.isDraft ? <span className="badge badge--draft">draft</span> : null}
          <span className={`badge badge--pr-state badge--pr-${pr.state.toLowerCase()}`}>
            {pr.state === 'MERGED' ? 'merged' : pr.state === 'CLOSED' ? 'closed' : 'open'}
          </span>
        </div>
      </div>
      <strong className="pr-card__title">{pr.title}</strong>
      <div className="pr-card__meta">
        <span>{pr.author}</span>
        <span>{pr.branch}</span>
        <span>{formatRelativeDate(pr.updatedAt)}</span>
      </div>
      <div className="pr-card__footer">
        <div className="pr-card__stats">
          <span className="badge badge--added">+{pr.additions}</span>
          <span className="badge badge--removed">-{pr.deletions}</span>
        </div>
        {review.label ? (
          <span className={`badge ${review.className}`}>{review.label}</span>
        ) : null}
        {pr.labels.length > 0 ? (
          <div className="pr-card__labels">
            {pr.labels.map((label) => (
              <span key={label} className="badge badge--label">{label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
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
  const [activeTab, setActiveTab] = useState<'git' | 'prs'>('git');
  const [pullRequests, setPullRequests] = useState<PullRequestInfo[]>([]);
  const [loadingPRs, setLoadingPRs] = useState(false);
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [prFilter, setPrFilter] = useState<'all' | 'OPEN' | 'CLOSED' | 'MERGED'>('OPEN');
  const [prDiff, setPrDiff] = useState<CommitDiff>({ files: [] });
  const [loadingPrDiff, setLoadingPrDiff] = useState(false);
  const [prError, setPrError] = useState('');
  const recentMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedCommitDetails = useMemo(
    () => commits.find((commit) => commit.hash === selectedCommit) ?? null,
    [commits, selectedCommit],
  );

  const filteredPRs = useMemo(
    () => prFilter === 'all' ? pullRequests : pullRequests.filter((pr) => pr.state === prFilter),
    [pullRequests, prFilter],
  );

  const selectedPRDetails = useMemo(
    () => pullRequests.find((pr) => pr.number === selectedPR) ?? null,
    [pullRequests, selectedPR],
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

  useEffect(() => {
    if (!repoPath || activeTab !== 'prs') {
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingPRs(true);
      setPrError('');

      try {
        const prs = await window.gitViewer.getPullRequests(repoPath);

        if (!cancelled) {
          setPullRequests(prs);
          const filtered = prFilter === 'all' ? prs : prs.filter((pr) => pr.state === prFilter);
          setPrDiff({ files: [] });
          setSelectedPR(filtered[0]?.number ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPullRequests([]);
          setSelectedPR(null);
          setPrError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar os pull requests. Verifique se o gh CLI está instalado e autenticado.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPRs(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [repoPath, activeTab]);

  useEffect(() => {
    if (!repoPath || selectedPR === null) {
      setPrDiff({ files: [] });
      return;
    }

    let cancelled = false;

    async function run() {
      setLoadingPrDiff(true);
      setPrDiff({ files: [] });

      try {
        const nextDiff = await window.gitViewer.getPullRequestDiff(repoPath, selectedPR!);

        if (!cancelled) {
          setPrDiff(nextDiff);
        }
      } catch {
        if (!cancelled) {
          setPrDiff({ files: [] });
        }
      } finally {
        if (!cancelled) {
          setLoadingPrDiff(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [repoPath, selectedPR]);

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
      {prError ? <div className="error-banner">{prError}</div> : null}

      <nav className="tab-bar">
        <button
          className={`tab-bar__tab ${activeTab === 'git' ? 'tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('git')}
          type="button"
        >
          branches
        </button>
        <button
          className={`tab-bar__tab ${activeTab === 'prs' ? 'tab-bar__tab--active' : ''}`}
          onClick={() => setActiveTab('prs')}
          type="button"
        >
          pull requests
        </button>
      </nav>

      <main className="workspace">
        {activeTab === 'git' ? (
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
        ) : (
        <aside className="sidebar sidebar--prs">
          <section className="stack-panel">
            <div className="stack-panel__header">
              <div>
                <p className="panel__eyebrow">pull requests</p>
                <h2>{filteredPRs.length} de {pullRequests.length}</h2>
              </div>
              {loadingPRs ? <LoadingIndicator label="syncing" /> : null}
            </div>
            <div className="pr-filter-bar">
              {(['all', 'OPEN', 'CLOSED', 'MERGED'] as const).map((filter) => (
                <button
                  key={filter}
                  className={`pr-filter-btn ${prFilter === filter ? 'pr-filter-btn--active' : ''} ${filter !== 'all' ? `pr-filter-btn--${filter.toLowerCase()}` : ''}`}
                  onClick={() => setPrFilter(filter)}
                  type="button"
                >
                  {filter === 'all' ? 'todos' : filter === 'OPEN' ? 'open' : filter === 'CLOSED' ? 'closed' : 'merged'}
                </button>
              ))}
            </div>
            <div className="stack-panel__content stack-panel__content--commits">
              {loadingPRs && pullRequests.length === 0 ? (
                <p className="empty-state">
                  <LoadingIndicator label="carregando pull requests" />
                </p>
              ) : filteredPRs.length === 0 && !loadingPRs ? (
                <p className="empty-state">Nenhum pull request encontrado{prFilter !== 'all' ? ` com status "${prFilter.toLowerCase()}"` : ''}.</p>
              ) : (
                filteredPRs.map((pr) => (
                  <PullRequestCard
                    key={pr.number}
                    pr={pr}
                    active={pr.number === selectedPR}
                    onClick={() => {
                      setPrDiff({ files: [] });
                      setSelectedPR(pr.number);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        </aside>
        )}

        <section className="diff-panel">
          {activeTab === 'git' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="diff-panel__header diff-panel__header--pr">
                <div>
                  <p className="panel__eyebrow">
                    {selectedPRDetails ? `#${selectedPRDetails.number} · ${selectedPRDetails.branch} → ${selectedPRDetails.baseBranch}` : 'pull request'}
                  </p>
                  <h2>{selectedPRDetails?.title || 'Selecione um PR'}</h2>
                </div>
                {selectedPRDetails ? (
                  <div className="pr-header-meta">
                    <span className={`badge badge--pr-state badge--pr-${selectedPRDetails.state.toLowerCase()}`}>
                      {selectedPRDetails.isDraft ? 'draft' : selectedPRDetails.state === 'MERGED' ? 'merged' : selectedPRDetails.state === 'CLOSED' ? 'closed' : 'open'}
                    </span>
                    {selectedPRDetails.reviewDecision ? (
                      <span className={`badge ${getReviewStatusLabel(selectedPRDetails.reviewDecision).className}`}>
                        {getReviewStatusLabel(selectedPRDetails.reviewDecision).label}
                      </span>
                    ) : null}
                    <span className="badge badge--added">+{selectedPRDetails.additions}</span>
                    <span className="badge badge--removed">-{selectedPRDetails.deletions}</span>
                    <div className="diff-summary">
                      <span>{selectedPRDetails.author}</span>
                      <span>{formatRelativeDate(selectedPRDetails.updatedAt)}</span>
                    </div>
                    {loadingPrDiff ? <LoadingIndicator /> : null}
                  </div>
                ) : null}
              </div>
              <div className="diff-panel__content">
                {!selectedPRDetails ? (
                  <p className="empty-state">Escolha um pull request para ver o diff.</p>
                ) : null}
                {selectedPRDetails && loadingPrDiff ? (
                  <p className="empty-state">
                    <LoadingIndicator label="carregando diff do pr" />
                  </p>
                ) : null}
                {selectedPRDetails && !loadingPrDiff && prDiff.files.length === 0 ? (
                  <p className="empty-state">Esse pull request não possui alterações visíveis.</p>
                ) : null}
                {selectedPRDetails && !loadingPrDiff &&
                  prDiff.files.map((file) => <DiffPatch file={file} key={`pr-${selectedPR}-${file.previousPath ?? file.path}-${file.path}`} />)}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
