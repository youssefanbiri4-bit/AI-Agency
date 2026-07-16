#!/usr/bin/env node
/**
 * Accessibility Audit Helper
 *
 * USAGE:
 *   node scripts/a11y-audit.mjs                    # List all axe rules
 *   node scripts/a11y-audit.mjs <url>              # Audit a URL (needs Chrome)
 *   node scripts/a11y-audit.mjs --help             # This help
 *
 * REQUIREMENTS:
 *   - axe-core (devDependency, always available)
 *   - Chrome/Chromium + puppeteer-core (for URL auditing)
 *     Set CHROME_PATH env var if Chrome is not at a standard location.
 *     Example: CHROME_PATH=/usr/bin/chromium node scripts/a11y-audit.mjs http://localhost:3000
 *
 * This script NEVER modifies the production bundle.
 */

import { existsSync } from 'fs';
import { createServer } from 'net';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  const help = `
Accessibility Audit Helper
==========================
Commands:
  (no args)     List all axe-core rules with descriptions
  <url>         Run axe audit against a live URL (requires Chrome)

Environment:
  CHROME_PATH   Path to Chrome/Chromium executable (default: auto-detect)
  CI            Set to "true" for non-interactive output (json)

Examples:
  node scripts/a11y-audit.mjs
  CHROME_PATH=/usr/bin/google-chrome node scripts/a11y-audit.mjs http://localhost:3000
  CI=true node scripts/a11y-audit.mjs http://localhost:3000 > a11y-report.json
`;
  console.log(help);
  process.exit(0);
}

async function tryImport(modulePath) {
  try {
    return await import(modulePath);
  } catch {
    return null;
  }
}

function formatRules(rules) {
  const byImpact = { critical: [], serious: [], moderate: [], minor: [] };
  for (const rule of rules) {
    byImpact[rule.impact ?? 'minor'] ??= [];
    byImpact[rule.impact ?? 'minor'].push(rule);
  }

  let output = '';
  for (const impact of ['critical', 'serious', 'moderate', 'minor']) {
    const group = byImpact[impact];
    if (!group?.length) continue;
    output += `\n## ${impact.toUpperCase()} (${group.length})\n\n`;
    for (const rule of group) {
      const tags = (rule.tags ?? []).filter(t => t.startsWith('wcag')).join(', ') || '—';
      output += `- **${rule.ruleId}**: ${rule.description}\n  WCAG: ${tags}\n`;
    }
  }
  return output;
}

async function listRules() {
  const axeMod = await tryImport('axe-core');
  if (!axeMod) {
    console.error('axe-core not installed. Run: npm install --save-dev axe-core');
    process.exit(1);
  }
  const axe = axeMod.default || axeMod;
  const rules = axe.getRules();
  console.log(`# Axe-core Rules (${rules.length} total)\n`);
  console.log(formatRules(rules));
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const path of candidates) {
    if (path && existsSync(path)) {
      return path;
    }
  }
  // Check if puppeteer-core can find one
  try {
    const puppeteerMod = await tryImport('puppeteer-core');
    if (puppeteerMod?.executablePath) {
      const p = puppeteerMod.executablePath();
      if (p && existsSync(p)) return p;
    }
  } catch {}
  return null;
}

async function isServerRunning(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const sock = createServer();
      const client = createServer();
      sock.on('error', () => resolve(false));
      client.connect(u.port, u.hostname, () => {
        client.end();
        sock.close();
        resolve(true);
      });
      client.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function auditUrl(url) {
  const chromePath = await findChrome();
  if (!chromePath) {
    console.error(`
ERROR: Chrome/Chromium not found.

To run URL audits, install Chrome or Chromium and set CHROME_PATH:

  # Ubuntu/Debian:
  sudo apt install chromium-browser

  # macOS (with Homebrew):
  brew install --cask google-chrome

  # Then run:
  CHROME_PATH=/path/to/chrome node scripts/a11y-audit.mjs ${url}
`);
    process.exit(1);
  }

  const puppeteerMod = await tryImport('puppeteer-core');
  if (!puppeteerMod) {
    console.error('puppeteer-core is required. It is already in dependencies.');
    process.exit(1);
  }
  const puppeteer = puppeteerMod.default || puppeteerMod;

  const running = await isServerRunning(url);
  if (!running) {
    console.error(`Server at ${url} is not reachable. Start your dev server first:`);
    console.error('  npm run dev');
    process.exit(1);
  }

  console.error(`Launching Chrome (${chromePath}) to audit ${url}...`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new'],
  });

  let violations, passes, incomplete, inapplicable;
  try {
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Inject axe-core and run
    const axeMod = await tryImport('axe-core');
    const axe = axeMod.default || axeMod;
    await page.evaluate(axe.source);
    const results = await page.evaluate(async () => {
      return await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
    });
    violations = results.violations;
    passes = results.passes;
    incomplete = results.incomplete;
    inapplicable = results.inapplicable;
  } finally {
    await browser.close();
  }

  const impacts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    impacts[v.impact] = (impacts[v.impact] ?? 0) + 1;
  }

  const output = {
    url,
    timestamp: new Date().toISOString(),
    summary: {
      violations: violations.length,
      passes: passes.length,
      incomplete: incomplete.length,
      inapplicable: inapplicable.length,
      byImpact: impacts,
    },
    violations: violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map(n => ({
        html: n.html,
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
  };

  if (process.env.CI === 'true') {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`\n# Accessibility Audit: ${url}\n`);
    console.log(`Date: ${output.timestamp}`);
    console.log(`\n## Summary`);
    console.log(`- Violations: ${output.summary.violations}`);
    console.log(`- Passes: ${output.summary.passes}`);
    console.log(`- Incomplete: ${output.summary.incomplete}`);
    console.log(`- Not applicable: ${output.summary.inapplicable}`);
    console.log(`- By impact: ${JSON.stringify(output.summary.byImpact)}`);
    if (violations.length > 0) {
      console.log(`\n## Violations`);
      for (const v of output.violations) {
        console.log(`\n### ${v.id} (${v.impact})`);
        console.log(`  ${v.description}`);
        console.log(`  Help: ${v.helpUrl}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`  - ${node.html}`);
        }
        if (v.nodes.length > 3) {
          console.log(`  - ... and ${v.nodes.length - 3} more occurrences`);
        }
      }
    }
    console.log(`\nNo violations found!`);

    if (output.summary.violations > 0 && output.summary.byImpact.critical > 0) {
      process.exitCode = 1;
    }
  }
}

async function main() {
  if (args.length === 0 || args[0] === '--list') {
    await listRules();
  } else {
    await auditUrl(args[0]);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
