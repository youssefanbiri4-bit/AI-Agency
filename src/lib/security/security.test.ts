import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}));

vi.mock('@/lib/monitoring/metrics', () => ({
  increment: vi.fn(),
  timing: vi.fn(),
}));

vi.mock('@/lib/security-audit-log', () => ({
  logSecurityAuditEvent: vi.fn(async () => undefined),
}));

process.env.AD_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32).toString('base64');

// Fake Supabase client: keeps an in-memory table store.
type Table = Record<string, unknown>;
const tables: Record<string, Table[]> = {};

function makeResult(rows: Table | Table[] | null, error: { message: string } | null = null) {
  return { data: rows, error };
}

type MockRow = Record<string, unknown>;
type WhereFn = (r: MockRow) => boolean;
type Op = 'select' | 'insert' | 'upsert' | 'update' | 'delete' | undefined;

interface MockBuilder {
  _table: string;
  _rows: MockRow[];
  _op: Op;
  _inserted: MockRow | null;
  _patch: MockRow | null;
  _wheres: WhereFn[];
  select: () => MockBuilder;
  insert: (row: MockRow) => MockBuilder;
  upsert: (row: MockRow, opts?: { onConflict?: string }) => MockBuilder;
  update: (patch: MockRow) => MockBuilder;
  delete: () => MockBuilder;
  eq: (col: string, val: unknown) => MockBuilder;
  order: () => MockBuilder;
  limit: () => MockBuilder;
  gte: () => MockBuilder;
  lte: () => MockBuilder;
  then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise<unknown>;
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
}

function makeClient() {
  const from = (table: string) => {
    if (!tables[table]) tables[table] = [];
    const store = tables[table] as MockRow[];
    const builder: MockBuilder = {
      _table: table,
      _rows: [] as MockRow[],
      _op: undefined as Op,
      _inserted: null as MockRow | null,
      _patch: null as MockRow | null,
      _wheres: [] as WhereFn[],
      select() {
        this._rows = [...store];
        if (!this._op || this._op === 'select') this._op = 'select';
        return this;
      },
      insert(row: MockRow) {
        const id = (row.id as string) ?? `${table}-${store.length + 1}`;
        const full = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
        store.push(full);
        this._inserted = full;
        this._op = 'insert';
        return this;
      },
      upsert(row: MockRow, opts?: { onConflict?: string }) {
        const conflictCols = opts?.onConflict?.split(',').map((c) => c.trim()) ?? ['id'];
        const existingIdx = store.findIndex((r) => conflictCols.every((c) => r[c] === row[c]));
        const full: MockRow = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
        if (existingIdx >= 0) {
          store[existingIdx] = { ...store[existingIdx], ...full };
          this._inserted = store[existingIdx];
        } else {
          const id = (row.id as string) ?? `${table}-${store.length + 1}`;
          full.id = id;
          store.push(full);
          this._inserted = full;
        }
        this._op = 'upsert';
        return this;
      },
      update(patch: MockRow) {
        this._patch = patch;
        this._op = 'update';
        this._wheres = [];
        return this;
      },
      delete() {
        this._op = 'delete';
        this._wheres = [];
        return this;
      },
      eq(col: string, val: unknown) {
        this._wheres.push((r) => r[col] === val);
        if (this._op === 'select') {
          this._rows = this._rows.filter((r) => r[col] === val);
        }
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      gte() {
        return this;
      },
      lte() {
        return this;
      },
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
        if (this._op === 'update') {
          const matched = store.filter((r) => this._wheres.every((w) => w(r)));
          if (this._patch) matched.forEach((r) => Object.assign(r, this._patch));
          return Promise.resolve({ data: matched, error: null }).then(resolve, reject);
        }
        if (this._op === 'delete') {
          const matched = store.filter((r) => this._wheres.every((w) => w(r)));
          for (const m of matched) {
            const idx = store.indexOf(m);
            if (idx >= 0) store.splice(idx, 1);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        return Promise.resolve(makeResult(this._rows ?? store)).then(resolve, reject);
      },
      maybeSingle() {
        if (this._op === 'update') {
          const matched = store.filter((r) => this._wheres.every((w) => w(r)));
          if (this._patch) matched.forEach((r) => Object.assign(r, this._patch));
          return Promise.resolve(makeResult(matched[0] ?? null));
        }
        if (this._op === 'delete') {
          const matched = store.filter((r) => this._wheres.every((w) => w(r)));
          for (const m of matched) {
            const idx = store.indexOf(m);
            if (idx >= 0) store.splice(idx, 1);
          }
          return Promise.resolve(makeResult(null));
        }
        const rows = this._rows ?? store;
        return Promise.resolve(makeResult(rows[0] ?? null));
      },
      single() {
        if (this._op === 'update') {
          const matched = store.filter((r) => this._wheres.every((w) => w(r)));
          if (this._patch) matched.forEach((r) => Object.assign(r, this._patch));
          const row = matched[0];
          return Promise.resolve(makeResult(row ?? null, row ? null : { message: 'not found' }));
        }
        const rows = this._rows ?? store;
        const row = this._inserted ?? rows[0];
        return Promise.resolve(makeResult(row ?? null, row ? null : { message: 'not found' }));
      },
    };
    return builder;
  };
  return { from };
}

const client = makeClient();

vi.mock('@/lib/supabase-server', () => ({
  getSupabaseAdmin: () => ({ client, error: null }),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k];
});

describe('audit-advanced: PII redaction', () => {
  it('redacts emails, tokens, and sensitive keys', async () => {
    const { redactPII } = await import('./audit-advanced');
    const out = redactPII({
      user: 'alice@example.com',
      sessionToken: 'abcdef1234567890abcdef1234567890',
      note: 'hello world',
      nested: { password: 'hunter2' },
    });
    expect(out.user).toBe('[email-redacted]');
    expect(out.sessionToken).toBe('[secret-redacted]');
    expect((out.nested as Record<string, unknown>).password).toBe('[secret-redacted]');
    expect(out.note).toBe('hello world');
  });

  it('chains tamper-evident hashes deterministically', async () => {
    const { computeAuditChainHash } = await import('./audit-advanced');
    const h1 = computeAuditChainHash({ a: 1 }, '0'.repeat(64));
    const h2 = computeAuditChainHash({ a: 1 }, '0'.repeat(64));
    expect(h1.hash).toBe(h2.hash);
    expect(h1.hash).toMatch(/^[a-f0-9]{64}$/);
    const h3 = computeAuditChainHash({ a: 2 }, '0'.repeat(64));
    expect(h3.hash).not.toBe(h1.hash);
  });
});

describe('gdpr: consent ledger', () => {
  it('records and lists active consent', async () => {
    const { recordConsent, hasActiveConsent, withdrawConsent, listConsent } = await import('./gdpr');
    const rec = await recordConsent({
      workspaceId: 'ws1',
      userId: 'u1',
      purpose: 'marketing',
      legalBasis: 'consent',
    });
    expect(rec.error).toBeNull();
    expect(rec.data?.granted).toBe(true);

    const active = await hasActiveConsent('ws1', 'u1', 'marketing');
    expect(active.data).toBe(true);

    await withdrawConsent('ws1', 'u1', 'marketing');
    const after = await hasActiveConsent('ws1', 'u1', 'marketing');
    expect(after.data).toBe(false);

    const list = await listConsent('ws1', 'u1');
    expect(list.data?.some((c) => c.purpose === 'marketing' && c.granted === false)).toBe(true);
  });
});

describe('gdpr: data subject requests (erasure)', () => {
  it('creates, fulfils and erases user rows', async () => {
    const { recordConsent, createDataSubjectRequest, fulfilDataSubjectRequest, getDataSubjectRequest } =
      await import('./gdpr');
    await recordConsent({ workspaceId: 'ws1', userId: 'u2', purpose: 'analytics' });

    const req = await createDataSubjectRequest({ workspaceId: 'ws1', userId: 'u2', requestType: 'erasure' });
    expect(req.error).toBeNull();

    const fulfil = await fulfilDataSubjectRequest(req.data!.id, 'ws1', 'admin1');
    expect(fulfil.error).toBeNull();
    expect(fulfil.data?.request.status).toBe('completed');

    const final = await getDataSubjectRequest(req.data!.id);
    expect(final.data?.status).toBe('completed');

    // consent row for u2 should be gone
    const { listConsent } = await import('./gdpr');
    const remaining = await listConsent('ws1', 'u2');
    expect(remaining.data?.length).toBe(0);
  });
});

describe('sso: config + identity validation', () => {
  it('upserts config and validates allowed domains', async () => {
    const { upsertSsoConfig, isSsoIdentityAllowed, getSsoConfig } = await import('./sso');
    const cfg = await upsertSsoConfig({
      workspaceId: 'ws1',
      provider: 'google_workspace',
      enabled: true,
      clientId: 'cid',
      clientSecret: 'supersecret',
      domain: 'acme.com',
      allowedDomains: ['acme.com'],
    });
    expect(cfg.error).toBeNull();
    expect(cfg.data?.enabled).toBe(true);

    const stored = await getSsoConfig('ws1', 'google_workspace');
    expect(stored.data?.clientId).toBe('cid');

    const allowed = await isSsoIdentityAllowed('ws1', 'google_workspace', 'bob@acme.com');
    expect(allowed.data).toBe(true);
    const blocked = await isSsoIdentityAllowed('ws1', 'google_workspace', 'bob@gmail.com');
    expect(blocked.data).toBe(false);
  });

  it('rejects unsupported provider', async () => {
    const { upsertSsoConfig } = await import('./sso');
    const res = await upsertSsoConfig({
      workspaceId: 'ws1',
      // @ts-expect-error testing runtime guard
      provider: 'okta',
      clientId: 'x',
    });
    expect(res.error).toMatch(/Unsupported/);
  });
});

describe('policies: IP allowlist CIDR matching', () => {
  it('matches and rejects IPs against CIDR ranges', async () => {
    const { setSecurityPolicy, evaluateSecurityPolicies } = await import('./policies');
    await setSecurityPolicy({
      workspaceId: 'ws1',
      key: 'ip_allowlist',
      enabled: true,
      config: { cidrs: ['10.0.0.0/8', '192.168.1.0/24'] },
    });
    const inside = await evaluateSecurityPolicies('ws1', { ip: '10.1.2.3' });
    expect(inside.data).not.toContain('ip_not_in_allowlist');
    const inside2 = await evaluateSecurityPolicies('ws1', { ip: '192.168.1.55' });
    expect(inside2.data).not.toContain('ip_not_in_allowlist');
    const outside = await evaluateSecurityPolicies('ws1', { ip: '8.8.8.8' });
    expect(outside.data).toContain('ip_not_in_allowlist');
  });
});

describe('policies: enterprise security', () => {
  it('defaults, sets, and evaluates policies', async () => {
    const { setSecurityPolicy, getSecurityPolicy, evaluateSecurityPolicies, listSecurityPolicies } =
      await import('./policies');

    const def = await getSecurityPolicy('ws1', 'password_min_length');
    expect(def.data?.enabled).toBe(true);
    expect((def.data?.config as Record<string, unknown>).min).toBe(12);

    await setSecurityPolicy({ workspaceId: 'ws1', key: 'block_personal_email_domains', enabled: true });
    const v = await evaluateSecurityPolicies('ws1', { email: 'user@gmail.com' });
    expect(v.data).toContain('personal_email_domain');

    const list = await listSecurityPolicies('ws1');
    expect(list.data?.length).toBeGreaterThan(0);
  });
});

describe('compliance: SOC2 readiness', () => {
  it('seeds controls and reports readiness summary', async () => {
    const { getComplianceReadiness, attestControl } = await import('./compliance');
    const summary1 = await getComplianceReadiness('ws1');
    expect(summary1.error).toBeNull();
    expect(summary1.data?.totalControls).toBeGreaterThan(0);
    expect(summary1.data?.coveragePct).toBe(0);

    await attestControl('ws1', 'CC7.1', 'auditor1', 'audit logs enabled');
    const summary2 = await getComplianceReadiness('ws1');
    expect(summary2.data?.attested).toBe(1);
    expect(summary2.data?.coveragePct).toBeGreaterThan(0);
  });
});
