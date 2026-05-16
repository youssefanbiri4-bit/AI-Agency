export function setupBlockerMessage({
  missing,
  reason,
  next,
}: {
  missing: string;
  reason: string;
  next: string;
}) {
  return `Missing: ${missing}. Blocked because ${reason}. Next: ${next}. / الناقص: ${missing}. السبب: ${reason}. الخطوة التالية: ${next}.`;
}

export function genericServerSetupMessage(area: string) {
  return setupBlockerMessage({
    missing: `${area} server configuration`,
    reason: 'the server could not verify the required production setup safely',
    next: 'review the deployment settings and required migrations, then retry',
  });
}

export function genericProviderSetupMessage(provider: string, next: string) {
  return setupBlockerMessage({
    missing: `${provider} setup`,
    reason: 'the provider cannot be used until env, OAuth, permissions, and account selection are verified',
    next,
  });
}
