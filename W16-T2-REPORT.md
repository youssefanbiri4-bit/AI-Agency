# W16-T2 — Senior Marketing + Growth Engineer: Marketing Automation & Growth

**Status:** ✅ Complete
**Project:** AgentFlow AI (Next.js 16 App Router, React 19, Supabase, Resend, Sentry)
**Scope:** Email campaign system, landing-page A/B testing, full referral system with
rewards, and SEO + social-sharing improvements.

---

## 1. Changes

### 1.1 Email Campaign System (Resend + Templates)
- **`src/lib/marketing/email-service.ts`** (extended, not rewritten):
  - New `CampaignEmailData` + `CampaignType` types and `buildCampaignEmail()` on-brand
    template (headline, body paragraphs, CTA, optional referral link / promo code block).
  - `sendCampaignEmail(to, data, options?)` — sends via the existing Resend client and
    records a `campaign_sent` `marketing_events` row (best-effort analytics).
  - `sendReferralInviteEmail(...)` — convenience wrapper that emails a personalized
    invite containing the shareable referral link.

### 1.2 Landing Page A/B Testing Setup
- **`src/lib/marketing/experiments.ts`** — experiment framework:
  - `EXPERIMENTS` registry (`landing-hero` with A/B variants, 50/50 weights).
  - `assignVariant()` — deterministic, weighted, hash-based sticky assignment.
  - `getExperimentVariant()` — reads sticky cookie or assigns a fresh variant.
  - `trackExperimentExposure()` / `trackExperimentConversion()` → `marketing_events`.
- **`POST /api/marketing/track`** — records experiment exposure/conversion events.
- **`src/components/marketing/HeroExperiment.tsx`** — client component that renders the
  variant copy, persists the sticky `af_ab_*` cookie, and fires the tracking event.
- **`src/app/page.tsx`** — server component now reads the cookie, assigns a variant, and
  renders the A/B hero headline; also adds Organization JSON-LD and switches to the shared
  `generatePageMetadata()` helper.

### 1.3 Referral System — Full Implementation + Rewards
- **Migration `supabase/migrations/20260716000000_referrals_rewards_marketing.sql`**:
  - `referrals` (code, referrer, referred user/email, status, reward_granted, expiry).
  - `referral_rewards` (append-only points ledger).
  - `marketing_events` (generic A/B + campaign analytics sink).
  - RLS policies + indexes.
- **`src/lib/marketing/referral-service.ts`** (rewritten to full impl):
  - `createReferral()`, `getReferralStats()` (live counts + link + points + tier),
    `resolveReferralCode()`, `completeReferral()` (grants reward on signup),
    `grantReward()` / `getRewardBalance()`, `getReferralLeaderboard()`.
  - Reward config: `REWARD_POINTS_PER_REFERRAL = 100`, 4 tiers (Advocate → VIP Partner).
- **`POST /api/referral/claim`** — updated to resolve the referrer and complete the
  referral (granting the reward) using the new service.
- **`src/actions/referrals.ts`** — `loadReferralStatsAction()` now returns stats +
  leaderboard + tiers; new `createReferralLinkAction()`.
- **`src/app/(dashboard)/dashboard/referrals/page.tsx`** — rewritten to show real stats,
  reward points + tier, reward tiers, a workspace leaderboard, link generation, and
  share buttons.
- **`src/app/auth/signup/page.tsx`** — on successful signup with a `?ref=` code, calls
  `/api/referral/claim` to attribute and reward the referral (best-effort).

### 1.4 SEO + Social Sharing Improvements
- **`src/lib/seo/metadata.ts`** `generatePageMetadata()` is now wired into the marketing
  pages: `src/app/page.tsx`, `src/app/features/page.tsx`, `src/app/pricing/page.tsx`,
  `src/app/blog/page.tsx` — giving each canonical URL, OG, Twitter card, and robots.
- **`src/lib/seo/share.ts`** (new) — `buildShareUrl()` (Twitter/LinkedIn/Facebook/email)
  and `buildSocialMetaTags()` helpers for reuse across surfaces.
- **Structured data**: Organization JSON-LD on the home page; Blog JSON-LD on the blog
  list; existing BlogPost Article JSON-LD retained.
- Sitemap (`src/app/sitemap.ts`) already enumerates marketing pages + blog posts.

---

## 2. Verification

- ✅ `npx tsc --noEmit` — **zero errors** across the whole project (includes all W16-T2
  files).
- ✅ `npx eslint` — **0 errors** on all new/changed files (only pre-existing unused-import
  warnings on `features/page.tsx` icons, untouched by this task; 1 unused `maxUses` param
  removed).
- ✅ Secrets scanner — **no new findings** in W16-T2 files (the 1 critical is the
  pre-existing `PushNotificationManager.tsx` false positive, unrelated to this task).
- ⚠️ `npm run build` / Lighthouse still cannot run in this sandbox (offline
  `next/font/google` fetch / no Chromium) — pre-existing environment limitation.
- ⚠️ The DB migration must be applied to a Supabase instance for the referral/reward/AB
  features to persist; the code degrades gracefully (returns empty stats) when the tables
  or admin client are unavailable.

---

## 3. Status

✅ **Complete** — all four deliverables implemented, type-checked, and lint-clean, with
DB schema, API routes, server actions, dashboard UI, and SEO wiring in place.
