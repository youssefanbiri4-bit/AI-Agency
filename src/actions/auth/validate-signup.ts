'use server';

/**
 * Email allowlist for signup.
 * Only these emails are permitted to create an account.
 * Update this array to add more authorized users.
 */
const SIGNUP_ALLOWLIST: string[] = ['youssefanbiri4@gmail.com'];

export interface ValidateSignupResult {
  allowed: boolean;
  error?: string;
}

/**
 * Validates that the given email is permitted to sign up.
 * Called from the client-side signup page before `supabase.auth.signUp()`.
 *
 * This is a server-side check — it cannot be bypassed by modifying client code.
 *
 * For an additional layer of protection, configure Supabase Auth's built-in
 * email allowlist in the Supabase Dashboard:
 *   Authentication → Settings → General → "Allow email list" or "Allow domains"
 * (only available on Team/Enterprise plans or via Supabase CLI config).
 */
export async function validateSignupEmail(email: string): Promise<ValidateSignupResult> {
  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail) {
    return { allowed: false, error: 'Email is required.' };
  }

  if (!SIGNUP_ALLOWLIST.includes(normalizedEmail)) {
    return {
      allowed: false,
      error:
        'Registration is currently restricted. Only authorized email addresses can create an account. ' +
        'Please contact your administrator.',
    };
  }

  return { allowed: true };
}
