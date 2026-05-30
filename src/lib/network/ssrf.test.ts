import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function getValidator() {
  const mod = await import('@/lib/network/ssrf');
  return mod.validateN8nWebhookUrl;
}

describe('validateN8nWebhookUrl SSRF hardening', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs?.();
  });

  it('rejects non-https URLs in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', 'example.com');
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('http://example.com/webhook');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('https_required_in_production');
  });

  it('rejects localhost by hostname even when allowlisted', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', 'localhost');
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://localhost/n8n');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('localhost_blocked');
  });

  it('rejects IPv4 private targets even when allowlisted', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', '127.0.0.1,localhost');
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://127.0.0.1/n8n');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('private_ip_blocked');
  });

  it('rejects link-local 169.254.x.x', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', '169.254.1.10');
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://169.254.1.10/n8n');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('private_or_linklocal_ip_blocked');
  });

  it('rejects when allowlist not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Remove allowlist by stubbing it to empty.
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', '');
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://example.com/n8n');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('n8n_webhook_host_allowlist_not_configured');
  });

  it('rejects if DNS resolves allowlisted hostname to private IPs (DNS rebinding mitigation)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', 'example.com');

    vi.doMock('dns', () => ({
      promises: {
        lookup: vi.fn().mockResolvedValue([{ address: '10.0.0.5' }]),
      },
    }));

    // Re-import after mocking
    vi.resetModules();
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://example.com/n8n');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('private_or_linklocal_ip_blocked');
  });

  it('accepts when DNS resolves allowlisted hostname to public IPs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('N8N_WEBHOOK_HOST_ALLOWLIST', 'example.com');

    vi.doMock('dns', () => ({
      promises: {
        lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34' }]),
      },
    }));

    vi.resetModules();
    const validateN8nWebhookUrl = await getValidator();

    const res = await validateN8nWebhookUrl('https://example.com/n8n');
    expect(res.ok).toBe(true);
    expect(res.normalizedUrl).toContain('https://example.com/n8n');
  });
});
