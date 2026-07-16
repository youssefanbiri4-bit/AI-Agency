/**
 * Response Cache-Control Helpers (W19-T2)
 *
 * Senior Performance Engineer deliverable.
 *
 * Centralizes Cache-Control string builders so API routes and the Next config
 * agree on CDN / edge caching policy. Intended for read-heavy, non-personalized
 * endpoints; personalized dashboard data should stay `private` + SWR only.
 */

/** Immutable, long-lived (static assets, fonts, generated OG images). */
export function immutableCacheControl(maxAgeSeconds = 31_536_000): string {
  return `public, max-age=${maxAgeSeconds}, immutable`;
}

/** Private browser cache + SWR — safe for per-user read endpoints. */
export function privateSwrCacheControl(maxAgeSeconds = 30, swrSeconds = 60): string {
  return `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`;
}

/** Public edge cache + SWR — only for non-personalized, shared responses. */
export function publicSwrCacheControl(maxAgeSeconds = 60, swrSeconds = 300): string {
  return `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`;
}

/** Never cache (health probes, mutations). */
export function noStoreCacheControl(): string {
  return 'no-store';
}
