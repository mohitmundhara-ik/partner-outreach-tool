import { NextResponse } from 'next/server';
import { call } from '@/lib/backend';

export const dynamic = 'force-dynamic';
const ALLOWED = ['list', 'update', 'add', 'draft', 'send', 'followup', 'thread', 'meet', 'sync', 'settings', 'saveTemplate', 'target', 'addTarget'];

export async function POST(req) {
  try {
    const { action, ...payload } = await req.json();
    if (!ALLOWED.includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    const data = await call(action, payload);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
