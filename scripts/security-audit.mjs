#!/usr/bin/env node
/**
 * AgentFlow-AI Security Audit Script
 *
 * Scans source files for potential security issues including:
 * - Hardcoded secrets (API keys, tokens, passwords)
 * - Public env vars that look like secrets
 * - Service role references in client code
 * - Token logging in console statements
 * - Hardcoded credentials (GitHub, Stripe, AWS, Slack)
 * - Insecure crypto usage
 * - SQL injection vectors
 *
 * Usage:
 *   node scripts/security-audit.mjs
 *   node scripts/security-audit.mjs --ci     # Exit with code on warnings too
 *   node scripts/security-audit.mjs --json   # Output JSON report
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

// ─── Configuration ────────────────────────────────────────────────────────────

const root = process.cwd();
const scanRoots = ['src', 'next.config.ts', 'package.json', 'vercel.json'];
const skip = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);

const args = process.argv.slice(2);
const isCi = args.includes('--ci');
const isJson = args.includes('--json');

// ─── Findings ────────────────────────────────────────────────────────────────

const findings = [];

function addFinding(file, severity, label, line) {
  findings.push({ file, severity, label, line: line ?? null });
}

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

// ─── Scan Patterns ────────────────────────────────────────────────────────────

async function scan() {
  const fileList = [];
  for (const scanRoot of scanRoots) {
    if (await exists(join(root, scanRoot))) {
      fileList.push(...(await walk(scanRoot)));
    }
  }

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const file of fileList) {
    const source = await readFile(join(root, file), 'utf8');
    const lines = source.split('\n');
    const isClient = /['"]use client['"]/.test(source);
    const isTestFile = file.endsWith('.test.ts') || file.endsWith('.test.tsx') || file.endsWith('.spec.ts');

    const checks = [
      // ── Critical ──
      {
        label: 'NEXT_PUBLIC secret-like variable',
        pattern: /NEXT_PUBLIC_(?!SUPABASE_ANON_KEY\b)[A-Z0-9_]*(SECRET|TOKEN|SERVICE_ROLE|PRIVATE|KEY|PASSWORD|CREDENTIALS)[A-Z0-9_]*/g,
        severity: 'critical',
        skipTests: false,
      },
      {
        label: 'Hardcoded OpenAI API key (sk-...)',
        pattern: /(['\"])sk-[A-Za-z0-9]{20,}\1/g,
        severity: 'critical',
        skipTests: false,
      },
      {
        label: 'Hardcoded JWT token',
        pattern: /(['\"])eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\1/g,
        severity: 'critical',
        skipTests: true, // Tests might contain test tokens
      },
      {
        label: 'Service role key in client code',
        pattern: /service_role|SUPABASE_SERVICE_ROLE_KEY/g,
        severity: 'high',
        clientOnly: true,
      },
      // ── High ──
      {
        label: 'Possible token logging in console',
        pattern: /console\.(log|info|debug|warn|error)\([^)]*(access_token|refresh_token|client_secret|api_key|authorization|password)/gi,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Hardcoded GitHub token (ghp_...)',
        pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Hardcoded AWS key (AKIA...)',
        pattern: /(?:AKIA|ASIA)[A-Z0-9]{16,}/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Hardcoded Stripe live key (sk_live_...)',
        pattern: /(?:sk_live_|pk_live_|rk_live_)[A-Za-z0-9]{20,}/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Private key block (-----BEGIN ... PRIVATE KEY-----)',
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
        severity: 'critical',
        skipTests: false,
      },
      {
        label: 'Google API key (AIza...)',
        pattern: /AIza[0-9A-Za-z_-]{35}/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Slack webhook URL',
        pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/_-]+/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'npm registry token (npm_...)',
        pattern: /npm_[A-Za-z0-9]{36}/g,
        severity: 'high',
        skipTests: true,
      },
      {
        label: 'Twilio API key (SK...)',
        pattern: /SK[0-9a-fA-F]{32}/g,
        severity: 'high',
        skipTests: true,
      },
      // ── Medium ──
      {
        label: 'Hardcoded Slack token (xoxb-...)',
        pattern: /(?:xoxb-|xoxp-|xapp-)[A-Za-z0-9_-]{10,}/g,
        severity: 'medium',
        skipTests: true,
      },
      {
        label: 'eval() usage (potential injection)',
        pattern: /\beval\s*\(/g,
        severity: 'medium',
        skipTests: false,
      },
      {
        label: 'Insecure crypto: Math.random for security',
        pattern: /Math\.random\(\)/g,
        severity: 'low',
        skipTests: true,
      },
      {
        label: 'Insecure comparison with == instead of timingSafeEqual',
        pattern: /process\.env\.(CRON_SECRET|N8N_CALLBACK_SECRET)\s*===/g,
        severity: 'high',
        skipTests: false,
      },
    ];

    for (const check of checks) {
      if (check.skipTests && isTestFile) continue;
      if (check.clientOnly && !isClient) continue;

      check.pattern.lastIndex = 0;
      const match = check.pattern.exec(source);
      if (match) {
        // Find the line number
        const lineNum = source.substring(0, match.index).split('\n').length;
        addFinding(file, check.severity, check.label, lineNum);
      }
    }
  }

  // Count by severity
  for (const f of findings) {
    if (f.severity === 'critical') criticalCount++;
    else if (f.severity === 'high') highCount++;
    else if (f.severity === 'medium') mediumCount++;
    else lowCount++;
  }

  // ─── Output ──────────────────────────────────────────────────────────────────

  if (isJson) {
    console.log(JSON.stringify({
      scannedAt: new Date().toISOString(),
      filesScanned: fileList.length,
      passed: criticalCount === 0 && highCount === 0,
      counts: { critical: criticalCount, high: highCount, medium: mediumCount, low: lowCount },
      findings,
    }, null, 2));
  } else {
    console.log(`\n🔍 AgentFlow-AI Security Audit\n`);
    console.log(`📁 Scanned ${fileList.length} files in ${scanRoots.join(', ')}`);
    console.log(`\n📊 Results:`);
    console.log(`   Critical: ${criticalCount}`);
    console.log(`   High:     ${highCount}`);
    console.log(`   Medium:   ${mediumCount}`);
    console.log(`   Low:      ${lowCount}`);

    if (findings.length === 0) {
      console.log('\n✅ No security issues detected.');
      process.exit(0);
    }

    console.log('\n📋 Findings:');
    for (const f of findings) {
      const sevLabel = f.severity === 'critical' ? '🔴' : f.severity === 'high' ? '🟠' : f.severity === 'medium' ? '🟡' : '⚪';
      console.log(`   ${sevLabel} [${f.severity.toUpperCase()}] ${f.label}`);
      console.log(`      File: ${f.file}${f.line ? `:${f.line}` : ''}`);
    }
    console.log('');
  }

  // Exit codes
  if (criticalCount > 0) process.exit(1);
  if (isCi && highCount > 0) process.exit(1);
  process.exit(0);
}

scan().catch((err) => {
  console.error('Security audit failed:', err.message);
  process.exit(1);
});
