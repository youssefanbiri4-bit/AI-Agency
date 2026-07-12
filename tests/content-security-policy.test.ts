import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '@/lib/security/content-security-policy';

describe('content-security-policy', () => {
  it('allows Next.js inline scripts and styles', () => {
    const csp = buildContentSecurityPolicy();

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });

  it('injects nonce into script-src when provided', () => {
    const csp = buildContentSecurityPolicy('abc123');
    expect(csp).toContain('nonce-abc123');
    expect(csp).toContain('strict-dynamic');
  });

  it('falls back to unsafe-inline when no nonce is provided', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).not.toContain('strict-dynamic');
    expect(csp).not.toContain('nonce-');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it('allows images and fonts required by the app', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("font-src 'self' data:");
  });

  it('excludes report-uri and report-to directives until endpoint is implemented', () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).not.toContain('report-uri');
    expect(csp).not.toContain('report-to');
  });
});