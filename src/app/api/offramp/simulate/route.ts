import { NextRequest, NextResponse } from 'next/server';
import { simulatePayment, isStaging } from '@/lib/server/mavapay';

export const runtime = 'nodejs';

/**
 * Staging-only convenience: tells MavaPay to auto-pay the Lightning invoice
 * for a quote so the demo can end-to-end without funded sats. Refuses to run
 * against production.
 */
export async function POST(req: NextRequest) {
  if (!isStaging()) {
    return NextResponse.json(
      { error: 'Simulation is only available in staging' },
      { status: 403 }
    );
  }

  let body: { quote_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const quoteId = String(body.quote_id || '').trim();
  if (!quoteId) {
    return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
  }

  try {
    const res = await simulatePayment(quoteId);
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Simulation failed' },
      { status: 500 }
    );
  }
}
