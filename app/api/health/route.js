import { NextResponse } from 'next/server';
import { call, demoMode } from '@/lib/backend';

export const dynamic = 'force-dynamic';

// Public, no partner data: only says whether the Google Sheet backend answers and how many rows it has.
export async function GET() {
  if (demoMode) return NextResponse.json({ ok: true, mode: 'demo' });
  try {
    const d = await call('list');
    return NextResponse.json({ ok: true, mode: 'live', rows: d.rows.length, fields: d.fields?.length ?? null, statuses: d.statuses?.length ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, mode: 'live', error: String(e.message || e).slice(0, 200) }, { status: 502 });
  }
}
