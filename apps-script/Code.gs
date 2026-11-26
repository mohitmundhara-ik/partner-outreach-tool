/**
 * IK Partner Hub: backend for the web app.
 *
 * Paste into Extensions > Apps Script of your outreach Google Sheet, then
 * Deploy > New deployment > Web app (Execute as: Me; Who has access: Anyone, or
 * Anyone within your company if your Workspace only allows that).
 * Set TOKEN below to a long random secret (same value as APPS_SCRIPT_TOKEN in Vercel).
 * After pasting a new version: Save, run "authorize" once, then Deploy > Manage deployments > Edit > New version.
 *
 * What it does with Gmail and Calendar:
 *  - creates drafts, and reads mail for Sync (sent emails, replies, bounces);
 *  - sends an email ONLY when you press "Send now" or "Send follow-up" in the app and confirm,
 *    one partner at a time, up to your daily cap;
 *  - puts the Gmail label "Partnership Outreach" on every outreach thread (first email, follow-ups, replies, bounces);
 *  - creates a Calendar event when you book a call from the app;
 *  - emails YOU a morning brief, if you turn it on in the app.
 * Columns are found by their header names. Missing tracking columns are added at the far right.
 */

var TOKEN = 'CHANGE-ME-to-a-long-random-secret';
var TAB = 'Emails';
var MASTER_TAB = 'Master email';
var TARGETS_TAB = 'Targets';
var LABEL = 'Partnership Outreach'; // Gmail label put on every outreach thread
var FOLLOW_UP_DAYS = 5;          // first follow-up due this many days after the first email
var SECOND_FOLLOW_UP_DAYS = 7;   // second follow-up due this many days after the first follow-up
var MAX_FOLLOW_UPS = 2;
var DEFAULT_CAP = 30;            // emails a day sent from the app (first emails + follow-ups)
var BOLD_WORDS = ['Interview Kickstart', '30-minute'];
var LINKS = { 'Interview Kickstart': 'https://interviewkickstart.com/in' }; // bold words that are also links
var DEFAULT_STATUSES = ['Not sent', 'Sent', 'Replied', 'Call booked', 'Declined', 'Skip'];

/* Canonical field -> test on the lower-cased header. First matching header wins. */
var MATCH = {
  company: function (h) { return h === 'company' || h === 'company name' || h === 'partner'; },
  segment: function (h) { return h === 'segment'; },
  companyType: function (h) { return h.indexOf('company type') === 0 || h === 'type' || h === 'category'; },
  status: function (h) { return h.indexOf('status') === 0; },
  sentOn: function (h) { return h.indexOf('sent on') === 0 || h.indexOf('sent date') === 0 || h === 'date sent'; },
  to: function (h) { return h.indexOf('to email') === 0 || h === 'to' || h === 'email'; },
  how: function (h) { return h.indexOf('how to reach') === 0; },
  cc: function (h) { return h.indexOf('cc') === 0; },
  audience: function (h) { return h.indexOf('audience') === 0; },
  subject: function (h) { return h.indexOf('subject') === 0; },
  body: function (h) { return h.indexOf('email body') === 0 || h === 'body'; },
  form: function (h) { return h.indexOf('form link') === 0; },
  route: function (h) { return h.indexOf('route') === 0; },
  source: function (h) { return h.indexOf('contact source') === 0; },
  suggested: function (h) { return h.indexOf('suggested contact') === 0; },
  initiative: function (h) { return h.indexOf('initiative used') === 0 || h === 'initiative'; },
  initiativeSource: function (h) { return h.indexOf('initiative source') === 0; },
  verification: function (h) { return h.indexOf('verification') === 0; },
  overlap: function (h) { return h.indexOf('overlap') >= 0; },
  notes: function (h) { return h.indexOf('notes') === 0; },
  reply: function (h) { return h === 'reply' || h.indexOf('reply (') === 0 || h === 'reply notes'; },
  next: function (h) { return h.indexOf('next step') === 0; },
  draftedOn: function (h) { return h === 'drafted on'; },
  followUp: function (h) { return h.indexOf('follow-up due') === 0 || h.indexOf('follow up due') === 0; },
  repliedOn: function (h) { return h === 'replied on'; },
  meetingOn: function (h) { return h === 'call booked on' || h === 'call on'; },
  updated: function (h) { return h === 'last updated'; },
  followUps: function (h) { return h === 'follow-ups sent'; },
  lastFollowUp: function (h) { return h === 'last follow-up on'; },
  bouncedOn: function (h) { return h === 'bounced on'; },
  replyType: function (h) { return h === 'reply type'; },
  threadId: function (h) { return h === 'gmail thread'; },
  deal: function (h) { return h === 'partnership stage'; },
  link: function (h) { return h === 'tracking link'; },
  leads: function (h) { return h === 'leads'; },
  enrolments: function (h) { return h === 'enrolments' || h === 'enrollments'; },
  contacts: function (h) { return h === 'other contacts'; }
};
var EXTRA = {
  draftedOn: 'Drafted on', followUp: 'Follow-up due', repliedOn: 'Replied on', meetingOn: 'Call booked on', updated: 'Last updated',
  followUps: 'Follow-ups sent', lastFollowUp: 'Last follow-up on', bouncedOn: 'Bounced on', replyType: 'Reply type', threadId: 'Gmail thread',
  deal: 'Partnership stage', link: 'Tracking link', leads: 'Leads', enrolments: 'Enrolments', contacts: 'Other contacts'
};

var TARGET_MATCH = {
  company: function (h) { return h === 'company'; },
  segment: function (h) { return h === 'segment'; },
  type: function (h) { return h.indexOf('type') === 0; },
  audience: function (h) { return h.indexOf('audience') === 0; },
  size: function (h) { return h.indexOf('reach') === 0 || h.indexOf('size') === 0; },
  city: function (h) { return h.indexOf('city') === 0 || h.indexOf('location') === 0; },
  website: function (h) { return h.indexOf('website') === 0 || h === 'url'; },
  why: function (h) { return h.indexOf('why') === 0; },
  tstatus: function (h) { return h.indexOf('status') === 0; },
  added: function (h) { return h.indexOf('added') === 0; }
};

/* ---------------- HTTP ---------------- */

function doPost(e) {
  return json_(run_(e && e.postData ? e.postData.contents : '{}'));
}

/**
 * GET is used by the web app from your browser (JSONP), because your Google Workspace only allows
 * "Anyone within Interview Kickstart". Your browser's Google sign-in proves you are in the company,
 * and the secret token is still checked on every call.
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.cb) return ContentService.createTextOutput('IK Partner Hub backend is running.');
  var cb = String(p.cb).replace(/[^\w$]/g, '');
  var out = run_(p.q || '{}');
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(out) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function run_(contents) {
  try {
    var req = JSON.parse(contents || '{}');
    if (req.token !== TOKEN) throw new Error('Unauthorized');
    var lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try { return { ok: true, data: handle_(req) }; } finally { lock.releaseLock(); }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function json_(out) {
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  switch (req.action) {
    case 'list': return list_();
    case 'update': return update_(Number(req.row), req.fields || {});
    case 'add': return add_(req.fields || {});
    case 'draft': return draft_(Number(req.row));
    case 'send': return send_(Number(req.row), !!req.force);
    case 'followup': return followup_(Number(req.row), String(req.text || ''));
    case 'thread': return thread_(Number(req.row));
    case 'meet': return meet_(Number(req.row), req);
    case 'sync': return sync_();
    case 'settings': return settings_(req.set || null);
    case 'saveTemplate': return saveTemplate_(req.which, String(req.text || ''));
    case 'target': return updateTarget_(Number(req.row), req.fields || {});
    case 'addTarget': return addTarget_(req.fields || {});
    default: throw new Error('Unknown action: ' + req.action);
  }
}

/* ---------------- Sheet helpers ---------------- */

function sh_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB);
  if (!sh) throw new Error('Tab "' + TAB + '" not found');
  return sh;
}

function tz_() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone(); }
function fmt_(d) { return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); }
function today_() { return fmt_(new Date()); }
function plusDays_(ymd, n) {
  var p = ymd.split('-').map(Number);
  return fmt_(new Date(p[0], p[1] - 1, p[2] + n, 12));
}

/** Returns {head, map: canonical -> column index (0-based), width}. Adds missing tracking columns. */
function layout_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  while (head.length && !head[head.length - 1]) head.pop();
  var map = mapHeaders_(head, MATCH);
  var missing = Object.keys(EXTRA).filter(function (k) { return map[k] == null; });
  if (missing.length) {
    var start = head.length + 1;
    if (sh.getMaxColumns() < start + missing.length - 1) sh.insertColumnsAfter(sh.getMaxColumns(), start + missing.length - 1 - sh.getMaxColumns());
    sh.getRange(1, start, 1, missing.length).setValues([missing.map(function (k) { return EXTRA[k]; })]);
    sh.getRange(1, 1).copyFormatToRange(sh, start, start + missing.length - 1, 1, 1);
    missing.forEach(function (k, i) { head.push(EXTRA[k]); map[k] = start - 1 + i; });
  }
  if (map.company == null) throw new Error('No "Company" column found in row 1 of ' + TAB);
  return { head: head, map: map, width: head.length };
}

function mapHeaders_(head, match) {
  var map = {};
  head.forEach(function (h, i) {
    var l = h.toLowerCase();
    Object.keys(match).forEach(function (k) { if (map[k] == null && l && match[k](l)) map[k] = i; });
  });
  return map;
}

function cell_(v) {
  if (v instanceof Date) return fmt_(v);
  return v == null ? '' : String(v);
}

function toObj_(L, vals, r) {
  var o = { _row: r };
  Object.keys(L.map).forEach(function (k) { o[k] = cell_(vals[L.map[k]]); });
  return o;
}

function readRow_(sh, L, r) {
  return toObj_(L, sh.getRange(r, 1, 1, L.width).getValues()[0], r);
}

function statuses_(sh, L) {
  if (L.map.status == null) return DEFAULT_STATUSES;
  try {
    var dv = sh.getRange(2, L.map.status + 1).getDataValidation();
    if (dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
      var v = dv.getCriteriaValues()[0];
      if (v && v.length) return v.map(String);
    }
  } catch (err) {}
  return DEFAULT_STATUSES;
}

/* status helpers (work with whatever words your dropdown uses) */
function statusOf_(list, re, fallback) {
  for (var i = 0; i < list.length; i++) if (re.test(list[i])) return list[i];
  return fallback;
}
function S_(list) {
  return {
    fresh: statusOf_(list, /not\s*sent|^new|to do|pending/i, list[0]),
    sent: statusOf_(list, /^sent|contacted|emailed/i, 'Sent'),
    replied: statusOf_(list, /repl/i, 'Replied'),
    call: statusOf_(list, /call|meeting/i, 'Call booked')
  };
}

/* ---------------- Templates and settings ---------------- */

function master_() { return SpreadsheetApp.getActive().getSheetByName(MASTER_TAB); }

/** Master email tab: A1 subject, A3 first email, A6 follow-up 1, A9 follow-up 2 (labels in A5 and A8). */
function template_() {
  var m = master_();
  if (!m) return null;
  return {
    subject: String(m.getRange('A1').getValue()).replace(/^Subject:\s*/, ''),
    body: String(m.getRange('A3').getValue()),
    followUp1: String(m.getRange('A6').getValue() || ''),
    followUp2: String(m.getRange('A9').getValue() || '')
  };
}

function saveTemplate_(which, text) {
  var m = master_();
  if (!m) throw new Error('Tab "' + MASTER_TAB + '" not found');
  if (which === 'f1') { m.getRange('A5').setValue('Follow-up 1 (sent as a reply in the same thread)'); m.getRange('A6').setValue(text); }
  else if (which === 'f2') { m.getRange('A8').setValue('Follow-up 2 (sent as a reply in the same thread)'); m.getRange('A9').setValue(text); }
  else throw new Error('Only follow-up templates can be changed from the app. Edit the first email in the sheet.');
  return template_();
}

function props_() { return PropertiesService.getScriptProperties(); }

function settings_(set) {
  var P = props_();
  if (set) {
    ['cap', 'hubUrl', 'linkBase', 'goal'].forEach(function (k) { if (set[k] != null) P.setProperty(k, String(set[k])); });
    ['syncOn', 'briefOn'].forEach(function (k) { if (set[k] != null) P.setProperty(k, set[k] ? '1' : ''); });
    installTriggers_();
  }
  return {
    cap: Number(P.getProperty('cap')) || DEFAULT_CAP,
    sentToday: Number(P.getProperty('sent:' + today_())) || 0,
    hubUrl: P.getProperty('hubUrl') || '',
    linkBase: P.getProperty('linkBase') || 'https://interviewkickstart.com/in',
    goal: Number(P.getProperty('goal')) || 10,
    syncOn: !!P.getProperty('syncOn'),
    briefOn: !!P.getProperty('briefOn'),
    lastAutoSync: P.getProperty('lastAutoSync') || '',
    me: Session.getEffectiveUser().getEmail()
  };
}

function installTriggers_() {
  var P = props_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'autoSync' || f === 'morningBrief') ScriptApp.deleteTrigger(t);
  });
  if (P.getProperty('syncOn')) ScriptApp.newTrigger('autoSync').timeBased().everyMinutes(15).create();
  if (P.getProperty('briefOn')) ScriptApp.newTrigger('morningBrief').timeBased().atHour(9).nearMinute(30).everyDays(1).inTimezone(tz_()).create();
}

function capCheck_() {
  var s = settings_(null);
  if (s.sentToday >= s.cap) throw new Error('Daily send cap reached (' + s.cap + ' today). This protects your domain. Change it in Settings if needed.');
}
function countSend_() {
  var k = 'sent:' + today_(), P = props_();
  P.setProperty(k, String((Number(P.getProperty(k)) || 0) + 1));
}

/* ---------------- Rows ---------------- */

function list_() {
  var sh = sh_(), L = layout_(sh), n = sh.getLastRow();
  var rows = [];
  if (n >= 2) {
    sh.getRange(2, 1, n - 1, L.width).getValues().forEach(function (v, i) {
      if (!String(v[L.map.company]).trim()) return;
      rows.push(toObj_(L, v, i + 2));
    });
  }
  return {
    fields: Object.keys(L.map), rows: rows, statuses: statuses_(sh, L), template: template_(), today: today_(),
    settings: settings_(null), targets: targets_()
  };
}

/** Writes fields (canonical keys); stamps dates when Status changes. */
function update_(r, fields) {
  var sh = sh_(), L = layout_(sh);
  if (!(r >= 2 && r <= sh.getLastRow())) throw new Error('Bad row ' + r);
  var before = readRow_(sh, L, r);
  var S = S_(statuses_(sh, L));
  var t = today_();
  var next = {};
  Object.keys(fields).forEach(function (k) { if (L.map[k] != null) next[k] = String(fields[k]); });
  var status = next.status != null ? next.status : before.status;
  if (next.status != null && next.status !== before.status) {
    if (status === S.sent) {
      if (!before.sentOn && !next.sentOn) next.sentOn = t;
      if (!before.followUp && next.followUp == null) next.followUp = plusDays_(next.sentOn || before.sentOn || t, FOLLOW_UP_DAYS);
    } else if (status === S.replied) {
      if (!before.repliedOn && !next.repliedOn) next.repliedOn = t;
      next.followUp = '';
    } else if (status === S.call) {
      if (!before.meetingOn && !next.meetingOn) next.meetingOn = t;
      next.followUp = '';
    } else if (status !== S.fresh) {
      next.followUp = '';
    }
  }
  next.updated = t;
  Object.keys(next).forEach(function (k) {
    if (L.map[k] != null) sh.getRange(r, L.map[k] + 1).setValue(next[k]);
  });
  return readRow_(sh, L, r);
}

function add_(fields) {
  var sh = sh_(), L = layout_(sh);
  if (!String(fields.company || '').trim()) throw new Error('Company is required');
  var r = sh.getLastRow() + 1;
  if (r > 2) {
    var src = sh.getRange(r - 1, 1, 1, L.width), dst = sh.getRange(r, 1, 1, L.width);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
  }
  var row = [];
  for (var i = 0; i < L.width; i++) row.push('');
  Object.keys(fields).forEach(function (k) { if (L.map[k] != null) row[L.map[k]] = String(fields[k]); });
  if (L.map.status != null && !row[L.map.status]) row[L.map.status] = S_(statuses_(sh, L)).fresh;
  row[L.map.updated] = today_();
  sh.getRange(r, 1, 1, L.width).setValues([row]);
  return readRow_(sh, L, r);
}

/* ---------------- Gmail ---------------- */

function emails_(s) {
  return String(s || '').split(/[,;\s]+/).filter(function (x) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); });
}

function esc_(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function toHtml_(text) {
  var html = esc_(text);
  BOLD_WORDS.forEach(function (w) {
    var b = '<b>' + esc_(w) + '</b>';
    html = html.split(esc_(w)).join(LINKS[w] ? '<a href="' + LINKS[w] + '">' + b + '</a>' : b);
  });
  return '<div>' + html.replace(/\r?\n/g, '<br>') + '</div>';
}

/** Checks the row and returns what the email will be. */
function compose_(o) {
  var to = emails_(o.to), cc = emails_(o.cc);
  var subject = String(o.subject || '').trim(), body = String(o.body || '');
  if (!to.length) throw new Error('No email address for ' + o.company + '. Use the form link.');
  if (!subject || !body.trim()) throw new Error('Subject or email body is empty.');
  var left = (subject + body).match(/\[[^\]]+\]/);
  if (left) throw new Error('The email still has ' + left[0] + '. Fill it in first.');
  var opts = { htmlBody: toHtml_(body) };
  if (cc.length) opts.cc = cc.join(', ');
  return { to: to, subject: subject, body: body, opts: opts };
}

function draft_(r) {
  var sh = sh_(), L = layout_(sh);
  var m = compose_(readRow_(sh, L, r));
  GmailApp.createDraft(m.to.join(', '), m.subject, m.body, m.opts);
  return update_(r, { draftedOn: today_() });
}

function sentThread_(o) {
  if (o.threadId) { try { var t = GmailApp.getThreadById(o.threadId); if (t) return t; } catch (err) {} }
  var to = emails_(o.to)[0], subject = String(o.subject || '').replace(/"/g, '').trim();
  if (!to || !subject) return null;
  var found = GmailApp.search('to:' + to + ' subject:"' + subject + '" -in:drafts', 0, 1);
  return found.length ? found[0] : null;
}

function label_(thread) {
  if (!thread) return;
  try {
    var l = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
    thread.addLabel(l);
  } catch (err) {}
}

/** The whole email trail with this partner: your emails, follow-ups, their replies and bounce notices. */
function thread_(r) {
  var sh = sh_(), L = layout_(sh);
  var o = readRow_(sh, L, r);
  var t = sentThread_(o);
  if (!t) return { messages: [], url: '' };
  var me = [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(function (x) { return x.toLowerCase(); });
  var messages = t.getMessages().filter(function (m) { return !m.isDraft(); }).map(function (m) {
    var f = m.getFrom(), fl = f.toLowerCase();
    var bounce = /mailer-daemon|postmaster/i.test(f);
    var body = m.getPlainBody() || '';
    return {
      from: f, to: m.getTo(), cc: m.getCc(), date: m.getDate().toISOString(), subject: m.getSubject(),
      mine: me.some(function (x) { return x && fl.indexOf(x) >= 0; }), bounce: bounce,
      text: (bounce ? body : stripQuote_(body, 5000)).slice(0, 5000)
    };
  });
  return { messages: messages, url: 'https://mail.google.com/mail/u/0/#all/' + t.getId() };
}

/**
 * Sends one partner's first email from your Gmail, then marks the row Sent (Sent on today, follow-up in 5 days).
 * If you already saved a Gmail draft for it (same subject and recipient), that draft is sent.
 */
function send_(r, force) {
  var sh = sh_(), L = layout_(sh);
  var o = readRow_(sh, L, r);
  var S = S_(statuses_(sh, L));
  if (!force && o.status && o.status !== S.fresh) throw new Error(o.company + ' is already "' + o.status + '". Not sent again.');
  var m = compose_(o);
  capCheck_();
  var first = m.to[0].toLowerCase();
  var draft = null;
  GmailApp.getDrafts().some(function (d) {
    var msg = d.getMessage();
    if (msg.getSubject() === m.subject && msg.getTo().toLowerCase().indexOf(first) >= 0) { draft = d; return true; }
    return false;
  });
  var threadId = '';
  if (draft) threadId = draft.send().getThread().getId();
  else GmailApp.sendEmail(m.to.join(', '), m.subject, m.body, m.opts);
  countSend_();
  if (!threadId) { Utilities.sleep(1500); var t = sentThread_({ to: o.to, subject: m.subject }); if (t) threadId = t.getId(); }
  if (threadId) label_(GmailApp.getThreadById(threadId));
  var res = update_(r, { status: S.sent, sentOn: today_(), threadId: threadId, followUps: '0' });
  res._sentFrom = draft ? 'draft' : 'new';
  return res;
}

/** Sends follow-up number (followUps + 1) as a reply in the same Gmail thread as the first email. */
function followup_(r, text) {
  var sh = sh_(), L = layout_(sh);
  var o = readRow_(sh, L, r);
  var S = S_(statuses_(sh, L));
  if (o.status !== S.sent) throw new Error('Follow-ups go only to partners in "' + S.sent + '" who have not replied.');
  if (o.bouncedOn) throw new Error('The first email bounced. Find a new contact first.');
  var n = (Number(o.followUps) || 0) + 1;
  if (n > MAX_FOLLOW_UPS) throw new Error('Already sent ' + MAX_FOLLOW_UPS + ' follow-ups.');
  text = String(text || '').trim();
  if (!text) throw new Error('The follow-up text is empty.');
  var left = text.match(/\[[^\]]+\]/);
  if (left) throw new Error('The follow-up still has ' + left[0] + '. Fill it in first.');
  var to = emails_(o.to), cc = emails_(o.cc);
  if (!to.length) throw new Error('No email address for ' + o.company + '.');
  capCheck_();
  var thread = sentThread_(o);
  var html = toHtml_(text);
  var sentInThread = false;
  if (thread) {
    var d = thread.createDraftReplyAll(text, { htmlBody: html });
    var m = d.getMessage();
    var rcpt = (m.getTo() + ',' + m.getCc()).toLowerCase();
    if (rcpt.indexOf(to[0].toLowerCase()) >= 0) { d.send(); sentInThread = true; }
    else d.deleteDraft();
  }
  if (!sentInThread) {
    var opts = { htmlBody: html };
    if (cc.length) opts.cc = cc.join(', ');
    GmailApp.sendEmail(to.join(', '), 'Re: ' + String(o.subject || '').trim(), text, opts);
  }
  countSend_();
  label_(thread || sentThread_(o));
  var t = today_();
  var res = update_(r, {
    followUps: String(n), lastFollowUp: t,
    followUp: n < MAX_FOLLOW_UPS ? plusDays_(t, SECOND_FOLLOW_UP_DAYS) : '',
    threadId: thread ? thread.getId() : o.threadId
  });
  res._inThread = sentInThread;
  return res;
}

/* ---------------- Replies ---------------- */

function stripQuote_(t, max) {
  t = String(t || '').replace(/\r/g, '');
  var cut = t.search(/\n\s*On .{3,200}wrote:|\n>|\n-{2,}\s*Original Message|\nFrom: .+\nSent: /i);
  if (cut > 0) t = t.slice(0, cut);
  return t.replace(/\n{3,}/g, '\n\n').trim().slice(0, max || 600);
}

function classify_(subject, text) {
  var s = subject + '\n' + text;
  if (/out of (the )?office|auto(matic)?[- ]?reply|autoreply|on leave|on vacation|away until|limited access to (my )?email|currently (away|travelling|traveling)/i.test(s)) return 'Out of office';
  if (/not interested|no,? thanks|not a (good )?fit|not looking|unsubscribe|remove me|we('ll| will) pass|not at this time|decline/i.test(s)) return 'Not interested';
  if (/not the right person|wrong person|reach out to|better person|looping in|cc'?ing|forward(ed|ing)? (this|your)/i.test(s)) return 'Wrong person';
  if (/next (week|month|quarter|year)|after (the|our)|circle back|later this|busy (right now|at the moment)|reconnect/i.test(s) && !/(happy|glad) to|sounds (good|great)|let'?s/i.test(s)) return 'Not now';
  if (/interested|sounds (good|great)|happy to|glad to|let'?s (chat|talk|connect|schedule|set up)|schedule|calendly|available|book a|hop on|a call|meet/i.test(s)) return 'Interested';
  return 'Reply';
}

function sync_() {
  var sh = sh_(), L = layout_(sh), n = sh.getLastRow();
  var S = S_(statuses_(sh, L));
  var me = [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(function (x) { return x.toLowerCase(); });
  var isMe = function (f) { f = f.toLowerCase(); return me.some(function (m) { return m && f.indexOf(m) >= 0; }); };
  var res = { sent: 0, replied: 0, bounced: 0, ooo: 0 };
  for (var r = 2; r <= n; r++) {
    var o = readRow_(sh, L, r);
    if (!o.company || (o.status !== S.fresh && o.status !== S.sent && o.status !== '')) continue;
    var thread = sentThread_(o);
    if (!thread) continue;
    var mine = [], theirs = [], bounce = null;
    thread.getMessages().forEach(function (m) {
      if (m.isDraft()) return;
      var f = m.getFrom();
      if (/mailer-daemon|postmaster/i.test(f)) { bounce = bounce || m.getDate(); return; }
      if (isMe(f)) mine.push(m.getDate()); else theirs.push(m);
    });
    if (!mine.length) continue;
    label_(thread);
    mine.sort(function (a, b) { return a - b; });
    var f = {};
    if (!o.threadId) f.threadId = thread.getId();
    if (!o.sentOn) f.sentOn = fmt_(mine[0]);
    if (bounce && !o.bouncedOn) { f.bouncedOn = fmt_(bounce); f.replyType = 'Bounced'; f.followUp = ''; res.bounced++; }
    var replies = theirs.filter(function (m) { return m.getDate() > mine[0]; }).sort(function (a, b) { return a.getDate() - b.getDate(); });
    var real = null, ooo = null;
    replies.forEach(function (m) {
      var type = classify_(m.getSubject(), stripQuote_(m.getPlainBody()));
      if (type === 'Out of office') ooo = ooo || m; else real = real || { m: m, type: type };
    });
    if (real) {
      f.status = S.replied; f.repliedOn = fmt_(real.m.getDate()); f.replyType = real.type;
      if (!o.reply) f.reply = stripQuote_(real.m.getPlainBody());
      res.replied++;
    } else {
      if (ooo && o.replyType !== 'Out of office' && !f.bouncedOn) { f.replyType = 'Out of office'; res.ooo++; }
      if (o.status !== S.sent) { f.status = S.sent; res.sent++; }
    }
    if (Object.keys(f).length) update_(r, f);
  }
  return res;
}

/* ---------------- Calendar ---------------- */

/** Books the call: creates a Calendar event (optionally inviting the partner) and marks the row Call booked. */
function meet_(r, req) {
  var sh = sh_(), L = layout_(sh);
  var o = readRow_(sh, L, r);
  var S = S_(statuses_(sh, L));
  var start = new Date(req.start);
  if (isNaN(start)) throw new Error('Pick a date and time for the call.');
  var end = new Date(start.getTime() + (Number(req.minutes) || 30) * 60000);
  var guests = req.invite ? emails_(o.to).concat(emails_(req.guests || '')).join(',') : '';
  var ev = CalendarApp.getDefaultCalendar().createEvent(
    String(req.title || ('Interview Kickstart x ' + o.company)), start, end,
    { description: String(req.brief || ''), guests: guests, sendInvites: !!req.invite }
  );
  var res = update_(r, { status: S.call, meetingOn: fmt_(start), next: 'Call ' + Utilities.formatDate(start, tz_(), 'd MMM, h:mm a'), deal: o.deal || 'Exploring' });
  res._event = ev.getId();
  return res;
}

/* ---------------- Targets library ---------------- */

function targetsSheet_() { return SpreadsheetApp.getActive().getSheetByName(TARGETS_TAB); }

function targets_() {
  var sh = targetsSheet_();
  if (!sh || sh.getLastRow() < 2) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  var map = mapHeaders_(head, TARGET_MATCH);
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().map(function (v, i) {
    var o = { _row: i + 2 };
    Object.keys(map).forEach(function (k) { o[k] = cell_(v[map[k]]); });
    return o;
  }).filter(function (o) { return o.company; });
}

function targetLayout_() {
  var sh = targetsSheet_();
  if (!sh) {
    sh = SpreadsheetApp.getActive().insertSheet(TARGETS_TAB);
    sh.getRange(1, 1, 1, 10).setValues([['Company', 'Segment', 'Type', 'Audience', 'Reach', 'City', 'Website', 'Why it fits', 'Status', 'Added on']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
  return { sh: sh, map: mapHeaders_(head, TARGET_MATCH), width: head.length };
}

function updateTarget_(r, fields) {
  var T = targetLayout_();
  if (!(r >= 2 && r <= T.sh.getLastRow())) throw new Error('Bad target row ' + r);
  Object.keys(fields).forEach(function (k) { if (T.map[k] != null) T.sh.getRange(r, T.map[k] + 1).setValue(String(fields[k])); });
  return targets_();
}

function addTarget_(fields) {
  var T = targetLayout_();
  if (!String(fields.company || '').trim()) throw new Error('Company is required');
  var row = [];
  for (var i = 0; i < T.width; i++) row.push('');
  Object.keys(fields).forEach(function (k) { if (T.map[k] != null) row[T.map[k]] = String(fields[k]); });
  if (T.map.tstatus != null && !row[T.map.tstatus]) row[T.map.tstatus] = 'New';
  T.sh.appendRow(row);
  return targets_();
}

/* ---------------- Scheduled jobs (turned on from the app's Settings) ---------------- */

function autoSync() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(10000)) return;
  try { sync_(); props_().setProperty('lastAutoSync', new Date().toISOString()); } finally { lock.releaseLock(); }
}

/** Emails you (only you) a short brief for the day. */
function morningBrief() {
  var data = list_(), t = data.today, y = plusDays_(t, -1), s = data.settings;
  var S = S_(data.statuses);
  var rows = data.rows;
  var due = rows.filter(function (r) { return r.status === S.sent && r.followUp && r.followUp <= t && !r.bouncedOn; });
  var newReplies = rows.filter(function (r) { return r.repliedOn && r.repliedOn >= y; });
  var calls = rows.filter(function (r) { return r.status === S.call && r.meetingOn === t; });
  var bounced = rows.filter(function (r) { return r.bouncedOn && r.bouncedOn >= y; });
  var ready = rows.filter(function (r) { return (r.status === S.fresh || !r.status) && emails_(r.to).length && !/\[[^\]]+\]/.test((r.subject || '') + (r.body || '')); });
  var sentY = rows.filter(function (r) { return r.sentOn === y; }).length;
  var li = function (list, fn) { return list.length ? '<ul>' + list.slice(0, 15).map(function (r) { return '<li><b>' + esc_(r.company) + '</b>' + (fn ? ' · ' + esc_(fn(r)) : '') + '</li>'; }).join('') + '</ul>' : '<p style="color:#64748b">None</p>'; };
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;max-width:560px">' +
    '<h2 style="margin:0 0 4px">Good morning. Here is today.</h2>' +
    '<p style="color:#64748b;margin:0 0 16px">' + sentY + ' sent yesterday · goal today ' + s.goal + ' · ' + ready.length + ' ready to send</p>' +
    '<h3>Calls today (' + calls.length + ')</h3>' + li(calls, function (r) { return r.next || ''; }) +
    '<h3>New replies (' + newReplies.length + ')</h3>' + li(newReplies, function (r) { return r.replyType || 'Reply'; }) +
    '<h3>Follow-ups due (' + due.length + ')</h3>' + li(due, function (r) { return 'sent ' + r.sentOn; }) +
    (bounced.length ? '<h3>Bounced (' + bounced.length + ')</h3>' + li(bounced, function (r) { return r.to; }) : '') +
    (s.hubUrl ? '<p style="margin-top:20px"><a href="' + s.hubUrl + '" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Partner Hub</a></p>' : '') +
    '</div>';
  var subject = 'Partner Hub: ' + due.length + ' follow-ups, ' + newReplies.length + ' new replies, ' + calls.length + ' calls today';
  GmailApp.sendEmail(s.me, subject, 'Open the Partner Hub for details.', { htmlBody: html, name: 'IK Partner Hub' });
}

/** Run once from the editor after pasting a new version, to approve Gmail, Calendar, Sheet and trigger access. */
function authorize() {
  GmailApp.getAliases();
  GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  CalendarApp.getDefaultCalendar().getName();
  ScriptApp.getProjectTriggers();
  var L = layout_(sh_());
  Logger.log('Authorized as ' + Session.getEffectiveUser().getEmail());
  Logger.log('Columns found: ' + JSON.stringify(Object.keys(L.map).reduce(function (o, k) { o[k] = L.head[L.map[k]]; return o; }, {})));
}
