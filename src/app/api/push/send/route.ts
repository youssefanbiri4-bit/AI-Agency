import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Push notification send endpoint.
 * Accepts a title, body, and optional URL, and broadcasts to all registered subscriptions.
 *
 * In production, this should be behind admin auth and use a proper
 * push library (web-push) with the VAPID private key.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    const payload = {
      title: body.title,
      body: body.body || 'You have an update.',
      url: body.url || '/dashboard',
      icon: '/icon-512.png',
      badge: '/maskable-192.png',
    };

    /**
     * In production:
     * 1. Fetch all subscriptions from the database
     * 2. For each subscription, use web-push to send:
     *    await webpush.sendNotification(subscription, JSON.stringify(payload));
     * 3. Remove expired/invalid subscriptions (410 Gone responses)
     */

    return NextResponse.json({
      ok: true,
      message: 'Push notification queued',
      payload,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
