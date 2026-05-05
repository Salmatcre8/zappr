import { NextRequest, NextResponse } from 'next/server';
import { getTransactionStatus } from '@/lib/server/mavapay';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order_id');
  if (!orderId) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }
  try {
    const status = await getTransactionStatus(orderId);
    return NextResponse.json({
      order_id: orderId,
      status: status.status,
      raw: status,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Status fetch failed' },
      { status: 500 }
    );
  }
}
