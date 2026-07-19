import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer", "puppeteer-core", "pdf-lib"],

  /**
   * Image Optimization
   *
   * Configure remote image domains, device sizes, and caching behavior.
   * Uses modern formats (WebP, AVIF) for optimal delivery.
   */
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  /**
   * Headers
   *
   * Security headers + cache headers for static assets and API routes.
   * Uses stale-while-revalidate for optimal perceived performance.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Content-Security-Policy is set dynamically by Edge Middleware
          // (see src/middleware.ts → dashboard-edge-auth.ts → security-headers.ts).
          // A static CSP here would overwrite the nonce-based CSP and cause
          // hydration mismatches between the server-rendered nonce="" and the
          // browser's CSP header.  All other security headers remain static.
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-Download-Options", value: "noopen" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      // Cache static assets aggressively (immutable, 1 year)
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Fonts (self-hosted via next/font, immutable)
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Static images with stale-while-revalidate
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      // Optimized images from next/image
      {
        source: "/_next/image/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=2592000" },
        ],
      },
      // Static assets (icons, manifest, etc.)
      {
        source: "/:path*.(ico|svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf|otf|json)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      // API routes — short cache with SWR for read-heavy endpoints
      {
        source: "/api/health",
        headers: [
          { key: "Cache-Control", value: "public, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/usage/analytics",
        headers: [
          { key: "Cache-Control", value: "private, max-age=60, stale-while-revalidate=120" },
        ],
      },
      // Billing + insights analytics read endpoints — short private cache with
      // SWR so repeat loads are cheap without serving stale data after writes
      // (caches are invalidated on mutation via clearWorkspaceCaches).
      {
        source: "/api/billing/export",
        headers: [
          { key: "Cache-Control", value: "private, max-age=30, stale-while-revalidate=60" },
        ],
      },
      {
        source: "/api/analytics/insights/export",
        headers: [
          { key: "Cache-Control", value: "private, max-age=30, stale-while-revalidate=60" },
        ],
      },
      // Health probes must never be cached by intermediaries.
      {
        source: "/api/health/live",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/health/ready",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      // Prometheus metrics scrape endpoint — never cache.
      {
        source: "/api/metrics",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      // Dashboard — allow brief browser cache to avoid redundant re-fetches
      {
        source: "/dashboard",
        headers: [
          { key: "Cache-Control", value: "private, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

/**
 * Sentry build integration.
 *
 * `withSentryConfig` hooks into the Next.js production compile to upload
 * source maps to Sentry (enabling readable stack traces) and to set the
 * release. Upload only happens when Sentry credentials are present:
 *   - SENTRY_AUTH_TOKEN  (required for upload)
 *   - SENTRY_ORG, SENTRY_PROJECT
 *   - SENTRY_RELEASE / VERCEL_GIT_COMMIT_SHA (release name)
 *
 * Disable explicitly with: SENTRY_UPLOAD_SOURCEMAPS=false next build
 */
const sentryOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Keep build output quiet; failures must never block the build.
  silent: true,
  sourcemaps: {
    disable: process.env.SENTRY_UPLOAD_SOURCEMAPS === "false",
  },
};

export default withSentryConfig(nextConfig, sentryOptions);
