'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { F, DEFAULT_STATUSES, stage, emailHtml, emails, placeholders, fillTemplate, addDays, prettyDate } from '@/lib/fields';

let cfgPromise;
function getCfg() {
  cfgPromise ||= fetch('/api/config').then((r) => {
    if (r.status === 401) { window.location.href = '/login'; throw new Error('Please sign in'); }
    return r.json();
  });
  return cfgPromise;
}

const NO_GOOGLE = 'Could not reach your Google Sheet. Make sure this browser is signed in to your interviewkickstart.com Google account, then reload.';

// Calls the Apps Script straight from the browser (JSONP), so your company Google sign-in is used.
function jsonp(url, payload) {
  return new Promise((resolve, reject) => {
    const cb = '__ik' + Date.now() + Math.random().toString(36).slice(2);
    const s = document.createElement('script');
    const done = () => { clearTimeout(timer); delete window[cb]; s.remove(); };
    const timer = setTimeout(() => { done(); reject(new Error(NO_GOOGLE)); }, 45000);
    window[cb] = (d) => { done(); d && d.ok ? resolve(d.data) : reject(new Error((d && d.error) || 'Backend error')); };
    s.onerror = () => { done(); reject(new Error(NO_GOOGLE)); };
    s.src = url + (url.includes('?') ? '&' : '?') + 'cb=' + cb + '&q=' + encodeURIComponent(JSON.stringify(payload));
    document.body.appendChild(s);
  });
}

async function api(action, payload = {}) {
  const cfg = await getCfg();
  if (cfg.browser) return jsonp(cfg.url, { token: cfg.token, action, ...payload });
  const r = await fetch('/api/sheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
  if (r.status === 401) { window.location.href = '/login'; throw new Error('Please sign in'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j.data;
}

const withCurrent = (list, cur) => (cur && !list.includes(cur) ? [...list, cur] : list);
const isCompetitor = (r) => /COMPETITOR/i.test(r[F.notes] || '');
const hasEmail = (r) => emails(r[F.to]).length > 0;
const missing = (r) => placeholders((r[F.subject] || '') + (r[F.body] || ''));
const isReady = (r) => stage(r[F.status]) === 'new' && hasEmail(r) && !missing(r).length && !r[F.draftedOn];
const followUpDue = (r, today) => stage(r[F.status]) === 'sent' && r[F.followUp] && r[F.followUp] <= today;

function statusClass(s) {
  return 'pill st-' + stage(s);
}

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('today');
  const [openRow, setOpenRow] = useState(null);
  const [busy, setBusy] = useState('');

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    try { setData(await api('list')); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const replaceRow = (row) => setData((d) => ({ ...d, rows: d.rows.map((r) => (r._row === row._row ? row : r)) }));

  async function save(row, fields, msg = 'Saved') {
    setBusy('save');
    try { replaceRow(await api('update', { row, fields })); flash(msg); } catch (e) { flash('Error: ' + e.message); }
    setBusy('');
  }

  async function draft(row, fields) {
    setBusy('draft');
    try {
      if (fields && Object.keys(fields).length) replaceRow(await api('update', { row, fields }));
      replaceRow(await api('draft', { row }));
      flash(data?.demo ? 'Demo mode: draft not really created' : 'Draft saved in Gmail > Drafts. Review and send it from Gmail.');
    } catch (e) { flash('Error: ' + e.message); }
    setBusy('');
  }

  async function sync() {
    setBusy('sync');
    try {
      const r = await api('sync');
      await load();
      flash(`Gmail checked: ${r.sent} newly sent, ${r.replied} replied`);
    } catch (e) { flash('Error: ' + e.message); }
    setBusy('');
  }

  async function add(fields) {
    setBusy('add');
    try {
      const row = await api('add', { fields });
      setData((d) => ({ ...d, rows: [...d.rows, row] }));
      flash(fields[F.company] + ' added');
      setTab('partners');
      setOpenRow(row._row);
    } catch (e) { flash('Error: ' + e.message); }
    setBusy('');
  }

  if (err) return <main className="wrap"><div className="card error">{err} <button className="btn" onClick={load}>Retry</button></div></main>;
  if (!data) return <main className="wrap"><p className="muted">Loading your partners…</p></main>;

  const open = data.rows.find((r) => r._row === openRow);
  const statuses = data.statuses?.length ? data.statuses : DEFAULT_STATUSES;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>IK Partner Outreach</h1>
          <p className="muted">{data.rows.length} partners · emails are saved as Gmail drafts, you send them yourself</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={sync} disabled={!!busy}>{busy === 'sync' ? 'Checking Gmail…' : 'Update from Gmail'}</button>
        </div>
      </header>
      {data.demo && <div className="banner">Demo mode: these are made-up sample rows. Nothing is saved and no drafts are created. Connect your Google Sheet to go live (see README).</div>}
      <nav className="tabs">
        {[['today', 'Today'], ['partners', 'Partners'], ['add', 'Add partner']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      {tab === 'today' && <Dashboard data={data} onOpen={(r) => { setTab('partners'); setOpenRow(r); }} />}
      {tab === 'partners' && <Partners data={data} statuses={statuses} onOpen={setOpenRow} onStatus={(row, s) => save(row, { [F.status]: s }, 'Status updated')} />}
      {tab === 'add' && <AddPartner template={data.template} types={[...new Set(data.rows.map((r) => r[F.companyType]).filter(Boolean))].sort()} onAdd={add} busy={busy === 'add'} />}

      {open && <Editor key={open._row} row={open} statuses={statuses} today={data.today} busy={busy} onClose={() => setOpenRow(null)} onSave={(f) => save(open._row, f)} onDraft={(f) => draft(open._row, f)} />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard({ data, onOpen }) {
  const { rows, today } = data;
  const [goal, setGoal] = useState(10);
  useEffect(() => { try { const g = Number(localStorage.getItem('ik_goal')); if (g) setGoal(g); } catch {} }, []);
  const saveGoal = (g) => { setGoal(g); try { localStorage.setItem('ik_goal', String(g)); } catch {} };

  const count = (field, day) => rows.filter((r) => r[field] === day).length;
  const sentToday = count(F.sentOn, today);
  const due = rows.filter((r) => followUpDue(r, today));
  const ready = rows.filter(isReady);
  const needName = rows.filter((r) => stage(r[F.status]) === 'new' && hasEmail(r) && missing(r).length);
  const statuses = data.statuses?.length ? data.statuses : DEFAULT_STATUSES;
  const byStatus = [...statuses, ...[...new Set(rows.map((r) => r[F.status] || ''))].filter((s) => s && !statuses.includes(s))]
    .map((s) => [s, rows.filter((r) => (r[F.status] || statuses[0]) === s).length]);
  const contacted = rows.filter((r) => r[F.sentOn] || ['sent', 'replied', 'call'].includes(stage(r[F.status]))).length;
  const replied = rows.filter((r) => ['replied', 'call'].includes(stage(r[F.status]))).length;
  const calls = rows.filter((r) => stage(r[F.status]) === 'call').length;
  const types = [...new Set(rows.map((r) => r[F.companyType]).filter(Boolean))].sort();
  const byType = types.map((t) => {
    const rs = rows.filter((r) => r[F.companyType] === t);
    return [t, rs.length, rs.filter((r) => r[F.sentOn] || stage(r[F.status]) !== 'new').length, rs.filter((r) => ['replied', 'call'].includes(stage(r[F.status]))).length];
  });
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));

  return (
    <section>
      <div className="kpis">
        <Kpi label="Drafted today" value={count(F.draftedOn, today)} />
        <Kpi label="Sent today" value={sentToday} sub={
          <span className="goal">goal <input type="number" min="1" value={goal} onChange={(e) => saveGoal(Number(e.target.value) || 1)} /></span>
        } bar={Math.min(1, sentToday / goal)} />
        <Kpi label="Replies today" value={count(F.repliedOn, today)} />
        <Kpi label="Follow-ups due" value={due.length} warn={due.length > 0} />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Pipeline</h2>
          <table className="mini">
            <tbody>
              {byStatus.map(([s, n]) => (
                <tr key={s}><td><span className={statusClass(s)}>{s}</span></td><td className="num">{n}</td><td className="barcell"><div className="bar" style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%` }} /></td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Contacted {contacted} · Replied {replied} ({contacted ? Math.round((replied / contacted) * 100) : 0}%) · Calls {calls}</p>
          {byType.length > 0 && (
            <>
              <h3>By company type</h3>
              <table className="mini">
                <thead><tr><th>Type</th><th className="num">Partners</th><th className="num">Contacted</th><th className="num">Replied</th></tr></thead>
                <tbody>{byType.map(([t, n, c, rp]) => <tr key={t}><td>{t}</td><td className="num">{n}</td><td className="num">{c}</td><td className="num">{rp}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
        <div className="card">
          <h2>Do next</h2>
          <List title={`Follow-ups due (${due.length})`} rows={due} onOpen={onOpen} extra={(r) => `sent ${prettyDate(r[F.sentOn])}`} />
          <List title={`Ready to draft (${ready.length})`} rows={ready} onOpen={onOpen} />
          <List title={`Need a contact name (${needName.length})`} rows={needName} onOpen={onOpen} extra={(r) => missing(r)[0]} />
        </div>
      </div>

      <div className="card">
        <h2>Daily progress, last 14 days</h2>
        <div className="scroll">
          <table className="mini days">
            <thead><tr><th>Date</th><th>Drafted</th><th>Sent</th><th>Replies</th><th>Calls booked</th><th>Goal</th></tr></thead>
            <tbody>
              {days.map((d) => {
                const s = count(F.sentOn, d);
                return (
                  <tr key={d} className={d === today ? 'today' : ''}>
                    <td>{prettyDate(d)}{d === today ? ' (today)' : ''}</td>
                    <td className="num">{count(F.draftedOn, d) || ''}</td>
                    <td className="num">{s || ''}</td>
                    <td className="num">{count(F.repliedOn, d) || ''}</td>
                    <td className="num">{count(F.meetingOn, d) || ''}</td>
                    <td>{s >= goal ? '✓' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, sub, bar, warn }) {
  return (
    <div className={'card kpi' + (warn ? ' warn' : '')}>
      <div className="muted small">{label}</div>
      <div className="big">{value}</div>
      {sub}
      {bar != null && <div className="track"><div className="fill" style={{ width: `${bar * 100}%` }} /></div>}
    </div>
  );
}

function List({ title, rows, onOpen, extra }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <div className="list">
      <h3>{title}</h3>
      {shown.map((r) => (
        <button key={r._row} className="linkrow" onClick={() => onOpen(r._row)}>
          <span>{r[F.company]}</span><span className="muted small">{extra ? extra(r) : r[F.to]}</span>
        </button>
      ))}
      {rows.length > 6 && <button className="btn ghost small" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${rows.length}`}</button>}
    </div>
  );
}

/* ---------------- Partners table ---------------- */

function Partners({ data, statuses, onOpen, onStatus }) {
  const { rows, today } = data;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState('all');
  const types = [...new Set(rows.map((r) => r[F.companyType]).filter(Boolean))].sort();

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && (r[F.status] || statuses[0]) !== status) return false;
      if (type && r[F.companyType] !== type) return false;
      if (view === 'ready' && !isReady(r)) return false;
      if (view === 'due' && !followUpDue(r, today)) return false;
      if (view === 'form' && hasEmail(r)) return false;
      if (view === 'name' && !(hasEmail(r) && missing(r).length)) return false;
      if (!s) return true;
      return [F.company, F.to, F.audience, F.initiative, F.suggested, F.notes].some((k) => String(r[k] || '').toLowerCase().includes(s));
    });
  }, [rows, q, status, type, view, today, statuses]);

  return (
    <section className="card">
      <div className="filters">
        <input placeholder="Search company, email, audience…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        {types.length > 0 && (
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <div className="chips">
          {[['all', 'All'], ['ready', 'Ready to draft'], ['name', 'Needs name'], ['due', 'Follow-up due'], ['form', 'Form only']].map(([k, l]) => (
            <button key={k} className={'chip' + (view === k ? ' on' : '')} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="scroll">
        <table className="table">
          <thead><tr><th>Company</th><th>Type</th><th>Status</th><th>To</th><th>Drafted</th><th>Sent</th><th>Follow-up</th><th>Flags</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r._row} className={followUpDue(r, today) ? 'due' : ''} onClick={() => onOpen(r._row)}>
                <td className="strong">{r[F.company]}</td>
                <td className="small muted">{r[F.companyType]}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <select className={statusClass(r[F.status])} value={r[F.status] || statuses[0]} onChange={(e) => onStatus(r._row, e.target.value)}>
                    {withCurrent(statuses, r[F.status]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="small">{hasEmail(r) ? emails(r[F.to]).join(', ') : <span className="muted">form</span>}</td>
                <td className="small">{prettyDate(r[F.draftedOn])}</td>
                <td className="small">{prettyDate(r[F.sentOn])}</td>
                <td className="small">{prettyDate(r[F.followUp])}</td>
                <td className="small">
                  {isCompetitor(r) && <span className="tag red">competitor?</span>}
                  {hasEmail(r) && missing(r).length > 0 && <span className="tag amber">{missing(r)[0]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <p className="muted">No partners match.</p>}
      </div>
    </section>
  );
}

/* ---------------- Editor ---------------- */

const EDITABLE = [F.company, F.companyType, F.to, F.cc, F.status, F.sentOn, F.subject, F.body, F.reply, F.next, F.notes, F.initiative, F.audience, F.form, F.how, F.suggested];

function Editor({ row, statuses, today, busy, onClose, onSave, onDraft }) {
  const [f, setF] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, row[k] || ''])));
  const [name, setName] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== (row[k] || '')));
  const dirty = Object.keys(changed).length > 0;
  const left = placeholders(f[F.subject] + f[F.body]);
  const canDraft = emails(f[F.to]).length > 0 && !left.length && f[F.subject].trim() && f[F.body].trim();

  function putName() {
    if (!name.trim()) return;
    const n = name.trim();
    const fix = (t) => t.split('[Name]').join(n).replace(/^Hi,/, 'Hi ' + n + ',');
    setF((x) => ({ ...x, [F.body]: fix(x[F.body]), [F.subject]: x[F.subject].split('[Name]').join(n) }));
  }

  async function copy() {
    const html = emailHtml(f[F.body]);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([f[F.body]], { type: 'text/plain' }) })]);
    } catch {
      await navigator.clipboard.writeText(f[F.body]);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>{row[F.company]}</h2>
            <p className="muted small">{[row[F.companyType], row[F.route], row[F.verification]].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/COMPETITOR/i.test(row[F.notes]) && <div className="banner red">Possible competitor. Decide before sending.</div>}

        <div className="two">
          <Field label="To"><input value={f[F.to]} onChange={set(F.to)} /></Field>
          <Field label="CC"><input value={f[F.cc]} onChange={set(F.cc)} /></Field>
          <Field label="Status">
            <select value={f[F.status] || statuses[0]} onChange={set(F.status)}>{withCurrent(statuses, row[F.status]).map((s) => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Sent on"><input type="date" value={f[F.sentOn]} onChange={set(F.sentOn)} /></Field>
        </div>
        <p className="muted small">
          Drafted {prettyDate(row[F.draftedOn]) || 'not yet'} · Follow-up {prettyDate(row[F.followUp]) || 'not set'}
          {followUpDue(row, today) ? ' (due)' : ''} · Replied {prettyDate(row[F.repliedOn]) || 'no'}
        </p>

        <h3>Email</h3>
        {(left.includes('[Name]') || /^Hi,/.test(f[F.body])) && (
          <div className="namebar">
            <input placeholder={row[F.suggested] ? 'Suggested: ' + row[F.suggested].slice(0, 60) : 'Contact first name'} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" onClick={putName}>{left.includes('[Name]') ? 'Put name in email' : 'Greet by name'}</button>
          </div>
        )}
        <Field label="Subject"><input value={f[F.subject]} onChange={set(F.subject)} /></Field>
        <Field label="Body (plain text, fixed copy)"><textarea rows={10} value={f[F.body]} onChange={set(F.body)} /></Field>
        <div className="preview">
          <div className="muted small">Preview, as it will look in Gmail</div>
          <div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(f[F.body]) }} />
        </div>
        {left.length > 0 && <p className="warn-text small">Fill in {left.join(', ')} before drafting.</p>}
        {!emails(f[F.to]).length && <p className="muted small">No email address. Use the form link below, then set Status to sent.</p>}

        <div className="btnrow">
          <button className="btn primary" disabled={!canDraft || !!busy} onClick={() => onDraft(changed)}>
            {busy === 'draft' ? 'Saving draft…' : row[F.draftedOn] ? 'Save another Gmail draft' : 'Save as Gmail draft'}
          </button>
          <button className="btn" disabled={!dirty || !!busy} onClick={() => onSave(changed)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
          <button className="btn ghost" onClick={copy}>Copy email</button>
        </div>

        <h3>Tracking</h3>
        <Field label="Reply"><textarea rows={2} value={f[F.reply]} onChange={set(F.reply)} /></Field>
        <Field label="Next step"><input value={f[F.next]} onChange={set(F.next)} /></Field>
        <Field label="Notes / flags"><textarea rows={3} value={f[F.notes]} onChange={set(F.notes)} /></Field>

        <h3>Company details</h3>
        <div className="two">
          <Field label="Company type"><input value={f[F.companyType]} onChange={set(F.companyType)} /></Field>
          <Field label="Initiative used in email"><input value={f[F.initiative]} onChange={set(F.initiative)} /></Field>
          <Field label="Audience"><input value={f[F.audience]} onChange={set(F.audience)} /></Field>
          <Field label="How to reach"><input value={f[F.how]} onChange={set(F.how)} /></Field>
          <Field label="Suggested contact (not in email)"><input value={f[F.suggested]} onChange={set(F.suggested)} /></Field>
        </div>
        <Field label="Form link">
          <div className="namebar">
            <input value={f[F.form]} onChange={set(F.form)} />
            {/^https?:\/\//.test(f[F.form]) && <a className="btn" href={f[F.form]} target="_blank" rel="noreferrer">Open</a>}
          </div>
        </Field>
        {row[F.overlap] && <p className="muted small"><b>Overlap line (not in email):</b> {row[F.overlap]}</p>}
        <div className="btnrow sticky">
          <button className="btn" disabled={!dirty || !!busy} onClick={() => onSave(changed)}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

/* ---------------- Add partner ---------------- */

function AddPartner({ template, types, onAdd, busy }) {
  const blank = { company: '', type: '', initiative: '', name: '', to: '', cc: '', audience: '', form: '', route: 'Direct email', notes: '' };
  const [v, setV] = useState(blank);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const mail = fillTemplate(template, { company: v.company, initiative: v.initiative, name: v.name });

  function submit(e) {
    e.preventDefault();
    onAdd({
      [F.company]: v.company.trim(), [F.companyType]: v.type, [F.to]: v.to.trim(), [F.cc]: v.cc.trim(),
      [F.audience]: v.audience, [F.initiative]: v.initiative, [F.form]: v.form, [F.route]: v.route, [F.notes]: v.notes,
      [F.subject]: mail.subject, [F.body]: mail.body,
    });
    setV(blank);
  }

  return (
    <section className="grid2">
      <form className="card" onSubmit={submit}>
        <h2>Add a partner</h2>
        <p className="muted small">The email is built from your fixed master text. Only company, initiative and name change.</p>
        <Field label="Company *"><input required value={v.company} onChange={set('company')} /></Field>
        <Field label="Company type">
          <input list="types" value={v.type} onChange={set('type')} />
          <datalist id="types">{types.map((t) => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="Initiative or offering (goes in the email) *"><input required value={v.initiative} onChange={set('initiative')} placeholder="e.g. the Product (Un)Conference in Bengaluru" /></Field>
        <Field label="Contact first name (leave empty if not verified)"><input value={v.name} onChange={set('name')} /></Field>
        <div className="two">
          <Field label="To email"><input value={v.to} onChange={set('to')} /></Field>
          <Field label="CC email"><input value={v.cc} onChange={set('cc')} /></Field>
          <Field label="Route type">
            <select value={v.route} onChange={set('route')}>{['Direct email', 'Shared email', 'Partner form', 'Publisher email', 'Professional profile'].map((x) => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="Audience"><input value={v.audience} onChange={set('audience')} /></Field>
        </div>
        <Field label="Form link"><input value={v.form} onChange={set('form')} /></Field>
        <Field label="Notes"><textarea rows={2} value={v.notes} onChange={set('notes')} /></Field>
        <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add partner'}</button>
      </form>
      <div className="card">
        <h2>Email preview</h2>
        <p><b>Subject:</b> {mail.subject}</p>
        <div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(mail.body) }} />
      </div>
    </section>
  );
}
