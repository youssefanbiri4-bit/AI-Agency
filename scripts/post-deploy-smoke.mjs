#!/usr/bin/env node
/**
 * Post-deploy smoke checks against a live AgentFlow deployment.
 * Usage: node scripts/post-deploy-smoke.mjs [baseUrl]
 */

const baseUrl = (process.argv[2] || process.env.APP_BASE_URL || 'https://agentflow-ai-sigma.vercel.app').replace(/\/+$/, '');

const checks = [];

async function runCheck(name, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    checks.push({ name, ok: true, durationMs: Date.now() - started, ...result });
    console.log(`✓ ${name}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, durationMs: Date.now() - started, error: message });
    console.error(`✗ ${name}: ${message}`);
    return false;
  }
}

async function fetchText(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...init,
    headers: {
      accept: 'text/html,application/json',
      ...(init.headers || {}),
    },
  });

  const body = await response.text();
  return { response, body };
}

async function main() {
  console.log(`Post-deploy smoke: ${baseUrl}`);

  await runCheck('marketing home loads', async () => {
    const { response, body } = await fetchText('/');
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (!body.includes('AgentFlow AI')) throw new Error('missing branding');
    return { status: response.status };
  });

  await runCheck('login page loads', async () => {
    const { response, body } = await fetchText('/auth/login');
    if (!response.ok) throw new Error(`status ${response.status}`);
    if (!body.toLowerCase().includes('sign in')) throw new Error('missing sign-in copy');
    return { status: response.status };
  });

  await runCheck('dashboard redirects unauthenticated users', async () => {
    const { response } = await fetchText('/dashboard');
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error(`expected redirect, got ${response.status}`);
    }
    const location = response.headers.get('location') || '';
    if (!location.includes('/auth/login')) {
      throw new Error(`unexpected redirect: ${location}`);
    }
    return { status: response.status, location };
  });

  await runCheck('health endpoint responds', async () => {
    const { response, body } = await fetchText('/api/health');
    if (response.status === 429) {
      return { status: response.status, note: 'rate-limited but route reachable' };
    }
    if (!response.ok) throw new Error(`status ${response.status}`);
    const payload = JSON.parse(body);
    if (!payload.timestamp && !payload.data?.timestamp) {
      throw new Error('invalid health payload');
    }
    return { status: response.status };
  });

  await runCheck('task execute route is protected', async () => {
    const { response, body } = await fetchText('/api/tasks/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskId: '00000000-0000-0000-0000-000000000000' }),
    });
    if (![401, 403, 400, 429].includes(response.status)) {
      throw new Error(`expected auth/guard failure, got ${response.status}: ${body.slice(0, 120)}`);
    }
    return { status: response.status };
  });

  await runCheck('cron scheduler rejects missing secret', async () => {
    const { response } = await fetchText('/api/cron/content-studio-scheduler', { method: 'GET' });
    if (![401, 403, 405, 429].includes(response.status)) {
      throw new Error(`expected cron guard failure, got ${response.status}`);
    }
    return { status: response.status };
  });

  await runCheck('reports page redirects unauthenticated users', async () => {
    const { response } = await fetchText('/dashboard/reports');
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error(`expected redirect, got ${response.status}`);
    }
    return { status: response.status };
  });

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.length - passed;

  console.log('\nSummary');
  console.log(`Passed: ${passed}/${checks.length}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});