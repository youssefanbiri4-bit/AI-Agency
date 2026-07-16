import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAX_SUBSCRIPTIONS = 10;

/**
 * In-memory subscription store.
 * In production, persist to database (e.g. Supabase push_subscriptions table).
 */
const subscriptions = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.endpoint || typeof body.endpoint !== 'string') {
      return NextResponse.json({ error: 'Invalid subscription: missing endpoint' }, { status: 400 });
    }

    if (!body.keys || typeof body.keys.p256dh !== 'string' || typeof body.keys.auth !== 'string') {
      return NextResponse.json({ error: 'Invalid subscription: missing keys' }, { status: 400 });
    }

    subscriptions.set(body.endpoint, body);

    if (subscriptions.size > MAX_SUBSCRIPTIONS) {
      const oldest = subscriptions.keys().next().value;
      if (oldest) subscriptions.delete(oldest);
    }

    return NextResponse.json({ ok: true, count: subscriptions.size });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.endpoint || typeof body.endpoint !== 'string') {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    subscriptions.delete(body.endpoint);

    return NextResponse.json({ ok: true, count: subscriptions.size });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ count: subscriptions.size });
}
