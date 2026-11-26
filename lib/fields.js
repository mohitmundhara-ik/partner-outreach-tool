// Canonical field keys. The Apps Script finds each column by its header name.
export const F = Object.fromEntries([
  'company', 'companyType', 'status', 'sentOn', 'to', 'how', 'cc', 'audience', 'subject', 'body', 'form', 'route',
  'source', 'suggested', 'initiative', 'initiativeSource', 'verification', 'overlap', 'notes', 'reply', 'next',
  'draftedOn', 'followUp', 'repliedOn', 'meetingOn', 'updated',
].map((k) => [k, k]));

export const DEFAULT_STATUSES = ['Not sent', 'Sent', 'Replied', 'Call booked', 'Declined', 'Skip'];

/** Maps whatever words the sheet's Status dropdown uses to a stage. */
export function stage(status) {
  const s = String(status || '').trim();
  if (!s || /not\s*sent|^new|to do|pending/i.test(s)) return 'new';
  if (/repl/i.test(s)) return 'replied';
  if (/call|meeting/i.test(s)) return 'call';
  if (/^sent|contacted|emailed|follow/i.test(s)) return 'sent';
  return 'closed';
}
export const FOLLOW_UP_DAYS = 5;
export const BOLD_WORDS = ['Interview Kickstart', '30-minute'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Same HTML the Gmail draft gets: bold words, line breaks kept. */
export function emailHtml(text) {
  let html = esc(text || '');
  for (const w of BOLD_WORDS) html = html.split(esc(w)).join('<b>' + esc(w) + '</b>');
  return html.replace(/\r?\n/g, '<br>');
}

export function emails(s) {
  return String(s || '')
    .split(/[,;\s]+/)
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}

export function placeholders(text) {
  return String(text || '').match(/\[[^\]]+\]/g) || [];
}

/** Fill the master template for a new partner. */
export function fillTemplate(tpl, { company, initiative, name }) {
  const map = {
    '[Company]': company || '[Company]',
    '[specific initiative or offering]': initiative || '[specific initiative or offering]',
    '[Name]': name || '[Name]',
  };
  const fill = (s) => Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), s || '');
  return { subject: fill(tpl?.subject), body: fill(tpl?.body) };
}

export function ymd(d = new Date(), tz = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(ymdStr, n) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
}

export function prettyDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  if (!y) return s;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
