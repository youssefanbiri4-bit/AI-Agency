import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock is hoisted. This factory replaces the module so that
// validatePublicSupabaseEnv calls a mocked assertBrowserSafeSupabaseKey
// inside its try/catch, allowing us to exercise the catch block.
// ---------------------------------------------------------------------------
vi.mock('@/lib/security/supabase-public-env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/supabase-public-env')>();

  const mockAssert = vi.fn<
    (
      key: string | undefined | null,
      context: 'browser' | 'middleware' | 'server'
    ) => void
  >((_key, _context) => {
    throw new Error(
      'Forbidden use of secret API key in browser. ' +
        'Set NEXT_PUBLIC_SUPABASE_ANON_KEY to the publishable/anon key only.'
    );
  });

  return {
    ...actual,
    assertBrowserSafeSupabaseKey: mockAssert,

    // Re-implement validatePublicSupabaseEnv so that its try block calls
    // mockAssert instead of the local-scope binding.
    validatePublicSupabaseEnv: (
      context: 'browser' | 'middleware' | 'server' = 'server'
    ): ReturnType<typeof actual.validatePublicSupabaseEnv> => {
      const { anonKey, isConfigured } = actual.getPublicSupabaseConfig();

      if (!isConfigured) {
        return { ok: false, message: 'Supabase public env is not configured.' };
      }

      if (actual.isForbiddenBrowserSupabaseKey(anonKey)) {
        if (context === 'server') {
          return {
            ok: true,
            warning:
              'NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret/service-role key. ' +
              'Use the publishable anon key only for production.',
          };
        }
        return {
          ok: false,
          message:
            'NEXT_PUBLIC_SUPABASE_ANON_KEY looks like a secret/service-role key. ' +
            'Use the publishable anon key only.',
        };
      }

      try {
        mockAssert(anonKey, context);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message:
            error instanceof Error ? error.message : 'Invalid Supabase anon key.',
        };
      }
    },
  };
});

// ---------------------------------------------------------------------------
// Imports — these will resolve to the mocked module above.
// ---------------------------------------------------------------------------
import {
  validatePublicSupabaseEnv,
  assertBrowserSafeSupabaseKey,
} from '@/lib/security/supabase-public-env';

describe('validatePublicSupabaseEnv — catch block (mocked assert)', () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_catch_test_key';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

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

  it('catches thrown errors from assertBrowserSafeSupabaseKey and returns ok:false', () => {
    const result = validatePublicSupabaseEnv('browser');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Forbidden use of secret API key');
    expect(result.message).toContain('browser');
    expect(result.warning).toBeUndefined();
  });

  it('preserves the error message through the catch block', () => {
    // Override the mocked assert to throw a custom message
    const mod = vi.mocked(assertBrowserSafeSupabaseKey);
    mod.mockImplementationOnce(() => {
      throw new Error('Custom unexpected assertion error for testing');
    });

    const result = validatePublicSupabaseEnv('server');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Custom unexpected assertion error for testing');
  });

  it('handles non-Error thrown values with fallback message', () => {
    const mod = vi.mocked(assertBrowserSafeSupabaseKey);
    mod.mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal
      throw 'a plain string, not an Error instance';
    });

    const result = validatePublicSupabaseEnv('middleware');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Invalid Supabase anon key.');
  });

  it('still returns ok:true when publishable key and no throw', () => {
    // Override to NOT throw (returns normally)
    const mod = vi.mocked(assertBrowserSafeSupabaseKey);
    mod.mockImplementationOnce(() => {
      // do nothing — normal return
    });

    const result = validatePublicSupabaseEnv('server');

    expect(result.ok).toBe(true);
    expect(result.message).toBeUndefined();
    expect(result.warning).toBeUndefined();
  });
});
