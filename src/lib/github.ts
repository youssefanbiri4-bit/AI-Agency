import 'server-only';

import { parseGitHubRepoUrl } from '@/lib/github-url';

export type GitHubIntegrationStatus =
  | 'ready'
  | 'setup_required'
  | 'access_error'
  | 'rate_limited'
  | 'error';

export interface GitHubReadiness {
  status: GitHubIntegrationStatus;
  tokenPresent: boolean;
  message: string;
  checkedAt: string;
}

export interface GitHubRepoSnapshot {
  status: GitHubIntegrationStatus;
  message: string;
  checkedAt: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    defaultBranch: string;
    visibility: string | null;
    private: boolean | null;
    language: string | null;
    stars: number | null;
    forks: number | null;
    openIssuesCount: number | null;
    pushedAt: string | null;
    description: string | null;
  } | null;
  commits: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string | null;
    htmlUrl: string;
  }>;
  branches: Array<{
    name: string;
    protected: boolean;
    htmlUrl: string;
  }>;
  issues: Array<{
    number: number;
    title: string;
    state: string;
    labels: string[];
    updatedAt: string;
    htmlUrl: string;
  }>;
  pullRequests: Array<{
    number: number;
    title: string;
    state: string;
    branch: string;
    updatedAt: string;
    htmlUrl: string;
  }>;
}

export interface GitHubRepositoryFile {
  path: string;
  size: number;
  content: string | null;
  skippedReason?: string | null;
}

export interface GitHubIssueItem {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  htmlUrl: string;
  body: string;
  bodyPreview: string;
}

export interface GitHubIssuesResult {
  status: GitHubIntegrationStatus;
  message: string;
  checkedAt: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    openIssuesCount: number | null;
  } | null;
  issues: GitHubIssueItem[];
}

export interface GitHubPullRequestItem {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  body: string;
  bodyPreview: string;
  labels: string[];
  changedFiles: number | null;
  additions: number | null;
  deletions: number | null;
  merged: boolean | null;
}

export interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
  rawUrl: string | null;
}

export interface GitHubPullRequestCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string | null;
  htmlUrl: string;
}

export interface GitHubPullRequestsResult {
  status: GitHubIntegrationStatus;
  message: string;
  checkedAt: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    openPullRequestsCount: number | null;
  } | null;
  pullRequests: GitHubPullRequestItem[];
}

export interface GitHubPullRequestReviewContext {
  status: GitHubIntegrationStatus;
  message: string;
  checkedAt: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    htmlUrl: string;
  } | null;
  pullRequest: GitHubPullRequestItem | null;
  files: GitHubPullRequestFile[];
  commits: GitHubPullRequestCommit[];
  warnings: string[];
  diffTruncated: boolean;
}

type GitHubFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: GitHubIntegrationStatus; message: string };

function getGitHubToken() {
  return process.env.GITHUB_TOKEN?.trim() || null;
}

export function getGitHubReadiness(): GitHubReadiness {
  const tokenPresent = Boolean(getGitHubToken());

  return {
    status: tokenPresent ? 'ready' : 'setup_required',
    tokenPresent,
    checkedAt: new Date().toISOString(),
    message: tokenPresent
      ? 'GITHUB_TOKEN is present server-side. The value is not shown.'
      : 'GitHub setup required. Add a fine-grained read-only GITHUB_TOKEN in Vercel.',
  };
}

function safeMessage(value: unknown, fallback: string) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;

  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/token\s+[A-Za-z0-9._~+/=-]+/gi, 'token [redacted]')
    .replace(/(access_token|client_secret|api_key)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 260);
}

function sanitizeGitHubText(value: unknown, maxLength = 12000) {
  const text = typeof value === 'string' ? value : '';

  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/token\s+[A-Za-z0-9._~+/=-]+/gi, 'token [redacted]')
    .replace(/(access_token|refresh_token|client_secret|api_key|secret|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi, '$1=[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, '[redacted]')
    .slice(0, maxLength);
}

function classifyGitHubError(response: Response, body: unknown): GitHubFetchResult<never> {
  const message =
    body && typeof body === 'object' && 'message' in body
      ? safeMessage((body as { message?: unknown }).message, 'GitHub API request failed.')
      : 'GitHub API request failed.';

  if (response.status === 401 || response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining');

    if (remaining === '0') {
      return {
        ok: false,
        status: 'rate_limited',
        message: 'GitHub API rate limit reached. Try again later.',
      };
    }

    return {
      ok: false,
      status: 'access_error',
      message: 'Repository not found or access denied.',
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      status: 'access_error',
      message: 'Repository not found or access denied.',
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      status: 'rate_limited',
      message: 'GitHub API rate limit reached. Try again later.',
    };
  }

  return {
    ok: false,
    status: 'error',
    message,
  };
}

async function githubFetch<T>(path: string): Promise<GitHubFetchResult<T>> {
  const token = getGitHubToken();

  if (!token) {
    return {
      ok: false,
      status: 'setup_required',
      message: 'GitHub setup required. Add GITHUB_TOKEN in Vercel.',
    };
  }

  try {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      next: {
        revalidate: 120,
      },
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return classifyGitHubError(response, body);
    }

    return {
      ok: true,
      data: body as T,
    };
  } catch {
    return {
      ok: false,
      status: 'error',
      message: 'Could not load repository data from GitHub.',
    };
  }
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

const GITHUB_ANALYZER_MAX_FILE_BYTES = 180_000;
const GITHUB_ANALYZER_TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.html',
  '.yml',
  '.yaml',
  '.toml',
  '.sql',
  '.prisma',
  '.py',
  '.rb',
  '.php',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.vue',
  '.svelte',
]);

function normalizeRepoPath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function repoPathExtension(filePath: string) {
  const normalized = filePath.toLowerCase();

  if (normalized.endsWith('.env.example')) return '.env.example';

  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot) : '';
}

function isSafeAnalyzerRepoPath(filePath: string) {
  const normalized = normalizeRepoPath(filePath);
  const parts = normalized.split('/');
  const ignored = new Set([
    '.git',
    '.next',
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.vercel',
    'venv',
    '.venv',
    '__pycache__',
  ]);

  if (!normalized || normalized.includes('..') || parts.some((part) => ignored.has(part))) return false;

  return !/(^|\/)\.env($|\.local|\.production|\.development|\.test)/i.test(normalized) &&
    !/(^|\/).*(secret|credential|private[-_]?key|service[-_]?account).*\.(json|pem|key|p12)$/i.test(normalized);
}

function isSecretAnalyzerRepoPath(filePath: string) {
  const normalized = normalizeRepoPath(filePath);

  return /(^|\/)\.env($|\.local|\.production|\.development|\.test)/i.test(normalized) ||
    /(^|\/).*(secret|credential|private[-_]?key|service[-_]?account).*\.(json|pem|key|p12)$/i.test(normalized);
}

function isAnalyzerTextFile(filePath: string) {
  const normalized = normalizeRepoPath(filePath);

  return (
    GITHUB_ANALYZER_TEXT_EXTENSIONS.has(repoPathExtension(normalized)) ||
    ['README', 'Dockerfile', 'vercel.json', 'package.json', '.env.example'].some((name) => normalized.endsWith(name))
  );
}

function emptySnapshot(status: GitHubIntegrationStatus, message: string): GitHubRepoSnapshot {
  return {
    status,
    message,
    checkedAt: new Date().toISOString(),
    repo: null,
    commits: [],
    branches: [],
    issues: [],
    pullRequests: [],
  };
}

export async function getGitHubRepositorySnapshot({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch?: string | null;
}): Promise<GitHubRepoSnapshot> {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();

  if (!cleanOwner || !cleanRepo) {
    return emptySnapshot('setup_required', 'Repository owner and name are required.');
  }

  const repoResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`
  );

  if (!repoResult.ok) {
    return emptySnapshot(repoResult.status, repoResult.message);
  }

  const repoData = repoResult.data;
  const defaultBranch = branch?.trim() || readString(repoData.default_branch) || 'main';
  const fullName = readString(repoData.full_name) ?? `${cleanOwner}/${cleanRepo}`;
  const htmlUrl = readString(repoData.html_url) ?? `https://github.com/${cleanOwner}/${cleanRepo}`;
  const [commitsResult, branchesResult, issuesResult, pullsResult] = await Promise.all([
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=5`
    ),
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/branches?per_page=8`
    ),
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/issues?state=open&sort=updated&direction=desc&per_page=8`
    ),
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/pulls?state=open&sort=updated&direction=desc&per_page=5`
    ),
  ]);
  const firstError = [commitsResult, branchesResult, issuesResult, pullsResult].find(
    (result) => !result.ok
  ) as GitHubFetchResult<unknown[]> | undefined;

  return {
    status: firstError && !firstError.ok ? firstError.status : 'ready',
    message: firstError && !firstError.ok ? firstError.message : 'GitHub repository data loaded read-only.',
    checkedAt: new Date().toISOString(),
    repo: {
      owner: cleanOwner,
      name: cleanRepo,
      fullName,
      htmlUrl,
      defaultBranch,
      visibility: readString(repoData.visibility),
      private: readBoolean(repoData.private),
      language: readString(repoData.language),
      stars: readNumber(repoData.stargazers_count),
      forks: readNumber(repoData.forks_count),
      openIssuesCount: readNumber(repoData.open_issues_count),
      pushedAt: readString(repoData.pushed_at),
      description: readString(repoData.description),
    },
    commits: commitsResult.ok
      ? readArray(commitsResult.data).map((entry) => {
          const item = readObject(entry);
          const commit = readObject(item.commit);
          const author = readObject(commit.author);
          const sha = readString(item.sha) ?? '';

          return {
            sha,
            shortSha: sha.slice(0, 7),
            message: readString(commit.message)?.split('\n')[0] ?? 'Commit message unavailable',
            author:
              readString(author.name) ??
              readString(readObject(item.author).login) ??
              'Unknown author',
            date: readString(author.date),
            htmlUrl: readString(item.html_url) ?? `${htmlUrl}/commit/${sha}`,
          };
        })
      : [],
    branches: branchesResult.ok
      ? readArray(branchesResult.data).map((entry) => {
          const item = readObject(entry);
          const name = readString(item.name) ?? 'unknown';

          return {
            name,
            protected: Boolean(item.protected),
            htmlUrl: `${htmlUrl}/tree/${encodeURIComponent(name)}`,
          };
        })
      : [],
    issues: issuesResult.ok
      ? readArray(issuesResult.data)
          .filter((entry) => !('pull_request' in readObject(entry)))
          .slice(0, 5)
          .map((entry) => {
            const item = readObject(entry);

            return {
              number: readNumber(item.number) ?? 0,
              title: readString(item.title) ?? 'Untitled issue',
              state: readString(item.state) ?? 'open',
              labels: readArray(item.labels)
                .map((label) => readString(readObject(label).name))
                .filter((label): label is string => Boolean(label)),
              updatedAt: readString(item.updated_at) ?? '',
              htmlUrl: readString(item.html_url) ?? `${htmlUrl}/issues`,
            };
          })
      : [],
    pullRequests: pullsResult.ok
      ? readArray(pullsResult.data).map((entry) => {
          const item = readObject(entry);

          return {
            number: readNumber(item.number) ?? 0,
            title: readString(item.title) ?? 'Untitled pull request',
            state: readString(item.state) ?? 'open',
            branch: readString(readObject(item.head).ref) ?? 'unknown',
            updatedAt: readString(item.updated_at) ?? '',
            htmlUrl: readString(item.html_url) ?? `${htmlUrl}/pulls`,
          };
        })
      : [],
  };
}

export function parseGitHubProjectUrl(value: string | null | undefined) {
  return parseGitHubRepoUrl(value);
}

function mapGitHubIssue(entry: unknown, repoUrl: string): GitHubIssueItem | null {
  const item = readObject(entry);

  if ('pull_request' in item) {
    return null;
  }

  const number = readNumber(item.number);
  if (!number) return null;

  const body = sanitizeGitHubText(readString(item.body) ?? '');

  return {
    id: readNumber(item.id) ?? number,
    number,
    title: sanitizeGitHubText(readString(item.title) ?? 'Untitled issue', 240),
    state: readString(item.state) === 'closed' ? 'closed' : 'open',
    labels: readArray(item.labels)
      .map((label) => sanitizeGitHubText(readString(readObject(label).name) ?? '', 80))
      .filter(Boolean),
    author: sanitizeGitHubText(readString(readObject(item.user).login) ?? 'unknown', 120),
    createdAt: readString(item.created_at) ?? '',
    updatedAt: readString(item.updated_at) ?? '',
    commentsCount: readNumber(item.comments) ?? 0,
    htmlUrl: readString(item.html_url) ?? `${repoUrl}/issues/${number}`,
    body,
    bodyPreview: body ? `${body.slice(0, 260)}${body.length > 260 ? '...' : ''}` : 'No issue body provided.',
  };
}

function mapGitHubPullRequest(entry: unknown, repoUrl: string): GitHubPullRequestItem | null {
  const item = readObject(entry);
  const number = readNumber(item.number);
  if (!number) return null;
  const body = sanitizeGitHubText(readString(item.body) ?? '');
  const head = readObject(item.head);
  const base = readObject(item.base);

  return {
    id: readNumber(item.id) ?? number,
    number,
    title: sanitizeGitHubText(readString(item.title) ?? 'Untitled pull request', 240),
    state: readString(item.state) === 'closed' ? 'closed' : 'open',
    draft: Boolean(item.draft),
    author: sanitizeGitHubText(readString(readObject(item.user).login) ?? 'unknown', 120),
    sourceBranch: sanitizeGitHubText(readString(head.ref) ?? 'unknown', 180),
    targetBranch: sanitizeGitHubText(readString(base.ref) ?? 'unknown', 180),
    createdAt: readString(item.created_at) ?? '',
    updatedAt: readString(item.updated_at) ?? '',
    htmlUrl: readString(item.html_url) ?? `${repoUrl}/pull/${number}`,
    body,
    bodyPreview: body ? `${body.slice(0, 260)}${body.length > 260 ? '...' : ''}` : 'No PR body provided.',
    labels: readArray(item.labels)
      .map((label) => sanitizeGitHubText(readString(readObject(label).name) ?? '', 80))
      .filter(Boolean),
    changedFiles: readNumber(item.changed_files),
    additions: readNumber(item.additions),
    deletions: readNumber(item.deletions),
    merged: readBoolean(item.merged),
  };
}

function sanitizePatch(value: unknown, maxLength = 2800) {
  const patch = sanitizeGitHubText(value, maxLength);
  if (!patch) return null;
  return patch;
}

function mapGitHubPullRequestFile(entry: unknown): GitHubPullRequestFile {
  const item = readObject(entry);
  const filename = sanitizeGitHubText(readString(item.filename) ?? 'unknown', 300);
  const secretLikeFile = /(^|\/)\.env($|\.|\/)|secret|credential|private[-_]?key|service[-_]?account/i.test(filename);

  return {
    filename,
    status: sanitizeGitHubText(readString(item.status) ?? 'modified', 80),
    additions: readNumber(item.additions) ?? 0,
    deletions: readNumber(item.deletions) ?? 0,
    changes: readNumber(item.changes) ?? 0,
    patch: secretLikeFile ? null : sanitizePatch(item.patch),
    rawUrl: readString(item.raw_url),
  };
}

function mapGitHubPullRequestCommit(entry: unknown): GitHubPullRequestCommit {
  const item = readObject(entry);
  const commit = readObject(item.commit);
  const author = readObject(commit.author);
  const sha = readString(item.sha) ?? '';

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: sanitizeGitHubText(readString(commit.message)?.split('\n')[0] ?? 'Commit message unavailable', 300),
    author: sanitizeGitHubText(readString(author.name) ?? readString(readObject(item.author).login) ?? 'Unknown author', 160),
    date: readString(author.date),
    htmlUrl: readString(item.html_url) ?? '',
  };
}

export async function listGitHubIssues({
  owner,
  repo,
  state = 'open',
  perPage = 30,
}: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  perPage?: number;
}): Promise<GitHubIssuesResult> {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const checkedAt = new Date().toISOString();

  if (!cleanOwner || !cleanRepo) {
    return {
      status: 'setup_required',
      message: 'Repository owner and name are required.',
      checkedAt,
      repo: null,
      issues: [],
    };
  }

  const repoResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`
  );

  if (!repoResult.ok) {
    return {
      status: repoResult.status,
      message: repoResult.message,
      checkedAt,
      repo: null,
      issues: [],
    };
  }

  const repoData = repoResult.data;
  const htmlUrl = readString(repoData.html_url) ?? `https://github.com/${cleanOwner}/${cleanRepo}`;
  const issuesResult = await githubFetch<unknown[]>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/issues?state=${state}&sort=updated&direction=desc&per_page=${Math.min(Math.max(perPage, 1), 50)}`
  );

  if (!issuesResult.ok) {
    return {
      status: issuesResult.status,
      message: issuesResult.message,
      checkedAt,
      repo: {
        owner: cleanOwner,
        name: cleanRepo,
        fullName: readString(repoData.full_name) ?? `${cleanOwner}/${cleanRepo}`,
        htmlUrl,
        openIssuesCount: readNumber(repoData.open_issues_count),
      },
      issues: [],
    };
  }

  return {
    status: 'ready',
    message: 'GitHub issues loaded read-only.',
    checkedAt,
    repo: {
      owner: cleanOwner,
      name: cleanRepo,
      fullName: readString(repoData.full_name) ?? `${cleanOwner}/${cleanRepo}`,
      htmlUrl,
      openIssuesCount: readNumber(repoData.open_issues_count),
    },
    issues: readArray(issuesResult.data)
      .map((entry) => mapGitHubIssue(entry, htmlUrl))
      .filter((issue): issue is GitHubIssueItem => Boolean(issue)),
  };
}

export async function listGitHubPullRequests({
  owner,
  repo,
  state = 'open',
  perPage = 30,
}: {
  owner: string;
  repo: string;
  state?: 'open' | 'closed' | 'all';
  perPage?: number;
}): Promise<GitHubPullRequestsResult> {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const checkedAt = new Date().toISOString();

  if (!cleanOwner || !cleanRepo) {
    return {
      status: 'setup_required',
      message: 'Repository owner and name are required.',
      checkedAt,
      repo: null,
      pullRequests: [],
    };
  }

  const repoResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`
  );

  if (!repoResult.ok) {
    return {
      status: repoResult.status,
      message: repoResult.message,
      checkedAt,
      repo: null,
      pullRequests: [],
    };
  }

  const repoData = repoResult.data;
  const htmlUrl = readString(repoData.html_url) ?? `https://github.com/${cleanOwner}/${cleanRepo}`;
  const pullsResult = await githubFetch<unknown[]>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/pulls?state=${state}&sort=updated&direction=desc&per_page=${Math.min(Math.max(perPage, 1), 50)}`
  );

  if (!pullsResult.ok) {
    return {
      status: pullsResult.status,
      message: pullsResult.message,
      checkedAt,
      repo: {
        owner: cleanOwner,
        name: cleanRepo,
        fullName: readString(repoData.full_name) ?? `${cleanOwner}/${cleanRepo}`,
        htmlUrl,
        openPullRequestsCount: null,
      },
      pullRequests: [],
    };
  }

  return {
    status: 'ready',
    message: 'GitHub pull requests loaded read-only.',
    checkedAt,
    repo: {
      owner: cleanOwner,
      name: cleanRepo,
      fullName: readString(repoData.full_name) ?? `${cleanOwner}/${cleanRepo}`,
      htmlUrl,
      openPullRequestsCount: readArray(pullsResult.data).filter((entry) => readString(readObject(entry).state) === 'open').length,
    },
    pullRequests: readArray(pullsResult.data)
      .map((entry) => mapGitHubPullRequest(entry, htmlUrl))
      .filter((pull): pull is GitHubPullRequestItem => Boolean(pull)),
  };
}

export async function getGitHubPullRequestReviewContext({
  owner,
  repo,
  prNumber,
}: {
  owner: string;
  repo: string;
  prNumber: number;
}): Promise<GitHubPullRequestReviewContext> {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();
  const checkedAt = new Date().toISOString();
  const warnings: string[] = [];

  if (!cleanOwner || !cleanRepo || !prNumber) {
    return {
      status: 'setup_required',
      message: 'Repository and pull request number are required.',
      checkedAt,
      repo: null,
      pullRequest: null,
      files: [],
      commits: [],
      warnings,
      diffTruncated: false,
    };
  }

  const repoResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`
  );

  if (!repoResult.ok) {
    return {
      status: repoResult.status,
      message: repoResult.message,
      checkedAt,
      repo: null,
      pullRequest: null,
      files: [],
      commits: [],
      warnings,
      diffTruncated: false,
    };
  }

  const htmlUrl = readString(repoResult.data.html_url) ?? `https://github.com/${cleanOwner}/${cleanRepo}`;
  const [pullResult, filesResult, commitsResult] = await Promise.all([
    githubFetch<Record<string, unknown>>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/pulls/${prNumber}`
    ),
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/pulls/${prNumber}/files?per_page=80`
    ),
    githubFetch<unknown[]>(
      `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/pulls/${prNumber}/commits?per_page=40`
    ),
  ]);

  const firstError = [pullResult, filesResult, commitsResult].find((result) => !result.ok);
  if (firstError && !firstError.ok) {
    return {
      status: firstError.status,
      message: firstError.message,
      checkedAt,
      repo: {
        owner: cleanOwner,
        name: cleanRepo,
        fullName: readString(repoResult.data.full_name) ?? `${cleanOwner}/${cleanRepo}`,
        htmlUrl,
      },
      pullRequest: null,
      files: [],
      commits: [],
      warnings,
      diffTruncated: false,
    };
  }

  const files = filesResult.ok ? readArray(filesResult.data).map(mapGitHubPullRequestFile) : [];
  const patchCharacters = files.reduce((total, file) => total + (file.patch?.length ?? 0), 0);
  const diffTruncated = patchCharacters > 42_000 || files.length >= 80;

  if (diffTruncated) {
    warnings.push('PR diff is too large for full AI review. Showing summary review only.');
  }

  return {
    status: 'ready',
    message: 'Pull request review context loaded read-only.',
    checkedAt,
    repo: {
      owner: cleanOwner,
      name: cleanRepo,
      fullName: readString(repoResult.data.full_name) ?? `${cleanOwner}/${cleanRepo}`,
      htmlUrl,
    },
    pullRequest: pullResult.ok ? mapGitHubPullRequest(pullResult.data, htmlUrl) : null,
    files,
    commits: commitsResult.ok ? readArray(commitsResult.data).map(mapGitHubPullRequestCommit) : [],
    warnings,
    diffTruncated,
  };
}

export async function getGitHubRepositoryFiles({
  owner,
  repo,
  branch,
  maxFiles = 160,
}: {
  owner: string;
  repo: string;
  branch?: string | null;
  maxFiles?: number;
}): Promise<
  | { ok: true; files: GitHubRepositoryFile[]; checkedAt: string }
  | { ok: false; status: GitHubIntegrationStatus; message: string }
> {
  const cleanOwner = owner.trim();
  const cleanRepo = repo.trim();

  if (!cleanOwner || !cleanRepo) {
    return { ok: false, status: 'setup_required', message: 'Repository owner and name are required.' };
  }

  const repoResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`
  );

  if (!repoResult.ok) {
    return { ok: false, status: repoResult.status, message: repoResult.message };
  }

  const defaultBranch = branch?.trim() || readString(repoResult.data.default_branch) || 'main';
  const treeResult = await githubFetch<Record<string, unknown>>(
    `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`
  );

  if (!treeResult.ok) {
    return { ok: false, status: treeResult.status, message: treeResult.message };
  }

  const tree = readArray(treeResult.data.tree)
    .map((entry) => readObject(entry))
    .filter((entry) => readString(entry.type) === 'blob')
    .map((entry) => ({
      path: normalizeRepoPath(readString(entry.path) ?? ''),
      size: readNumber(entry.size) ?? 0,
    }))
    .filter((entry) => entry.path)
    .slice(0, Math.max(1, maxFiles * 4));
  const selected = tree
    .filter((entry) => isSecretAnalyzerRepoPath(entry.path) || (isSafeAnalyzerRepoPath(entry.path) && isAnalyzerTextFile(entry.path)))
    .slice(0, maxFiles);
  const files = await Promise.all(
    selected.map(async (entry): Promise<GitHubRepositoryFile> => {
      if (isSecretAnalyzerRepoPath(entry.path)) {
        return { path: entry.path, size: entry.size, content: null, skippedReason: 'secret_file' };
      }

      if (entry.size > GITHUB_ANALYZER_MAX_FILE_BYTES) {
        return { path: entry.path, size: entry.size, content: null, skippedReason: 'too_large' };
      }

      const contentResult = await githubFetch<Record<string, unknown>>(
        `/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}/contents/${entry.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(defaultBranch)}`
      );

      if (!contentResult.ok) {
        return { path: entry.path, size: entry.size, content: null, skippedReason: contentResult.status };
      }

      const encoding = readString(contentResult.data.encoding);
      const content = readString(contentResult.data.content);

      if (encoding !== 'base64' || !content) {
        return { path: entry.path, size: entry.size, content: null, skippedReason: 'unreadable' };
      }

      return {
        path: entry.path,
        size: entry.size,
        content: Buffer.from(content.replace(/\s/g, ''), 'base64')
          .subarray(0, GITHUB_ANALYZER_MAX_FILE_BYTES)
          .toString('utf8'),
      };
    })
  );

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    files,
  };
}
