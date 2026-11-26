import { NextResponse } from 'next/server';
import { COOKIE, tokenFor } from './lib/auth';

export async function middleware(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next(); // no password set: open (fine for demo mode only)
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/health') return NextResponse.next();
  const ok = req.cookies.get(COOKIE)?.value === (await tokenFor(pw));
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/|favicon).*)'] };
