// Server-only. Talks to the Apps Script web app, or runs an in-memory demo when it isn't configured.
import seed from './seed.json';
import { F, FOLLOW_UP_DAYS, SECOND_FOLLOW_UP_DAYS, MAX_FOLLOW_UPS, emails, placeholders, ymd, addDays, stage } from './fields';

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
if (!g.__ikDemo) {
  g.__ikDemo = {
    rows: seed.rows.map((r) => ({ ...r })), template: { ...seed.template, followUp1: '', followUp2: '' }, statuses: seed.statuses,
    targets: (seed.targets || []).map((t, i) => ({ ...t, _row: i + 2 })),
    settings: { cap: 30, sentToday: 0, hubUrl: '', linkBase: 'https://interviewkickstart.com/in', goal: 10, syncOn: false, briefOn: false, lastAutoSync: '', me: 'you@example.com' },
  };
}
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
      return { rows: db.rows.map((r) => ({ ...r })), statuses: db.statuses, template: db.template, today: ymd(), demo: true, settings: { ...db.settings }, targets: db.targets.map((t) => ({ ...t })) };
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
      if (db.settings.sentToday >= db.settings.cap) throw new Error('Daily send cap reached');
      db.settings.sentToday++;
      return { ...demoUpdate(r._row, { status: byStage('sent') || 'Sent', sentOn: ymd(), followUps: '0' }), _sentFrom: 'new' };
    }
    case 'followup': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r) throw new Error('Bad row');
      if (stage(r.status) !== 'sent') throw new Error('Follow-ups go only to partners in Sent who have not replied.');
      const n = (Number(r.followUps) || 0) + 1;
      if (n > MAX_FOLLOW_UPS) throw new Error('Already sent ' + MAX_FOLLOW_UPS + ' follow-ups.');
      if (!String(p.text || '').trim()) throw new Error('The follow-up text is empty.');
      const left = placeholders(p.text);
      if (left.length) throw new Error('The follow-up still has ' + left[0] + '. Fill it in first.');
      db.settings.sentToday++;
      return { ...demoUpdate(r._row, { followUps: String(n), lastFollowUp: ymd(), followUp: n < MAX_FOLLOW_UPS ? addDays(ymd(), SECOND_FOLLOW_UP_DAYS) : '' }), _inThread: true };
    }
    case 'reply': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r) throw new Error('Bad row');
      if (/^skip/i.test(r.status || '')) throw new Error(r.company + ' is marked Skip. It is never emailed.');
      if (!r.sentOn && !r.repliedOn) throw new Error('No Gmail thread with ' + r.company + ' in this mailbox. Reply from Gmail this time.');
      const to = emails(r.to);
      const who = { to, cc: emails(r.cc), subject: 'Re: ' + (r.subject || ''), lastFrom: to[0] || '', lastDate: new Date().toISOString(), url: 'https://mail.google.com/' };
      if ((p.mode || 'preview') === 'preview') return who;
      if (!String(p.text || '').trim()) throw new Error('The reply is empty.');
      const left = placeholders(p.text);
      if (left.length) throw new Error('The reply still has ' + left[0] + '. Fill it in first.');
      if (p.mode === 'send') db.settings.sentToday++;
      const f = p.mode === 'send' ? { replyDraft: '', lastReplySent: ymd() } : { replyDraft: String(p.text) };
      return { ...demoUpdate(r._row, f), _reply: { mode: p.mode, ...who } };
    }
    case 'thread': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r || !r.sentOn) return { messages: [], url: '' };
      const at = (d, h) => new Date(d + 'T' + h + ':00+05:30').toISOString();
      const msgs = [{ from: 'Mohit <you@example.com>', to: r.to, cc: r.cc || '', date: at(r.sentOn, '10:12'), subject: r.subject, mine: true, bounce: false, text: r.body }];
      if (Number(r.followUps) >= 1) msgs.push({ from: 'Mohit <you@example.com>', to: r.to, cc: '', date: at(r.lastFollowUp || r.sentOn, '11:05'), subject: 'Re: ' + r.subject, mine: true, bounce: false, text: 'Hi,\n\nJust bringing this back to the top of your inbox.\n\nBest,\nMohit' });
      if (r.bouncedOn) msgs.push({ from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', to: 'you@example.com', cc: '', date: at(r.bouncedOn, '10:13'), subject: 'Delivery Status Notification (Failure)', mine: false, bounce: true, text: "Address not found\n\nYour message wasn't delivered to " + r.to + ' because the address couldn\'t be found, or is unable to receive mail.' });
      if (r.reply) msgs.push({ from: r.company + ' <' + (r.to || 'them@example.com') + '>', to: 'you@example.com', cc: '', date: at(r.repliedOn || r.sentOn, '15:40'), subject: 'Re: ' + r.subject, mine: false, bounce: false, text: r.reply });
      const who = r.status && !/^skip/i.test(r.status) ? { to: emails(r.to), cc: emails(r.cc), subject: 'Re: ' + (r.subject || ''), url: '' } : null;
      return { messages: msgs, url: '', reply: who };
    }
    case 'meet': {
      const r = db.rows.find((x) => x._row === Number(p.row));
      if (!r) throw new Error('Bad row');
      const d = new Date(p.start);
      if (isNaN(d)) throw new Error('Pick a date and time for the call.');
      return demoUpdate(r._row, { status: byStage('call') || 'Call booked', meetingOn: ymd(d), next: 'Call ' + d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), deal: r.deal || 'Exploring' });
    }
    case 'settings': {
      if (p.set) for (const k of ['cap', 'hubUrl', 'linkBase', 'goal', 'syncOn', 'briefOn']) if (p.set[k] != null) db.settings[k] = ['cap', 'goal'].includes(k) ? Number(p.set[k]) : p.set[k];
      return { ...db.settings };
    }
    case 'saveTemplate': {
      if (p.which === 'f1') db.template.followUp1 = String(p.text || '');
      else if (p.which === 'f2') db.template.followUp2 = String(p.text || '');
      else throw new Error('Only follow-up templates can be changed from the app.');
      return { ...db.template };
    }
    case 'target': {
      const t = db.targets.find((x) => x._row === Number(p.row));
      if (!t) throw new Error('Bad target row');
      Object.assign(t, p.fields || {});
      return db.targets.map((x) => ({ ...x }));
    }
    case 'addTarget': {
      if (!String(p.fields?.company || '').trim()) throw new Error('Company is required');
      db.targets.push({ tstatus: 'New', ...p.fields, _row: Math.max(1, ...db.targets.map((x) => x._row)) + 1 });
      return db.targets.map((x) => ({ ...x }));
    }
    case 'sync':
      return { sent: 0, replied: 0, bounced: 0, ooo: 0, calls: 0, myReplies: 0 };
    default:
      throw new Error('Unknown action');
  }
}
