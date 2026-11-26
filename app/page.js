'use client';
import { useEffect, useState, useCallback } from 'react';
import { F, DEFAULT_STATUSES, addDays, prettyDate } from '@/lib/fields';
import { Icon } from './ui/common';
import Overview from './ui/Overview';
import Ecosystem from './ui/Ecosystem';
import Audience from './ui/Audience';
import Pipeline from './ui/Pipeline';
import Partners from './ui/Partners';
import Editor, { ConfirmSend } from './ui/Editor';
import AddPartner from './ui/AddPartner';

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


const NAV = [
  ['overview', 'Command center'],
  ['ecosystem', 'Ecosystem'],
  ['audience', 'Audience map'],
  ['pipeline', 'Pipeline'],
  ['partners', 'All partners'],
  ['add', 'Add partner'],
];

const timeNow = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState(null);
  const [view, setView] = useState('overview');
  const [seg, setSeg] = useState(null);
  const [preset, setPreset] = useState(null);
  const [openRow, setOpenRow] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState('');
  const [synced, setSynced] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  const flash = (m, tone = '') => { setToast({ m, tone }); setTimeout(() => setToast(null), 5000); };

  const load = useCallback(async () => {
    try { setData(await api('list')); setErr(''); setSynced(timeNow()); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const go = (v, opts = {}) => {
    setView(v); setNavOpen(false);
    if (v === 'ecosystem') setSeg(opts.seg || null);
    if (v === 'partners') setPreset({ ...opts, t: Date.now() });
    window.scrollTo?.(0, 0);
  };

  const replaceRow = (row) => setData((d) => ({ ...d, rows: d.rows.map((r) => (r._row === row._row ? row : r)) }));

  async function save(row, fields, msg = 'Saved to the sheet') {
    setBusy('save');
    try { replaceRow(await api('update', { row, fields })); flash(msg); } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  async function draft(row, fields) {
    setBusy('draft');
    try {
      if (fields && Object.keys(fields).length) replaceRow(await api('update', { row, fields }));
      replaceRow(await api('draft', { row }));
      flash(data?.demo ? 'Demo mode: no real draft was created' : 'Draft saved in Gmail > Drafts');
    } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  async function askSend(row, fields) {
    setBusy('save');
    try {
      let r = data.rows.find((x) => x._row === row);
      if (fields && Object.keys(fields).length) { r = await api('update', { row, fields }); replaceRow(r); }
      setConfirm(r);
    } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  async function send() {
    const r = confirm;
    setBusy('send');
    try {
      const out = await api('send', { row: r._row });
      replaceRow(out);
      setConfirm(null);
      flash(data?.demo
        ? 'Demo mode: nothing was sent, the row was marked Sent'
        : `Sent to ${r[F.company]}${out._sentFrom === 'draft' ? ' (your Gmail draft)' : ''}. Marked Sent, follow-up ${prettyDate(out[F.followUp] || addDays(data.today, 5))}.`, 'good');
    } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  async function sync() {
    setBusy('sync');
    try {
      const r = await api('sync');
      await load();
      flash(`Synced with Gmail and the sheet: ${r.sent} newly sent, ${r.replied} new replies`, 'good');
    } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  async function add(fields) {
    setBusy('add');
    try {
      const row = await api('add', { fields });
      setData((d) => ({ ...d, rows: [...d.rows, row] }));
      flash(fields[F.company] + ' added to the sheet', 'good');
      go('partners');
      setOpenRow(row._row);
    } catch (e) { flash(e.message, 'bad'); }
    setBusy('');
  }

  if (err) return <main className="center-screen"><div className="card narrow"><h2>Can't reach the sheet</h2><p className="muted">{err}</p><button className="btn primary" onClick={load}>Try again</button></div></main>;
  if (!data) return <main className="center-screen"><div className="loader" /><p className="muted">Loading your partners…</p></main>;

  const open = data.rows.find((r) => r._row === openRow);
  const statuses = data.statuses?.length ? data.statuses : DEFAULT_STATUSES;
  const hasSegmentCol = (data.fields || []).includes('segment');
  const due = data.rows.filter((r) => r[F.followUp] && r[F.followUp] <= data.today && /^sent/i.test(r[F.status] || '')).length;

  return (
    <div className={'shell' + (navOpen ? ' nav-open' : '')}>
      <aside className="side">
        <div className="brand">
          <div className="logo">IK</div>
          <div><b>Partner Hub</b><span>Interview Kickstart</span></div>
        </div>
        <nav>
          {NAV.map(([k, l]) => (
            <button key={k} className={'nav' + (view === k ? ' on' : '')} onClick={() => go(k)}>
              <Icon name={k} /> <span>{l}</span>
              {k === 'overview' && due > 0 && <em className="badge">{due}</em>}
              {k === 'partners' && <em className="count">{data.rows.length}</em>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="btn sync" onClick={sync} disabled={!!busy}>
            <Icon name="sync" size={16} /> {busy === 'sync' ? 'Syncing…' : 'Sync now'}
          </button>
          <span>{synced ? 'Last synced ' + synced : ''}</span>
          <span>Google Sheet + Gmail</span>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setNavOpen(true)} aria-label="Menu"><Icon name="menu" /></button>
          <div className="crumb">{NAV.find((n) => n[0] === view)?.[1]}</div>
          <span className="spacer" />
          <button className="btn ghost" onClick={() => go('add')}><Icon name="add" size={16} /> Add</button>
          <button className="btn sync-top" onClick={sync} disabled={!!busy}><Icon name="sync" size={16} /> {busy === 'sync' ? 'Syncing…' : 'Sync'}</button>
        </header>
        {data.demo && <div className="banner">Demo mode: made-up sample rows. Nothing is saved, drafted or sent.</div>}

        {view === 'overview' && <Overview data={data} go={go} onOpen={setOpenRow} />}
        {view === 'ecosystem' && <Ecosystem data={data} seg={seg} setSeg={setSeg} onOpen={setOpenRow} />}
        {view === 'audience' && <Audience data={data} go={go} onOpen={setOpenRow} />}
        {view === 'pipeline' && <Pipeline data={data} onOpen={setOpenRow} />}
        {view === 'partners' && <Partners data={data} statuses={statuses} preset={preset} onOpen={setOpenRow} onStatus={(row, s) => save(row, { [F.status]: s }, 'Status updated in the sheet')} />}
        {view === 'add' && <AddPartner template={data.template} types={[...new Set(data.rows.map((r) => r[F.companyType]).filter(Boolean))].sort()} onAdd={add} busy={busy === 'add'} />}
      </main>

      {open && <Editor key={open._row + ':' + (open[F.updated] || '') + ':' + (open[F.status] || '')} row={open} statuses={statuses} today={data.today} busy={busy} hasSegmentCol={hasSegmentCol}
        onClose={() => setOpenRow(null)} onSave={(f) => save(open._row, f)} onDraft={(f) => draft(open._row, f)} onSend={(f) => askSend(open._row, f)} />}
      {confirm && <ConfirmSend row={confirm} busy={busy === 'send'} onCancel={() => setConfirm(null)} onConfirm={send} />}
      {toast && <div className={'toast ' + toast.tone}>{toast.m}</div>}
    </div>
  );
}
