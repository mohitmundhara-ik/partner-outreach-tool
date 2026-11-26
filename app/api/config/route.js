import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Behind the app password (middleware). Tells the page whether to talk to the Google Sheet
// backend from the browser (needed when the Apps Script only allows your company's accounts).
export async function GET() {
  const url = process.env.APPS_SCRIPT_URL || '';
  const browser = process.env.APPS_SCRIPT_MODE === 'browser' || (process.env.APPS_SCRIPT_MODE !== 'server' && url.includes('/a/macros/'));
  if (!url || !browser) return NextResponse.json({ browser: false });
  return NextResponse.json({ browser: true, url, token: process.env.APPS_SCRIPT_TOKEN || '' });
}
