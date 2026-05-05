import { NextResponse } from 'next/server';
import { listBanks } from '@/lib/server/banks';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bank list fetch failed' },
      { status: 500 }
    );
  }
}
