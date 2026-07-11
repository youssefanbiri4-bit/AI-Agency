import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeMode() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) return 'missing';
  return key.startsWith('sk_test_') ? 'test' : key.startsWith('sk_live_') ? 'live' : 'unknown';
}

export function getStripeServerClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    return { stripe: null, error: 'Stripe server key is not configured.' };
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    });
  }

  return { stripe: stripeClient, error: null };
}

export function isStripeCheckoutConfigured() {
  const mode = getStripeMode();

  if (mode === 'live' && process.env.STRIPE_ALLOW_LIVE_MODE !== 'true') {
    return false;
  }

  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.APP_BASE_URL?.trim() &&
      process.env.STRIPE_PRICE_STARTER_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim() &&
      process.env.STRIPE_PRICE_AGENCY_MONTHLY?.trim()
  );
}

export function isStripeWebhookConfigured() {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}
