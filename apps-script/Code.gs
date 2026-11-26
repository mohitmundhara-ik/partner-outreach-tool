/**
 * IK Partner Outreach: backend for the web app.
 *
 * Paste into Extensions > Apps Script of your outreach Google Sheet, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Set TOKEN below to a long random secret (same value as APPS_SCRIPT_TOKEN in Vercel).
 *
 * It only CREATES DRAFTS and READS mail. There is no code in here that sends an email.
 * Columns are found by their header names, so you can reorder or add columns freely.
 * It adds a few tracking columns at the far right if they are missing
 * (Drafted on, Follow-up due, Replied on, Call booked on, Last updated).
 */

var TOKEN = 'CHANGE-ME-to-a-long-random-secret';
var TAB = 'Emails';
var MASTER_TAB = 'Master email';
var FOLLOW_UP_DAYS = 5;
var BOLD_WORDS = ['Interview Kickstart', '30-minute'];
var DEFAULT_STATUSES = ['Not sent', 'Sent', 'Replied', 'Call booked', 'Declined', 'Skip'];

/* Canonical field -> test on the lower-cased header. First matching header wins. */
var MATCH = {
  company: function (h) { return h === 'company' || h === 'company name' || h === 'partner'; },
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
  meetingOn: function (h) { return h === 'call booked on'; },
  updated: function (h) { return h === 'last updated'; }
};
var EXTRA = { draftedOn: 'Drafted on', followUp: 'Follow-up due', repliedOn: 'Replied on', meetingOn: 'Call booked on', updated: 'Last updated' };

/* ---------------- HTTP ---------------- */

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (req.token !== TOKEN) throw new Error('Unauthorized');
    var lock = LockService.getDocumentLock();
    lock.waitLock(30000);
    try { out = { ok: true, data: handle_(req) }; } finally { lock.releaseLock(); }
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('IK Outreach backend is running.');
}

function handle_(req) {
  switch (req.action) {
    case 'list': return list_();
    case 'update': return update_(Number(req.row), req.fields || {});
    case 'add': return add_(req.fields || {});
    case 'draft': return draft_(Number(req.row));
    case 'sync': return sync_();
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
  var map = mapHeaders_(head);
  var missing = Object.keys(EXTRA).filter(function (k) { return map[k] == null; });
  if (missing.length) {
    var start = head.length + 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing.map(function (k) { return EXTRA[k]; })]);
    sh.getRange(1, 1).copyFormatToRange(sh, start, start + missing.length - 1, 1, 1);
    missing.forEach(function (k, i) { head.push(EXTRA[k]); map[k] = start - 1 + i; });
  }
  if (map.company == null) throw new Error('No "Company" column found in row 1 of ' + TAB);
  return { head: head, map: map, width: head.length };
}

function mapHeaders_(head) {
  var map = {};
  head.forEach(function (h, i) {
    var l = h.toLowerCase();
    Object.keys(MATCH).forEach(function (k) { if (map[k] == null && l && MATCH[k](l)) map[k] = i; });
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

function template_() {
  var m = SpreadsheetApp.getActive().getSheetByName(MASTER_TAB);
  if (!m) return null;
  return {
    subject: String(m.getRange('A1').getValue()).replace(/^Subject:\s*/, ''),
    body: String(m.getRange('A3').getValue())
  };
}

function list_() {
  var sh = sh_(), L = layout_(sh), n = sh.getLastRow();
  var rows = [];
  if (n >= 2) {
    sh.getRange(2, 1, n - 1, L.width).getValues().forEach(function (v, i) {
      if (!String(v[L.map.company]).trim()) return;
      rows.push(toObj_(L, v, i + 2));
    });
  }
  return { fields: Object.keys(L.map), rows: rows, statuses: statuses_(sh, L), template: template_(), today: today_() };
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
      if (!before.followUp) next.followUp = plusDays_(next.sentOn || before.sentOn || t, FOLLOW_UP_DAYS);
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
  BOLD_WORDS.forEach(function (w) { html = html.split(esc_(w)).join('<b>' + esc_(w) + '</b>'); });
  return '<div>' + html.replace(/\r?\n/g, '<br>') + '</div>';
}

function draft_(r) {
  var sh = sh_(), L = layout_(sh);
  var o = readRow_(sh, L, r);
  var to = emails_(o.to), cc = emails_(o.cc);
  var subject = String(o.subject || '').trim(), body = String(o.body || '');
  if (!to.length) throw new Error('No email address for ' + o.company + '. Use the form link.');
  if (!subject || !body.trim()) throw new Error('Subject or email body is empty.');
  var left = (subject + body).match(/\[[^\]]+\]/);
  if (left) throw new Error('The email still has ' + left[0] + '. Fill it in first.');
  var opts = { htmlBody: toHtml_(body) };
  if (cc.length) opts.cc = cc.join(', ');
  GmailApp.createDraft(to.join(', '), subject, body, opts);
  return update_(r, { draftedOn: today_() });
}

function sync_() {
  var sh = sh_(), L = layout_(sh), n = sh.getLastRow();
  var S = S_(statuses_(sh, L));
  var me = [Session.getEffectiveUser().getEmail()].concat(GmailApp.getAliases()).map(function (x) { return x.toLowerCase(); });
  var isMe = function (f) { f = f.toLowerCase(); return me.some(function (m) { return m && f.indexOf(m) >= 0; }); };
  var res = { sent: 0, replied: 0 };
  for (var r = 2; r <= n; r++) {
    var o = readRow_(sh, L, r);
    if (!o.company || (o.status !== S.fresh && o.status !== S.sent && o.status !== '')) continue;
    var to = emails_(o.to)[0], subject = String(o.subject || '').replace(/"/g, '').trim();
    if (!to || !subject) continue;
    var threads = GmailApp.search('to:' + to + ' subject:"' + subject + '" -in:drafts', 0, 5);
    var mine = [], theirs = [];
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (m.isDraft()) return;
        var f = m.getFrom();
        if (/mailer-daemon|postmaster/i.test(f)) return;
        (isMe(f) ? mine : theirs).push(m.getDate());
      });
    });
    if (!mine.length) continue;
    mine.sort(function (a, b) { return a - b; });
    var f = {};
    if (!o.sentOn) f.sentOn = fmt_(mine[0]);
    var replies = theirs.filter(function (d) { return d > mine[0]; }).sort(function (a, b) { return a - b; });
    if (replies.length) {
      f.status = S.replied; f.repliedOn = fmt_(replies[0]); res.replied++;
    } else if (o.status !== S.sent) {
      f.status = S.sent; res.sent++;
    }
    if (Object.keys(f).length) update_(r, f);
  }
  return res;
}

/** Run once from the editor to approve Gmail and Sheet access. */
function authorize() {
  GmailApp.getAliases();
  var L = layout_(sh_());
  Logger.log('Authorized as ' + Session.getEffectiveUser().getEmail());
  Logger.log('Columns found: ' + JSON.stringify(Object.keys(L.map).reduce(function (o, k) { o[k] = L.head[L.map[k]]; return o; }, {})));
}
