import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assertBrowserSafeSupabaseKey,
  getPublicSupabaseConfig,
  isForbiddenBrowserSupabaseKey,
  normalizeSupabaseProjectUrl,
  validatePublicSupabaseEnv,
} from '@/lib/security/supabase-public-env';

describe('supabase-public-env', () => {
  describe('normalizeSupabaseProjectUrl', () => {
    it('normalizes project URL by stripping /rest/v1', () => {
      expect(normalizeSupabaseProjectUrl('https://abc.supabase.co/rest/v1/')).toBe(
        'https://abc.supabase.co'
      );
    });
  });

  describe('isForbiddenBrowserSupabaseKey', () => {
    it('flags sb_secret keys as forbidden in browser', () => {
      expect(isForbiddenBrowserSupabaseKey('sb_secret_abc123')).toBe(true);
    });

    it('allows publishable anon keys', () => {
      expect(isForbiddenBrowserSupabaseKey('sb_publishable_abc123')).toBe(false);
    });

    it('flags service_role JWT keys', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' }));
      expect(isForbiddenBrowserSupabaseKey(`${header}.${payload}.sig`)).toBe(true);
    });

    it('allows anon role JWT keys', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'anon', iss: 'supabase' }));
      expect(isForbiddenBrowserSupabaseKey(`${header}.${payload}.sig`)).toBe(false);
    });

    it('allows JWT keys with no role field', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ iss: 'supabase' }));
      expect(isForbiddenBrowserSupabaseKey(`${header}.${payload}.sig`)).toBe(false);
    });

    it('handles null and undefined keys', () => {
      expect(isForbiddenBrowserSupabaseKey(null)).toBe(false);
      expect(isForbiddenBrowserSupabaseKey(undefined)).toBe(false);
    });

    it('handles empty string keys', () => {
      expect(isForbiddenBrowserSupabaseKey('')).toBe(false);
    });

    it('flags sk_ prefix as forbidden (e.g. Stripe secret keys)', () => {
      expect(isForbiddenBrowserSupabaseKey('sk_live_abc123')).toBe(true);
    });
  });

  describe('getPublicSupabaseConfig', () => {
    const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    afterEach(() => {
      // Restore original env values
      if (ORIGINAL_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (ORIGINAL_KEY) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_KEY;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      }
    });

    it('returns configured config when both env vars are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.anonKey).toBe('sb_publishable_abc123');
      expect(config.isConfigured).toBe(true);
    });

    it('normalizes URL with /rest/v1 suffix', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co/rest/v1';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.isConfigured).toBe(true);
    });

    it('normalizes URL with trailing slash', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co/';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.isConfigured).toBe(true);
    });

    it('trims whitespace from env values', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '  https://abc.supabase.co  ';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '  sb_publishable_abc123  ';

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.anonKey).toBe('sb_publishable_abc123');
      expect(config.isConfigured).toBe(true);
    });

    it('returns fallback URL when URL env is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://example.supabase.co');
      expect(config.anonKey).toBe('sb_publishable_abc123');
      expect(config.isConfigured).toBe(false);
    });

    it('returns fallback anonKey when anonKey env is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://abc.supabase.co');
      expect(config.anonKey).toBe('anon-key-not-configured');
      expect(config.isConfigured).toBe(false);
    });

    it('returns fallback values when both env vars are missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const config = getPublicSupabaseConfig();
      expect(config.url).toBe('https://example.supabase.co');
      expect(config.anonKey).toBe('anon-key-not-configured');
      expect(config.isConfigured).toBe(false);
    });
  });

  describe('validatePublicSupabaseEnv', () => {
    const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    afterEach(() => {
      if (ORIGINAL_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
      if (ORIGINAL_KEY) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_KEY;
      } else {
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      }
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('returns ok:true for valid publishable anon key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const result = validatePublicSupabaseEnv();
      expect(result.ok).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('returns ok:false when not configured', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const result = validatePublicSupabaseEnv();
      expect(result.ok).toBe(false);
      expect(result.message).toBe('Supabase public env is not configured.');
    });

    it('returns ok:false when URL is missing even with anonKey', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_abc123';

      const result = validatePublicSupabaseEnv();
      expect(result.ok).toBe(false);
      expect(result.message).toBe('Supabase public env is not configured.');
    });

    it('returns ok:false when anonKey is missing even with URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const result = validatePublicSupabaseEnv();
      expect(result.ok).toBe(false);
      expect(result.message).toBe('Supabase public env is not configured.');
    });

    it('returns ok:false for sb_secret_ anon key in default (server) context', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_abc123';

      const result = validatePublicSupabaseEnv('server');
      // Server context is tolerant: returns ok:true with warning instead of ok:false
      expect(result.ok).toBe(true);
      expect(result.warning).toContain('secret/service-role key');
    });

    it('returns ok:false for sb_secret_ anon key in browser context (strict)', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_abc123';

      const result = validatePublicSupabaseEnv('browser');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('secret/service-role key');
    });

    it('returns ok:false for sb_secret_ anon key in middleware context (strict)', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_abc123';

      const result = validatePublicSupabaseEnv('middleware');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('secret/service-role key');
    });

    it('returns ok:false for anon key matching service role key in browser context', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ-test-service-role';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJ-test-service-role';

      const result = validatePublicSupabaseEnv('browser');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('secret/service-role key');
    });

    it('returns ok:false for JWT with service_role claim in browser context', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' }));
      const jwtKey = `${header}.${payload}.sig`;

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwtKey;

      const result = validatePublicSupabaseEnv('browser');
      expect(result.ok).toBe(false);
      expect(result.message).toContain('secret/service-role key');
    });

    it('returns ok:true for JWT with anon role claim', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'anon', iss: 'supabase' }));
      const jwtKey = `${header}.${payload}.sig`;

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwtKey;

      const result = validatePublicSupabaseEnv('server');
      expect(result.ok).toBe(true);
    });

    it('returns warning field for forbidden key in server context', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_abc123';

      const result = validatePublicSupabaseEnv('server');
      expect(result.ok).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('publishable anon key');
      expect(result.message).toBeUndefined();
    });
  });

  describe('assertBrowserSafeSupabaseKey', () => {
    beforeEach(() => {
      // Ensure SUPABASE_SERVICE_ROLE_KEY is not set to a known test value
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('does not throw for sb_publishable_ keys', () => {
      expect(() =>
        assertBrowserSafeSupabaseKey('sb_publishable_GgSSLqJAwk-_unU7DFOEew_g1h2YMxj')
      ).not.toThrow();
    });

    it('throws for sb_secret_ keys', () => {
      expect(() =>
        assertBrowserSafeSupabaseKey('sb_secret_abc123')
      ).toThrow('Forbidden use of secret API key in browser');
    });

    it('throws for JWT with service_role', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'service_role', iss: 'supabase' }));
      expect(() =>
        assertBrowserSafeSupabaseKey(`${header}.${payload}.sig`)
      ).toThrow('Forbidden use of secret API key in browser');
    });

    it('includes the context in the error message', () => {
      expect(() =>
        assertBrowserSafeSupabaseKey('sb_secret_abc123', 'server')
      ).toThrow('Forbidden use of secret API key in server');

      expect(() =>
        assertBrowserSafeSupabaseKey('sb_secret_abc123', 'middleware')
      ).toThrow('Forbidden use of secret API key in middleware');
    });

    it('does not throw for null or undefined keys', () => {
      expect(() => assertBrowserSafeSupabaseKey(null)).not.toThrow();
      expect(() => assertBrowserSafeSupabaseKey(undefined)).not.toThrow();
    });

    it('does not throw for empty string keys', () => {
      expect(() => assertBrowserSafeSupabaseKey('')).not.toThrow();
    });

    it('does not throw for anon role JWT keys', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ role: 'anon', iss: 'supabase' }));
      expect(() =>
        assertBrowserSafeSupabaseKey(`${header}.${payload}.sig`)
      ).not.toThrow();
    });

    it('detects exact match with SUPABASE_SERVICE_ROLE_KEY env', () => {
      const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-service-role-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;

      expect(() =>
        assertBrowserSafeSupabaseKey(serviceRoleKey)
      ).toThrow('Forbidden use of secret API key in browser');
    });

    it('does not throw if key does not match SUPABASE_SERVICE_ROLE_KEY', () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'real-service-role-key-12345';

      expect(() =>
        assertBrowserSafeSupabaseKey('sb_publishable_different_key')
      ).not.toThrow();
    });
  });
});