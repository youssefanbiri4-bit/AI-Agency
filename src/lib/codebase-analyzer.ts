import 'server-only';

import { inflateRawSync } from 'node:zlib';
import { checkOpenAITextProviderReadiness, getAITextProviderConfig } from '@/lib/ai/text-provider';
import { getGitHubRepositoryFiles, type GitHubRepositoryFile } from '@/lib/github';

export type CodebaseAnalysisSource = 'github' | 'zip' | 'manual';
export type CodebaseFindingPriority = 'critical' | 'high' | 'medium' | 'low';

export interface CodebaseFileInput {
  path: string;
  content: string | null;
  size: number;
  skippedReason?: string | null;
}

export interface CodebaseRouteFinding {
  route: string;
  file: string;
  purpose: string;
  notes: string;
}

export interface CodebaseApiRouteFinding extends CodebaseRouteFinding {
  method: string;
  securityNotes: string;
}

export interface CodebaseFinding {
  priority: CodebaseFindingPriority;
  title: string;
  reason: string;
  area: string;
  nextAction: string;
}

export interface CodebaseAnalysisReport {
  generatedAt: string;
  source: CodebaseAnalysisSource;
  sourceLabel: string;
  aiStatus: 'available' | 'setup_required';
  aiMessage: string;
  summary: string;
  techStack: string[];
  folderStructure: string[];
  routes: CodebaseRouteFinding[];
  apiRoutes: CodebaseApiRouteFinding[];
  database: string[];
  environmentVariables: string[];
  deployment: string[];
  importantComponents: string[];
  securityNotes: string[];
  potentialRisks: CodebaseFinding[];
  missingDocumentation: string[];
  testingChecklist: string[];
  recommendedNextActions: string[];
  releaseNotesDraft: string;
  skippedFiles: string[];
}

const MAX_TEXT_FILE_BYTES = 180_000;
const MAX_TOTAL_FILES = 160;
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const MAX_ZIP_FILE_BYTES = 700_000;
const TEXT_EXTENSIONS = new Set([
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
  '.env.example',
]);

const SECRET_FILE_PATTERNS = [
  /(^|\/)\.env($|\.local|\.production|\.development|\.test)/i,
  /(^|\/).*(secret|credential|private[-_]?key|service[-_]?account).*\.(json|pem|key|p12)$/i,
  /(^|\/)id_rsa$/i,
];

const IGNORED_PATH_PARTS = new Set([
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

function normalizePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

function extensionOf(filePath: string) {
  const normalized = filePath.toLowerCase();

  if (normalized.endsWith('.env.example')) return '.env.example';

  const dot = normalized.lastIndexOf('.');
  return dot >= 0 ? normalized.slice(dot) : '';
}

function isIgnoredPath(filePath: string) {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');

  return (
    normalized.includes('..') ||
    parts.some((part) => IGNORED_PATH_PARTS.has(part)) ||
    SECRET_FILE_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function isSecretPath(filePath: string) {
  return SECRET_FILE_PATTERNS.some((pattern) => pattern.test(normalizePath(filePath)));
}

function looksText(filePath: string) {
  const normalized = normalizePath(filePath);

  return TEXT_EXTENSIONS.has(extensionOf(normalized)) || ['README', 'Dockerfile', 'vercel.json', 'package.json'].some((name) => normalized.endsWith(name));
}

function readJson<T extends Record<string, unknown>>(file: CodebaseFileInput | undefined): T | null {
  if (!file?.content) return null;

  try {
    return JSON.parse(file.content) as T;
  } catch {
    return null;
  }
}

function listTopFolders(files: CodebaseFileInput[]) {
  const folders = new Map<string, number>();

  for (const file of files) {
    const [first, second] = file.path.split('/');
    const key = second ? first : '(root)';
    folders.set(key, (folders.get(key) ?? 0) + 1);
  }

  return [...folders.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([folder, count]) => `${folder} - ${count} tracked file${count === 1 ? '' : 's'}`);
}

function routeFromAppFile(filePath: string) {
  const match = filePath.match(/^(?:src\/)?app\/(.+)\/(?:page|layout)\.(tsx|ts|jsx|js)$/);
  if (!match) return null;

  const route = match[1]
    .replace(/\([^/]+\)\//g, '')
    .replace(/\/?page$/, '')
    .replace(/\/?layout$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1');

  return `/${route === '' ? '' : route}`.replace(/\/+/g, '/');
}

function routeFromPagesFile(filePath: string) {
  const match = filePath.match(/^(?:src\/)?pages\/(.+)\.(tsx|ts|jsx|js)$/);
  if (!match || match[1].startsWith('api/')) return null;

  const route = match[1]
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1');

  return `/${route}`.replace(/\/+/g, '/');
}

function apiRouteFromFile(filePath: string) {
  const appMatch = filePath.match(/^(?:src\/)?app\/(.+)\/route\.(tsx|ts|jsx|js)$/);
  if (appMatch) {
    const route = appMatch[1]
      .replace(/\([^/]+\)\//g, '')
      .replace(/\[([^\]]+)\]/g, ':$1');
    return `/api/${route.replace(/^api\//, '')}`.replace(/\/+/g, '/');
  }

  const pagesMatch = filePath.match(/^(?:src\/)?pages\/api\/(.+)\.(tsx|ts|jsx|js)$/);
  if (pagesMatch) {
    return `/api/${pagesMatch[1].replace(/\/index$/, '').replace(/\[([^\]]+)\]/g, ':$1')}`.replace(/\/+/g, '/');
  }

  return null;
}

function detectMethods(content: string | null) {
  if (!content) return 'Needs review';

  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((method) =>
    new RegExp(`export\\s+async\\s+function\\s+${method}\\b|export\\s+function\\s+${method}\\b`).test(content)
  );

  return methods.length ? methods.join(', ') : 'Needs review';
}

function guessPurpose(filePath: string, content: string | null) {
  const source = `${filePath}\n${content ?? ''}`.toLowerCase();

  if (source.includes('auth')) return 'Authentication or account workflow';
  if (source.includes('dashboard')) return 'Dashboard or internal operations view';
  if (source.includes('project')) return 'Project workspace workflow';
  if (source.includes('content')) return 'Content management workflow';
  if (source.includes('settings')) return 'Configuration or provider setup';
  if (source.includes('report')) return 'Reporting or analytics workflow';
  if (source.includes('webhook')) return 'Webhook endpoint. Needs careful security review.';
  if (source.includes('cron')) return 'Scheduled server endpoint';

  return 'Needs review';
}

function detectEnvVars(files: CodebaseFileInput[]) {
  const envExample = files.find((file) => file.path.endsWith('.env.example'));
  if (!envExample?.content) return [];

  return envExample.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 40);
}

function detectTechStack(files: CodebaseFileInput[]) {
  const paths = new Set(files.map((file) => file.path));
  const packageJson = readJson<Record<string, unknown>>(files.find((file) => file.path.endsWith('package.json')));
  const dependencies = {
    ...((packageJson?.dependencies as Record<string, unknown> | undefined) ?? {}),
    ...((packageJson?.devDependencies as Record<string, unknown> | undefined) ?? {}),
  };
  const stack = new Set<string>();

  if ('next' in dependencies || [...paths].some((path) => path.includes('/app/') || path.startsWith('app/'))) stack.add('Next.js');
  if ('react' in dependencies) stack.add('React');
  if ([...paths].some((path) => path.endsWith('.ts') || path.endsWith('.tsx')) || 'typescript' in dependencies) stack.add('TypeScript');
  if ([...paths].some((path) => path.endsWith('.js') || path.endsWith('.jsx'))) stack.add('JavaScript');
  if ('tailwindcss' in dependencies || [...paths].some((path) => path.includes('tailwind.config'))) stack.add('Tailwind CSS');
  if ([...paths].some((path) => path.includes('components/ui')) || 'class-variance-authority' in dependencies) stack.add('shadcn-style component system');
  if ('@supabase/supabase-js' in dependencies || [...paths].some((path) => path.startsWith('supabase/'))) stack.add('Supabase');
  if ([...paths].some((path) => path.endsWith('schema.prisma'))) stack.add('Prisma');
  if ([...paths].some((path) => path.endsWith('.py')) || paths.has('requirements.txt')) stack.add('Python');
  if ([...paths].some((path) => path.includes('flask')) || 'flask' in dependencies) stack.add('Flask');
  if ([...paths].some((path) => path.toLowerCase().includes('dockerfile') || path.endsWith('docker-compose.yml'))) stack.add('Docker');
  if (paths.has('vercel.json') || 'next' in dependencies) stack.add('Vercel');
  if ([...paths].some((path) => path.includes('openai'))) stack.add('OpenAI provider visible in code');

  return [...stack];
}

function dependencySummary(files: CodebaseFileInput[]) {
  const packageJson = readJson<Record<string, unknown>>(files.find((file) => file.path.endsWith('package.json')));
  const dependencies = packageJson?.dependencies && typeof packageJson.dependencies === 'object'
    ? Object.keys(packageJson.dependencies as Record<string, unknown>)
    : [];
  const devDependencies = packageJson?.devDependencies && typeof packageJson.devDependencies === 'object'
    ? Object.keys(packageJson.devDependencies as Record<string, unknown>)
    : [];

  return [...dependencies.slice(0, 14), ...devDependencies.slice(0, 8)].map((name) => `${name} from package.json`);
}

function buildFindings(files: CodebaseFileInput[], routes: CodebaseRouteFinding[], apiRoutes: CodebaseApiRouteFinding[]) {
  const findings: CodebaseFinding[] = [];
  const paths = files.map((file) => file.path);
  const contentFiles = files.filter((file) => file.content);
  const hasReadme = paths.some((path) => /(^|\/)readme\.md$/i.test(path));
  const hasEnvExample = paths.some((path) => path.endsWith('.env.example'));
  const hasTests = paths.some((path) => /(__tests__|\.test\.|\.spec\.)/.test(path));
  const hasMigrations = paths.some((path) => path.startsWith('supabase/migrations/') || path.endsWith('.sql'));
  const serviceRoleClientUse = contentFiles.some((file) => /NEXT_PUBLIC_[A-Z0-9_]*SERVICE|service_role|SERVICE_ROLE/.test(file.content ?? '') && /\.(tsx|jsx)$/.test(file.path));
  const tokenLogging = contentFiles.some((file) => /console\.(log|error|warn)\([^)]*(token|secret|api[_-]?key|authorization)/i.test(file.content ?? ''));
  const missingAuthApi = apiRoutes.filter((route) => route.securityNotes.includes('Needs auth review')).length;

  if (!hasReadme) {
    findings.push({
      priority: 'medium',
      title: 'README is missing or was not detected',
      area: 'Documentation',
      reason: 'A project README helps future release, onboarding, and deployment reviews.',
      nextAction: 'Generate or add a README with setup, scripts, env examples, and deploy notes.',
    });
  }

  if (!hasEnvExample) {
    findings.push({
      priority: 'high',
      title: '.env.example is missing',
      area: 'Environment',
      reason: 'The analyzer will not read real .env files, so .env.example is the safe source for setup review.',
      nextAction: 'Add a sanitized .env.example with variable names only and no secret values.',
    });
  }

  if (!hasTests) {
    findings.push({
      priority: 'medium',
      title: 'Automated tests were not detected',
      area: 'Testing',
      reason: 'No obvious test files were found in the analyzed file set.',
      nextAction: 'Add focused smoke tests or document manual verification steps before deployment.',
    });
  }

  if (hasMigrations) {
    findings.push({
      priority: 'low',
      title: 'Database migrations require deploy discipline',
      area: 'Database',
      reason: 'Migration files were detected. Production deploys may require applying them before app rollout.',
      nextAction: 'Confirm migrations are applied before running the production build/deploy checklist.',
    });
  }

  if (serviceRoleClientUse) {
    findings.push({
      priority: 'critical',
      title: 'Possible service role reference in client-facing file',
      area: 'Security',
      reason: 'A service role key or service role wording appeared in a TSX/JSX file. Values were not exposed by this analyzer.',
      nextAction: 'Review the file manually and keep service role usage server-side only.',
    });
  }

  if (tokenLogging) {
    findings.push({
      priority: 'high',
      title: 'Possible token or secret logging pattern',
      area: 'Security',
      reason: 'A console statement references token/secret/API key language.',
      nextAction: 'Remove sensitive logging and log only safe status labels.',
    });
  }

  if (missingAuthApi > 0) {
    findings.push({
      priority: 'medium',
      title: `${missingAuthApi} API route${missingAuthApi === 1 ? '' : 's'} need auth review`,
      area: 'API Security',
      reason: 'The analyzer could not clearly verify authentication checks in every API route.',
      nextAction: 'Review each API route for user, workspace, and permission validation.',
    });
  }

  if (routes.length === 0 && apiRoutes.length === 0) {
    findings.push({
      priority: 'low',
      title: 'No routes were detected',
      area: 'Architecture',
      reason: 'The analyzed source may be incomplete, backend-only, or using a framework pattern not recognized yet.',
      nextAction: 'Paste a richer file tree or analyze from GitHub/ZIP for a better route map.',
    });
  }

  return findings;
}

function securityNotes(files: CodebaseFileInput[], apiRoutes: CodebaseApiRouteFinding[]) {
  const notes = [
    'Real .env files, private keys, token files, node_modules, and build artifacts are ignored.',
    'Environment review uses .env.example only when available.',
  ];

  if (apiRoutes.length) {
    notes.push('API routes were checked for obvious auth/workspace validation words, but each route still needs manual review.');
  }

  if (files.some((file) => file.skippedReason === 'secret_file')) {
    notes.push('Potential secret file detected. Contents were not analyzed.');
  }

  return notes;
}

function detectDatabase(files: CodebaseFileInput[]) {
  const migrations = files.filter((file) => file.path.startsWith('supabase/migrations/') || file.path.endsWith('.sql'));
  const prisma = files.find((file) => file.path.endsWith('schema.prisma'));
  const tables = new Set<string>();

  for (const migration of migrations) {
    const content = migration.content ?? '';
    for (const match of content.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?["']?([a-zA-Z0-9_.-]+)/gi)) {
      tables.add(match[1]);
    }
  }

  const database = [
    ...migrations.slice(0, 18).map((file) => `Migration: ${file.path}`),
    ...(prisma ? [`Prisma schema: ${prisma.path}`] : []),
    ...[...tables].slice(0, 20).map((table) => `Detected table: ${table}`),
  ];

  return database.length ? database : ['No database schema or migration files detected in analyzed files.'];
}

function detectDeployment(files: CodebaseFileInput[]) {
  const paths = new Set(files.map((file) => file.path));
  const packageJson = readJson<Record<string, unknown>>(files.find((file) => file.path.endsWith('package.json')));
  const scripts = packageJson?.scripts && typeof packageJson.scripts === 'object'
    ? Object.entries(packageJson.scripts as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`)
    : [];
  const deployment = [
    ...(paths.has('vercel.json') ? ['vercel.json detected for Vercel deployment configuration.'] : []),
    ...(paths.has('Dockerfile') ? ['Dockerfile detected.'] : []),
    ...scripts.filter((script) => /build|lint|test|typecheck|tsc|deploy/i.test(script)).slice(0, 12),
  ];

  return deployment.length ? deployment : ['No deployment scripts or platform config detected in analyzed files.'];
}

function buildReport(input: {
  source: CodebaseAnalysisSource;
  sourceLabel: string;
  files: CodebaseFileInput[];
  manualText?: string;
}) {
  const files = input.files.slice(0, MAX_TOTAL_FILES);
  const packageJson = readJson<Record<string, unknown>>(files.find((file) => file.path.endsWith('package.json')));
  const routes = files
    .map((file) => {
      const route = routeFromAppFile(file.path) ?? routeFromPagesFile(file.path);
      return route
        ? {
            route,
            file: file.path,
            purpose: guessPurpose(file.path, file.content),
            notes: route.includes(':') ? 'Dynamic route detected.' : 'Needs review.',
          }
        : null;
    })
    .filter((route): route is CodebaseRouteFinding => Boolean(route))
    .slice(0, 40);
  const apiRoutes = files
    .map((file) => {
      const route = apiRouteFromFile(file.path);
      const content = file.content ?? '';
      const hasAuthWords = /auth|getUser|workspace|session|membership|require/i.test(content);

      return route
        ? {
            route,
            file: file.path,
            method: detectMethods(file.content),
            purpose: guessPurpose(file.path, file.content),
            notes: route.includes(':') ? 'Dynamic API route detected.' : 'Needs review.',
            securityNotes: hasAuthWords ? 'Auth/workspace validation appears present; verify manually.' : 'Needs auth review.',
          }
        : null;
    })
    .filter((route): route is CodebaseApiRouteFinding => Boolean(route))
    .slice(0, 40);
  const techStack = detectTechStack(files);
  const findings = buildFindings(files, routes, apiRoutes);
  const readiness = [checkOpenAITextProviderReadiness()];
  const providerConfig = getAITextProviderConfig();
  const aiReady = readiness.some((provider) => provider.isReady);
  const appName = typeof packageJson?.name === 'string' ? packageJson.name : input.sourceLabel;
  const docsMissing = [
    ...(!files.some((file) => /readme\.md$/i.test(file.path)) ? ['README setup guide'] : []),
    ...(!files.some((file) => /CHANGELOG|release/i.test(file.path)) ? ['Release or changelog notes'] : []),
    ...(!files.some((file) => file.path.endsWith('.env.example')) ? ['Sanitized .env.example'] : []),
  ];
  const nextActions = findings
    .sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.priority) - ['critical', 'high', 'medium', 'low'].indexOf(b.priority))
    .slice(0, 8)
    .map((finding) => finding.nextAction);
  const checklist = [
    'Run lint locally before deploy.',
    'Run typecheck locally before deploy.',
    'Run production build locally before deploy.',
    'Apply database migrations before production rollout if migrations are present.',
    'Smoke test main routes and API routes after deploy.',
    'Verify no secrets are committed, logged, or pasted into docs/prompts/release notes.',
  ];
  const summary = `${appName} analysis found ${files.length} safe files, ${routes.length} page route${routes.length === 1 ? '' : 's'}, ${apiRoutes.length} API route${apiRoutes.length === 1 ? '' : 's'}, and ${findings.length} recommended finding${findings.length === 1 ? '' : 's'}.`;

  return {
    generatedAt: new Date().toISOString(),
    source: input.source,
    sourceLabel: input.sourceLabel,
    aiStatus: aiReady ? 'available' : 'setup_required',
    aiMessage: aiReady
      ? `AI provider setup is available server-side (${providerConfig.activeProvider}). This report is deterministic and safe to copy.`
      : 'AI provider setup required for deeper narrative analysis. This report uses deterministic file metadata only.',
    summary,
    techStack: techStack.length ? techStack : ['Needs review'],
    folderStructure: listTopFolders(files),
    routes,
    apiRoutes,
    database: detectDatabase(files),
    environmentVariables: detectEnvVars(files),
    deployment: detectDeployment(files),
    importantComponents: [
      ...files.filter((file) => /components\/.*\.(tsx|jsx)$/.test(file.path)).slice(0, 14).map((file) => file.path),
      ...dependencySummary(files),
    ].slice(0, 26),
    securityNotes: securityNotes(files, apiRoutes),
    potentialRisks: findings,
    missingDocumentation: docsMissing.length ? docsMissing : ['No obvious missing documentation from analyzed files.'],
    testingChecklist: checklist,
    recommendedNextActions: nextActions.length ? nextActions : ['Review routes, provider setup, migrations, and deployment checklist before release.'],
    releaseNotesDraft: [
      `Release notes draft for ${appName}`,
      '',
      'Technical summary:',
      `- ${summary}`,
      '',
      'Detected stack:',
      ...((techStack.length ? techStack : ['Needs review']).map((item) => `- ${item}`)),
      '',
      'Recommended follow-ups:',
      ...((nextActions.length ? nextActions : ['Review project manually.']).map((item) => `- ${item}`)),
    ].join('\n'),
    skippedFiles: files.filter((file) => file.skippedReason).map((file) => `${file.path} - ${file.skippedReason}`),
  } satisfies CodebaseAnalysisReport;
}

export function analyzeManualCodebase(input: { text: string; sourceLabel?: string }) {
  const text = input.text.trim();
  const fileTreeFiles: CodebaseFileInput[] = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ''))
    .filter((line) => /^[\w./()[\]@ -]+\.[a-z0-9]+$/i.test(line) || ['package.json', 'vercel.json', 'Dockerfile', 'README.md'].includes(line))
    .slice(0, MAX_TOTAL_FILES)
    .map((line) => ({
      path: normalizePath(line),
      content: null,
      size: 0,
    }));

  const inferredFiles: CodebaseFileInput[] = [...fileTreeFiles];

  if (text.includes('"dependencies"') || text.includes('"scripts"')) {
    inferredFiles.push({ path: 'package.json', content: text, size: text.length });
  }

  if (/create\s+table|alter\s+table/i.test(text)) {
    inferredFiles.push({ path: 'manual/schema.sql', content: text, size: text.length });
  }

  if (inferredFiles.length === 0) {
    inferredFiles.push({ path: 'manual/project-notes.md', content: text, size: text.length });
  }

  return buildReport({
    source: 'manual',
    sourceLabel: input.sourceLabel ?? 'Manual project summary',
    files: inferredFiles,
    manualText: text,
  });
}

export async function analyzeGitHubCodebase(input: {
  owner: string;
  repo: string;
  branch?: string | null;
}) {
  const result = await getGitHubRepositoryFiles({
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    maxFiles: MAX_TOTAL_FILES,
  });

  if (!result.ok) {
    return {
      ok: false as const,
      error: result.message,
      status: result.status,
    };
  }

  return {
    ok: true as const,
    report: buildReport({
      source: 'github',
      sourceLabel: `GitHub: ${input.owner}/${input.repo}`,
      files: result.files.map(githubFileToInput),
    }),
  };
}

function githubFileToInput(file: GitHubRepositoryFile): CodebaseFileInput {
  return {
    path: file.path,
    content: file.content,
    size: file.size,
    skippedReason: file.skippedReason,
  };
}

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const min = Math.max(0, buffer.length - 65_557);

  for (let index = buffer.length - 22; index >= min; index -= 1) {
    if (readUInt32(buffer, index) === 0x06054b50) return index;
  }

  return -1;
}

export async function analyzeZipCodebase(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return { ok: false as const, error: 'Invalid ZIP file. Upload a .zip archive.' };
  }

  if (file.size > MAX_ZIP_BYTES) {
    return { ok: false as const, error: 'ZIP file is too large. Keep uploads under 50MB.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const eocd = findEndOfCentralDirectory(buffer);

  if (eocd < 0) {
    return { ok: false as const, error: 'Invalid ZIP file. Central directory was not found.' };
  }

  const entryCount = readUInt16(buffer, eocd + 10);
  const centralDirectoryOffset = readUInt32(buffer, eocd + 16);
  const files: CodebaseFileInput[] = [];
  let offset = centralDirectoryOffset;

  for (let entryIndex = 0; entryIndex < entryCount && files.length < MAX_TOTAL_FILES && offset < buffer.length; entryIndex += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) break;

    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const rawName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    const safePath = normalizePath(rawName);
    offset += 46 + fileNameLength + extraLength + commentLength;

    if (!safePath || safePath.endsWith('/')) continue;

    if (safePath.includes('..') || safePath.startsWith('/')) {
      files.push({ path: safePath || 'blocked-entry', content: null, size: uncompressedSize, skippedReason: 'blocked_path_traversal' });
      continue;
    }

    if (isSecretPath(safePath)) {
      files.push({ path: safePath, content: null, size: uncompressedSize, skippedReason: 'secret_file' });
      continue;
    }

    if (isIgnoredPath(safePath)) continue;

    if (!looksText(safePath)) {
      files.push({ path: safePath, content: null, size: uncompressedSize, skippedReason: 'binary_or_unsupported' });
      continue;
    }

    if (uncompressedSize > MAX_ZIP_FILE_BYTES || compressedSize > MAX_ZIP_FILE_BYTES) {
      files.push({ path: safePath, content: null, size: uncompressedSize, skippedReason: 'too_large' });
      continue;
    }

    if (readUInt32(buffer, localHeaderOffset) !== 0x04034b50) continue;

    const localFileNameLength = readUInt16(buffer, localHeaderOffset + 26);
    const localExtraLength = readUInt16(buffer, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let content: string | null = null;

    if (method === 0) {
      content = compressed.subarray(0, MAX_TEXT_FILE_BYTES).toString('utf8');
    } else if (method === 8) {
      content = inflateRawSync(compressed).subarray(0, MAX_TEXT_FILE_BYTES).toString('utf8');
    } else {
      files.push({ path: safePath, content: null, size: uncompressedSize, skippedReason: 'unsupported_zip_compression' });
      continue;
    }

    files.push({ path: safePath, content, size: uncompressedSize });
  }

  if (!files.length) {
    return { ok: false as const, error: 'No recognizable code files were found in the ZIP.' };
  }

  return {
    ok: true as const,
    report: buildReport({
      source: 'zip',
      sourceLabel: `ZIP: ${file.name}`,
      files,
    }),
  };
}

export function reportToMarkdown(report: CodebaseAnalysisReport) {
  const lines = [
    `# Codebase Analysis Report`,
    '',
    `Generated: ${report.generatedAt}`,
    `Source: ${report.sourceLabel}`,
    '',
    `## Overview`,
    report.summary,
    '',
    `## Tech Stack`,
    ...report.techStack.map((item) => `- ${item}`),
    '',
    `## Routes`,
    ...(report.routes.length ? report.routes.map((route) => `- ${route.route} - ${route.file} - ${route.purpose}`) : ['- No page routes detected.']),
    '',
    `## API Routes`,
    ...(report.apiRoutes.length ? report.apiRoutes.map((route) => `- ${route.method} ${route.route} - ${route.file} - ${route.securityNotes}`) : ['- No API routes detected.']),
    '',
    `## Database`,
    ...report.database.map((item) => `- ${item}`),
    '',
    `## Security Notes`,
    ...report.securityNotes.map((item) => `- ${item}`),
    '',
    `## Potential Risks`,
    ...report.potentialRisks.map((finding) => `- [${finding.priority}] ${finding.title}: ${finding.reason}`),
    '',
    `## Testing Checklist`,
    ...report.testingChecklist.map((item) => `- [ ] ${item}`),
    '',
    `## Next Actions`,
    ...report.recommendedNextActions.map((item) => `- ${item}`),
  ];

  return lines.join('\n');
}
