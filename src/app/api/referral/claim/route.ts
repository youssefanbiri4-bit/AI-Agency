import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isValidReferralCode, completeReferral } from '@/lib/marketing/referral-service';

const referralLog = logger.child('api:referral');

/**
 * POST /api/referral/claim
 *
 * Completes a referral when a new user signs up with a referral code.
 * Body: { referralCode: string, email?: string, userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode, email, userId } = body;

    if (!referralCode || !isValidReferralCode(referralCode)) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const ok = await completeReferral(referralCode, userId, email);
    if (!ok) {
      return NextResponse.json({ success: false, message: 'Referral not applied' }, { status: 200 });
    }

    referralLog.info('Referral completed', { referralCode, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    referralLog.error('Failed to process referral', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
