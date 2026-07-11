# MFA Setup — AgentFlow AI

AgentFlow AI uses **Supabase Auth MFA** with **TOTP authenticator apps** (Google Authenticator, 1Password, Authy, etc.).

## 1. Enable MFA in Supabase Dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication → Providers** (or **Authentication → Settings** depending on UI version).
3. Under **Multi-Factor Authentication (MFA)**:
   - Enable **Authenticator app (TOTP)** for **enrollment** and **verification**.
4. Save changes.

> TOTP MFA is available on all Supabase projects. SMS MFA requires Twilio configuration under **Authentication → Phone** and `[auth.mfa.phone]` in `supabase/config.toml`.

### Local / CLI config (already in repo)

`supabase/config.toml`:

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

For hosted Supabase, mirror these settings in the Dashboard. For local `supabase start`, the config file applies automatically.

## 2. User setup flow

1. Sign in as an authorized user (e.g. `youssefanbiri4@gmail.com`).
2. Open **Settings → Security** (`/dashboard/settings#security`).
3. Click **Set up authenticator app**, scan the QR code, enter the 6-digit code.
4. Sign out and sign in again — after password, enter the authenticator code.

## 3. Enforcement layers

| Layer | Behavior |
|-------|----------|
| Login UI | Password step → MFA challenge when enrolled |
| `/auth/mfa` | Standalone verification page for incomplete sessions |
| Middleware | Redirects protected routes to `/auth/mfa` when JWT is `aal1` but `aal2` is required |
| Dashboard layout | Server-side assurance check (defense in depth) |

## 4. Troubleshooting

| Issue | Fix |
|-------|-----|
| `MFA enroll is disabled` | Enable TOTP enroll/verify in Supabase Dashboard |
| Code always invalid | Check device clock sync (TOTP is time-based, 30s window) |
| Redirect loop | Clear cookies, sign in again, complete MFA on `/auth/mfa` |
| SMS MFA | Not enabled by default — configure Twilio + `[auth.mfa.phone]` first |

## 5. Security notes

- MFA enrollment and verification use Supabase session cookies — never expose service role keys to the browser.
- MFA verify attempts are rate-limited via the same brute-force guard as login.
- Disabling MFA calls `unenroll` server-side after verifying the enrolled factor belongs to the signed-in user.