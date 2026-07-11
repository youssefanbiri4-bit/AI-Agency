#!/usr/bin/env node
/**
 * Verify required release environment variables (names only, never values).
 */

import './load-env-local.mjs';

const REQUIRED_CORE = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'AD_TOKEN_ENCRYPTION_KEY',
  'APP_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
];

const REQUIRED_EXECUTION = [
  'TASK_EXECUTION_ENABLED',
  'N8N_WEBHOOK_URL',
  'N8N_CALLBACK_SECRET',
  'N8N_WEBHOOK_HOST_ALLOWLIST',
];

const REQUIRED_CRON = ['CRON_SECRET'];

const RECOMMENDED_RATE_LIMIT = [
  'RATE_LIMIT_STORE',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

const PRODUCTION_GATE = [
  'PRODUCTION_AUDIT_PASSED',
  'PRODUCTION_AUDIT_DATE',
  'PRODUCTION_AUDIT_COMMIT_SHA',
  'OPERATIONAL_LOG_VISIBILITY_CONFIRMED',
];

function checkGroup(title, keys) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  const present = keys.length - missing.length;
  console.log(`\n${title}: ${present}/${keys.length}`);
  for (const key of keys) {
    console.log(`  ${missing.includes(key) ? '✗' : '✓'} ${key}`);
  }
  return missing;
}

const missingCore = checkGroup('Core (required)', REQUIRED_CORE);
checkGroup('Task execution (required for live n8n)', REQUIRED_EXECUTION);
checkGroup('Cron (required)', REQUIRED_CRON);
checkGroup('Rate limiting (recommended prod)', RECOMMENDED_RATE_LIMIT);
checkGroup('Production gate markers', PRODUCTION_GATE);

if (missingCore.length > 0) {
  console.error('\nMissing required core variables.');
  process.exit(1);
}

console.log('\nCore release variables present in this shell environment.');