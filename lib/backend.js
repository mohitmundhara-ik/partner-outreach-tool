// Server-only. Talks to the Apps Script web app, or runs an in-memory demo when it isn't configured.
import seed from './seed.json';
import { F, FOLLOW_UP_DAYS, emails, placeholders, ymd, addDays, stage } from './fields';

const URL_ = process.env.APPS_SCRIPT_URL;
const TOKEN = process.env.APPS_SCRIPT_TOKEN;

export const demoMode = !URL_;

export async function call(action, payload = {}) {
  if (demoMode) return demo(action, payload);
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: TOKEN, action, ...payload }),
    redirect: 'follow',
    cache: 'no-store',
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('The Google Sheet backend did not answer properly. Check the Apps Script deployment URL and that access is set to "Anyone".');
  }
  if (!json.ok) throw new Error(json.error || 'Backend error');
  return json.data;
}

/* ---------------- Demo mode (sample rows only, nothing is saved, no Gmail) ---------------- */

const g = globalThis;
if (!g.__ikDemo) g.__ikDemo = { rows: seed.rows.map((r) => ({ ...r })), template: seed.template, statuses: seed.statuses };
const db = g.__ikDemo;
const KEYS = Object.keys(F);
const byStage = (st) => db.statuses.find((x) => stage(x) === st);

function demoUpdate(row, fields) {
  const r = db.rows.find((x) => x._row === row);
  if (!r) throw new Error('Bad row ' + row);
  const t = ymd();
  const next = {};
  for (const [k, v] of Object.entries(fields)) if (KEYS.includes(k)) next[k] = String(v);
  const status = next.status ?? r.status;
  if (next.status != null && next.status !== r.status) {
    const st = stage(status);
    if (st === 'sent') {
      if (!r.sentOn && !next.sentOn) next.sentOn = t;
      if (!r.followUp) next.followUp = addDays(next.sentOn || r.sentOn || t, FOLLOW_UP_DAYS);
    } else if (st === 'replied') {
      if (!r.repliedOn) next.repliedOn ||= t;
      next.followUp = '';
    } else if (st === 'call') {
      if (!r.meetingOn) next.meetingOn ||= t;
      next.followUp = '';
    } else if (st !== 'new') next.followUp = '';
  }
  next.updated = t;
  Object.assign(r, next);
  return { ...r };
}

function demo(action, p) {
  switch (action) {
    case 'list':
      return { rows: db.rows.map((r) => ({ ...r })), statuses: db.statuses, template: db.template, today: ymd(), demo: true };
    case 'update':
      return demoUpdate(Number(p.row), p.fields || {});
    case 'add': {
      if (!String(p.fields?.company || '').trim()) throw new Error('Company is required');
      const row = Math.max(1, ...db.rows.map((r) => r._row)) + 1;
      const r = { _row: row };
      for (const k of KEYS) r[k] = String(p.fields[k] ?? '');
      r.status ||= byStage('new') || db.statuses[0];
      r.updated = ymd();
      db.rows.push(r);
      return { ...r };
    }
    case 'draft': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r) throw new Error('Bad row');
      if (!emails(r.to).length) throw new Error('No email address for ' + r.company + '. Use the form link.');
      const left = placeholders(r.subject + r.body);
      if (left.length) throw new Error('The email still has ' + left[0] + '. Fill it in first.');
      return demoUpdate(r._row, { draftedOn: ymd() });
    }
    case 'send': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r) throw new Error('Bad row');
      if (!p.force && stage(r.status) !== 'new') throw new Error(r.company + ' is already "' + r.status + '". Not sent again.');
      if (!emails(r.to).length) throw new Error('No email address for ' + r.company + '. Use the form link.');
      const left = placeholders(r.subject + r.body);
      if (left.length) throw new Error('The email still has ' + left[0] + '. Fill it in first.');
      return demoUpdate(r._row, { status: byStage('sent') || 'Sent', sentOn: ymd() });
    }
    case 'sync':
      return { sent: 0, replied: 0 };
    default:
      throw new Error('Unknown action');
  }
}
