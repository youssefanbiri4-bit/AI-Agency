
if (typeof window !== 'undefined') {
  throw new Error('This module must only run on the server');
}

function readAllowedHosts(): Set<string> {
  const raw = (process.env.N8N_WEBHOOK_HOST_ALLOWLIST ?? '').trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeHostname(hostname: string): string {
  // Remove trailing dot and lowercase; keep as-is otherwise.
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

function extractRedirectLikeTarget(url: URL): string | null {
  // Conservative protection against redirect/callback style query params.
  // Does NOT change any business logic: only rejects when the embedded target is clearly unsafe.
  const candidates = [
    'redirect',
    'redirectUrl',
    'redirect_uri',
    'redirect_uri',
    'next',
    'url',
    'target',
    'dest',
    'destination',
  ];

  for (const key of candidates) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    const trimmed = v.trim();
    if (!trimmed) continue;

    // Only consider absolute URLs; ignore relative paths to avoid false positives.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }

  return null;
}

function isPrivateIPv4(ip: string): boolean {
  // Basic RFC1918 + special-use ranges for SSRF hardening.
  // Includes:
  // - 10.0.0.0/8
  // - 172.16.0.0/12
  // - 192.168.0.0/16
  // - 127.0.0.0/8 loopback
  // - 169.254.0.0/16 link-local
  // - 0.0.0.0/8 "this network"
  const octets = ip.split('.').map((x) => Number(x));
  if (octets.length !== 4 || octets.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = octets;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;

  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

function isLinkLocalIPv4(ip: string): boolean {
  const octets = ip.split('.').map((x) => Number(x));
  if (octets.length !== 4) return false;
  return octets[0] === 169 && octets[1] === 254;
}

function isPrivateIPv6(ip: string): boolean {
  // Minimal private/loopback/link-local IPv6 coverage.
  // - ::1 loopback
  // - fe80::/10 link-local
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe81:') || normalized.startsWith('fe8')) return true;
  return false;
}

function isExplicitLoopbackHostname(hostname: string): boolean {
  // Requirement: explicitly reject localhost variants even if DNS/allowlist changes.
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

async function logSsrFrejection(params: {
  hostname: string | null;
  resolvedIp?: string | null;
  reason: string;
  traceId?: string;
  url?: string;
}) {
  try {
    const { reportAppError } = await import('@/lib/logger');
    reportAppError('SSRF_REJECTION', new Error(params.reason), {
      traceId: params.traceId,
      hostname: params.hostname ?? undefined,
      resolvedIp: params.resolvedIp ?? undefined,
      rejectionReason: params.reason,
      url: params.url,
    });
  } catch {
    // Never fail validation due to logging issues.
  }
}

async function resolveHostnameToIPs(hostname: string): Promise<string[]> {
  // DNS rebinding mitigation:
  // - resolve hostname to IPs at validation time
  // - reject if any resolved IP is private/loopback/link-local
  const dns = await import('dns');
  const res = await dns.promises.lookup(hostname, { all: true });

  // Node's dns.lookup with { all: true } returns array entries with address/type.
  // Example type: Array<{ address: string; family: number; }>.
  return res.map((r: { address: string }) => r.address);
}

export type WebhookUrlValidationResult = {
  ok: boolean;
  normalizedUrl?: string;
  error?: string;
};

export async function validateN8nWebhookUrl(urlString: string): Promise<WebhookUrlValidationResult> {
  // Host allowlist is enforced even for https.
  // Default behavior: if env allowlist is not set, reject all.
  const allowedHosts = readAllowedHosts();
  const isAllowlistConfigured = allowedHosts.size > 0;

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    // structured log best-effort; hostname unknown
    await logSsrFrejection({ hostname: null, reason: 'invalid_url', url: urlString });
    return { ok: false, error: 'invalid_url' };
  }

  // Only HTTPS allowed in production (and we also harden in non-prod).
  if (process.env.NODE_ENV === 'production') {
    if (url.protocol !== 'https:') {
      await logSsrFrejection({
        hostname: url.hostname ?? null,
        reason: 'https_required_in_production',
        url: url.toString(),
      });
      return { ok: false, error: 'https_required_in_production' };
    }
  } else {
    // Still block non-https to avoid SSRF downgrade surfaces.
    if (url.protocol !== 'https:') {
      await logSsrFrejection({ hostname: url.hostname ?? null, reason: 'https_required', url: url.toString() });
      return { ok: false, error: 'https_required' };
    }
  }

  // Hostname normalization
  const hostname = normalizeHostname(url.hostname);

  // Block empty hostnames
  if (!hostname) {
    await logSsrFrejection({ hostname: null, reason: 'missing_hostname', url: url.toString() });
    return { ok: false, error: 'missing_hostname' };
  }

  // Explicit localhost/loopback rejection (requirement)
  if (hostname === 'localhost') {
    await logSsrFrejection({ hostname, reason: 'localhost_blocked', url: url.toString() });
    return { ok: false, error: 'localhost_blocked' };
  }
  if (hostname === '127.0.0.1') {
    await logSsrFrejection({ hostname, reason: 'private_ip_blocked', url: url.toString() });
    return { ok: false, error: 'private_ip_blocked' };
  }
  if (hostname === '::1') {
    await logSsrFrejection({ hostname, reason: 'private_ipv6_blocked', url: url.toString() });
    return { ok: false, error: 'private_ipv6_blocked' };
  }

  // Block IPv4/IPv6 literals directly
  // URL.hostname can be an IP literal, e.g. 127.0.0.1 or [::1]
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    if (isLinkLocalIPv4(hostname)) {
      await logSsrFrejection({
        hostname,
        reason: 'private_or_linklocal_ip_blocked',
        url: url.toString(),
      });
      return { ok: false, error: 'private_or_linklocal_ip_blocked' };
    }
    if (isPrivateIPv4(hostname)) {
      await logSsrFrejection({ hostname, reason: 'private_ip_blocked', url: url.toString() });
      return { ok: false, error: 'private_ip_blocked' };
    }
  }
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    const ip6 = hostname.slice(1, -1);
    if (isPrivateIPv6(ip6)) {
      await logSsrFrejection({ hostname: ip6, reason: 'private_ipv6_blocked', url: url.toString() });
      return { ok: false, error: 'private_ipv6_blocked' };
    }
  }

  // Enforce host allowlist (mitigates SSRF to arbitrary public hosts)
  if (!allowedHosts.has(hostname)) {
    if (!isAllowlistConfigured) {
      await logSsrFrejection({
        hostname,
        reason: 'n8n_webhook_host_allowlist_not_configured',
        url: url.toString(),
      });
      return { ok: false, error: 'n8n_webhook_host_allowlist_not_configured' };
    }
    await logSsrFrejection({ hostname, reason: 'n8n_webhook_host_not_allowed', url: url.toString() });
    return { ok: false, error: 'n8n_webhook_host_not_allowed' };
  }

  // Reject malformed/unsafe redirect targets (conservative)
  const embeddedRedirect = extractRedirectLikeTarget(url);
  if (embeddedRedirect) {
    try {
      const embeddedUrl = new URL(embeddedRedirect);
      const embeddedHostname = normalizeHostname(embeddedUrl.hostname);

      // Only validate embedded HTTPS URLs the same way; if unsafe -> reject.
      const embeddedAllowlistHosts = readAllowedHosts();
      const embeddedIsConfigured = embeddedAllowlistHosts.size > 0;

      if (!embeddedHostname || embeddedUrl.protocol !== 'https:') {
        await logSsrFrejection({
          hostname: embeddedHostname ?? null,
          reason: 'unsafe_redirect_target',
          url: url.toString(),
        });
        return { ok: false, error: 'invalid_url' };
      }
      if (isExplicitLoopbackHostname(embeddedHostname)) {
        await logSsrFrejection({
          hostname: embeddedHostname,
          reason: 'unsafe_redirect_target',
          url: url.toString(),
        });
        return { ok: false, error: 'invalid_url' };
      }
      if (!embeddedIsConfigured || !embeddedAllowlistHosts.has(embeddedHostname)) {
        await logSsrFrejection({
          hostname: embeddedHostname,
          reason: 'unsafe_redirect_target',
          url: url.toString(),
        });
        return { ok: false, error: 'invalid_url' };
      }

      // Also block if embedded target resolves to private/loopback/link-local.
      const resolvedEmbeddedIps = await resolveHostnameToIPs(embeddedHostname);
      for (const ip of resolvedEmbeddedIps) {
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          if (isPrivateIPv4(ip) || isLinkLocalIPv4(ip)) {
            await logSsrFrejection({
              hostname: embeddedHostname,
              resolvedIp: ip,
              reason: 'unsafe_redirect_target',
              url: url.toString(),
            });
            return { ok: false, error: 'invalid_url' };
          }
        } else {
          if (isPrivateIPv6(ip)) {
            await logSsrFrejection({
              hostname: embeddedHostname,
              resolvedIp: ip,
              reason: 'unsafe_redirect_target',
              url: url.toString(),
            });
            return { ok: false, error: 'invalid_url' };
          }
        }
      }
    } catch {
      await logSsrFrejection({ hostname, reason: 'unsafe_redirect_target', url: url.toString() });
      return { ok: false, error: 'invalid_url' };
    }
  }

  // Resolve DNS and block private IPs to mitigate DNS rebinding.
  let lastResolvedIp: string | null = null;
  try {
    const ips = await resolveHostnameToIPs(hostname);

    for (const ip of ips) {
      lastResolvedIp = ip;

      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
        if (isPrivateIPv4(ip) || isLinkLocalIPv4(ip)) {
          await logSsrFrejection({
            hostname,
            resolvedIp: ip,
            reason: 'private_or_linklocal_ip_blocked',
            url: url.toString(),
          });
          return { ok: false, error: 'private_or_linklocal_ip_blocked' };
        }
      } else {
        // IPv6
        if (isPrivateIPv6(ip)) {
          await logSsrFrejection({
            hostname,
            resolvedIp: ip,
            reason: 'private_or_loopback_ipv6_blocked',
            url: url.toString(),
          });
          return { ok: false, error: 'private_or_loopback_ipv6_blocked' };
        }
      }
    }
  } catch {
    // If DNS resolution fails, reject safely.
    await logSsrFrejection({
      hostname,
      resolvedIp: lastResolvedIp,
      reason: 'dns_resolution_failed',
      url: url.toString(),
    });
    return { ok: false, error: 'dns_resolution_failed' };
  }

  // Reject URLs with userinfo (e.g. https://user:pass@host/)
  if (url.username || url.password) {
    await logSsrFrejection({ hostname, reason: 'userinfo_not_allowed', url: url.toString() });
    return { ok: false, error: 'userinfo_not_allowed' };
  }

  // Normalize toString output
  const normalizedUrl = url.toString();

  return { ok: true, normalizedUrl };
}
