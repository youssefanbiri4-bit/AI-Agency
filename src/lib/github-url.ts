export interface ParsedGitHubRepoUrl {
  owner: string;
  repo: string;
  url: string;
}

function cleanRepoName(value: string) {
  return value.replace(/\.git$/i, '').trim();
}

export function parseGitHubRepoUrl(value: string | null | undefined): ParsedGitHubRepoUrl | null {
  const raw = value?.trim();

  if (!raw) {
    return null;
  }

  const sshMatch = raw.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);

  if (sshMatch) {
    const owner = sshMatch[1]?.trim();
    const repo = cleanRepoName(sshMatch[2] ?? '');

    return owner && repo
      ? {
          owner,
          repo,
          url: `https://github.com/${owner}/${repo}`,
        }
      : null;
  }

  try {
    const url = new URL(raw);

    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      return null;
    }

    const [owner, repo] = url.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => part.trim());

    const cleanRepo = cleanRepoName(repo ?? '');

    return owner && cleanRepo
      ? {
          owner,
          repo: cleanRepo,
          url: `https://github.com/${owner}/${cleanRepo}`,
        }
      : null;
  } catch {
    return null;
  }
}

export function buildGitHubRepoUrl(owner: string | null | undefined, repo: string | null | undefined) {
  const normalizedOwner = owner?.trim();
  const normalizedRepo = repo?.trim();

  if (!normalizedOwner || !normalizedRepo) {
    return null;
  }

  return `https://github.com/${normalizedOwner}/${normalizedRepo}`;
}
