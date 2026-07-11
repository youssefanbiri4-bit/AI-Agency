import 'server-only';

export function getRequestOrigin(headersList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
  if (!host) {
    return 'http://localhost:3000';
  }

  const protocol = headersList.get('x-forwarded-proto') ?? 'https';
  return `${protocol}://${host}`;
}