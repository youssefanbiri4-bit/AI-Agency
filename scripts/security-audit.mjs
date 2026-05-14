#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const scanRoots = ['src', 'next.config.ts', 'package.json', 'vercel.json'];
const skip = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const findings = [];

function extensionOf(file) {
  const part = file.includes('.') ? `.${file.split('.').pop()}` : '';
  return part;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(path) {
  const absolute = join(root, path);
  const info = await stat(absolute);

  if (info.isFile()) {
    if (extensions.has(extensionOf(path))) return [path];
    return [];
  }

  const files = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && skip.has(entry.name)) continue;
    const child = relative(root, join(absolute, entry.name));
    files.push(...(await walk(child)));
  }
  return files;
}

for (const scanRoot of scanRoots) {
  if (await exists(join(root, scanRoot))) {
    for (const file of await walk(scanRoot)) {
      const source = await readFile(join(root, file), 'utf8');
      const isClient = /['"]use client['"]/.test(source);
      const checks = [
        {
          label: 'NEXT_PUBLIC secret-like variable',
          pattern: /NEXT_PUBLIC_(?!SUPABASE_ANON_KEY\b)[A-Z0-9_]*(SECRET|TOKEN|SERVICE_ROLE|PRIVATE|KEY)[A-Z0-9_]*/g,
          severity: 'critical',
        },
        {
          label: 'service role reference in client file',
          pattern: /service_role|SUPABASE_SERVICE_ROLE_KEY/g,
          severity: 'high',
          clientOnly: true,
        },
        {
          label: 'possible token logging',
          pattern: /console\.(log|info|debug|warn|error)\([^)]*(access_token|refresh_token|client_secret|api_key|authorization|password)/gi,
          severity: 'high',
        },
      ];

      for (const check of checks) {
        if (check.clientOnly && !isClient) continue;
        check.pattern.lastIndex = 0;
        if (check.pattern.test(source)) {
          findings.push({
            file,
            severity: check.severity,
            label: check.label,
          });
        }
      }
    }
  }
}

console.log(`Security audit scanned ${scanRoots.join(', ')}.`);

if (findings.length === 0) {
  console.log('No public secret, client service-role, or token logging patterns detected.');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`${finding.severity.toUpperCase()}: ${finding.label} in ${finding.file}`);
}

process.exit(findings.some((finding) => finding.severity === 'critical') ? 1 : 0);
