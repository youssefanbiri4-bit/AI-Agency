import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { trackExperimentConversion, trackExperimentExposure } from '@/lib/marketing/experiments';

const mktLog = logger.child('api:marketing:track');

/**
 * POST /api/marketing/track
 *
 * Records a marketing event — currently A/B experiment conversions.
 * Body: { type: 'experiment_conversion' | 'experiment_exposure', experiment, variant, anonymousId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, experiment, variant, anonymousId } = body ?? {};

    if (!experiment || !variant) {
      return NextResponse.json({ error: 'experiment and variant are required' }, { status: 400 });
    }

    if (type === 'experiment_conversion') {
      await trackExperimentConversion(experiment, variant, anonymousId);
    } else if (type === 'experiment_exposure') {
      await trackExperimentExposure(experiment, variant, anonymousId);
    } else {
      return NextResponse.json({ error: 'unsupported event type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    mktLog.error('Failed to track marketing event', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
