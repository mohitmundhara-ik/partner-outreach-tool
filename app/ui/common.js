'use client';
import { F, stage, emails, placeholders } from '@/lib/fields';
import { segmentOf, bandsOf, nextAction } from '@/lib/segments';

export const hasEmail = (r) => emails(r[F.to]).length > 0;
export const missing = (r) => placeholders((r[F.subject] || '') + (r[F.body] || ''));
export const isReady = (r) => stage(r[F.status]) === 'new' && hasEmail(r) && !missing(r).length;
export const followUpDue = (r, today) => stage(r[F.status]) === 'sent' && r[F.followUp] && r[F.followUp] <= today;
export const contacted = (r) => !!r[F.sentOn] || ['sent', 'replied', 'call'].includes(stage(r[F.status]));
export const engaged = (r) => ['replied', 'call'].includes(stage(r[F.status]));
export const action = (r, today) => nextAction(r, today, { hasEmail: hasEmail(r), missing: missing(r) });
export const withCurrent = (list, cur) => (cur && !list.includes(cur) ? [...list, cur] : list);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const STAGES = [
  ['new', 'To contact'],
  ['sent', 'Sent'],
  ['replied', 'Replied'],
  ['call', 'Call booked'],
  ['closed', 'Closed'],
];

export function Pill({ status }) {
  return <span className={'pill st-' + stage(status)}>{status || 'Not sent'}</span>;
}

export function Tag({ tone = 'grey', children, title }) {
  return <span className={'tag t-' + tone} title={title}>{children}</span>;
}

export function SegTag({ row }) {
  const s = segmentOf(row);
  return <span className={'seg seg-' + s.key}>{s.short}</span>;
}

export function Bands({ row, max = 3 }) {
  const b = bandsOf(row);
  if (!b.length) return null;
  return <>{b.slice(0, max).map((x) => <span key={x.key} className="band">{x.name}</span>)}</>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <em className="hint">{hint}</em>}
    </label>
  );
}

export function Meter({ value, max, tone }) {
  return <div className="meter"><div className={'meter-fill' + (tone ? ' ' + tone : '')} style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} /></div>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

const P = {
  overview: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  ecosystem: 'M12 2a3 3 0 110 6 3 3 0 010-6zM5 16a3 3 0 110 6 3 3 0 010-6zm14 0a3 3 0 110 6 3 3 0 010-6zM11 8.8V12l-4.6 4.3 1.3 1.4L12 13.7l4.3 4 1.3-1.4L13 12V8.8h-2z',
  audience: 'M16 11a3 3 0 100-6 3 3 0 000 6zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2.1 2.1 2.1 3.9v3h7v-3c0-2.7-5.3-4-8-4z',
  pipeline: 'M3 4h4v16H3V4zm7 0h4v11h-4V4zm7 0h4v7h-4V4z',
  partners: 'M4 5h16v2H4V5zm0 6h16v2H4v-2zm0 6h16v2H4v-2z',
  add: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  sync: 'M12 4V1L8 5l4 4V6a6 6 0 016 6 6 6 0 01-.7 2.8l1.5 1.5A8 8 0 0012 4zm0 14a6 6 0 01-6-6c0-1 .3-2 .7-2.8L5.2 7.7A8 8 0 0012 20v3l4-4-4-4v3z',
  send: 'M2 21l21-9L2 3v7l15 2-15 2v7z',
  draft: 'M3 17.2V21h3.8l11-11-3.8-3.8-11 11zM20.7 7a1 1 0 000-1.4l-2.3-2.3a1 1 0 00-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z',
  close: 'M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1016 9.5a6.5 6.5 0 01-1.6 4.2l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 110-9 4.5 4.5 0 010 9z',
  arrow: 'M8.6 16.6L13.2 12 8.6 7.4 10 6l6 6-6 6z',
  copy: 'M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z',
  bolt: 'M7 2v11h3v9l7-12h-4l4-8z',
  menu: 'M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d={P[name]} fill="currentColor" />
    </svg>
  );
}

export const stageClass = (s) => 'st-' + stage(s);
