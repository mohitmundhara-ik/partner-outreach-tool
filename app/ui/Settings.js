'use client';
import { useState } from 'react';
import { emailHtml, SUGGESTED_FOLLOW_UPS, prettyDate } from '@/lib/fields';
import { Field, Icon } from './common';

export default function Settings({ data, busy, onSave, onSaveTemplate }) {
  const s = data.settings || {};
  const t = data.template || {};
  const [cap, setCap] = useState(s.cap || 30);
  const [linkBase, setLinkBase] = useState(s.linkBase || 'https://interviewkickstart.com/in');
  const [f1, setF1] = useState(t.followUp1 || SUGGESTED_FOLLOW_UPS[0]);
  const [f2, setF2] = useState(t.followUp2 || SUGGESTED_FOLLOW_UPS[1]);
  const last = s.lastAutoSync ? new Date(s.lastAutoSync).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <div className="view">
      <div className="view-head"><div><h1>Settings</h1><p className="muted">Automation, sending limits and follow-up templates. Everything is stored in your Google Sheet's script.</p></div></div>

      <div className="grid-main">
        <section className="card">
          <h2>Automation</h2>
          <Toggle
            on={s.syncOn} disabled={busy || data.demo}
            title="Auto-sync every 15 minutes"
            text={'Checks Gmail for sends, replies, out-of-office notes and bounces, and updates the sheet on its own.' + (last ? ` Last run ${last}.` : '')}
            onChange={(v) => onSave({ syncOn: v })}
          />
          <Toggle
            on={s.briefOn} disabled={busy || data.demo}
            title="Morning brief at 9:30 AM"
            text={`Emails ${s.me || 'you'} a short list of calls today, new replies, follow-ups due and bounces. Only you receive it.`}
            onChange={(v) => onSave({ briefOn: v, hubUrl: typeof window !== 'undefined' ? window.location.origin : '' })}
          />
          {data.demo && <p className="muted small">Not available in demo mode.</p>}
        </section>

        <section className="card">
          <h2>Sending</h2>
          <div className="cap-meter">
            <div><b>{s.sentToday || 0}</b> of {s.cap || 30} sent from the hub today</div>
            <div className="meter"><div className="meter-fill" style={{ width: `${Math.min(100, ((s.sentToday || 0) / (s.cap || 30)) * 100)}%` }} /></div>
          </div>
          <Field label="Daily send cap" hint="Keeps cold outreach at a safe pace for your domain. 20 to 30 is a good range.">
            <input type="number" min="1" max="200" value={cap} onChange={(e) => setCap(e.target.value)} />
          </Field>
          <Field label="Tracking link base" hint="For links partners share with their audience: this address plus utm_source=partner-name, utm_medium=partner, utm_campaign=partner_hub. (The Interview Kickstart link inside your emails is tagged separately: utm_source=partner_outreach, utm_medium=email, utm_campaign=ik_partnerships, utm_content=partner-name.)">
            <input value={linkBase} onChange={(e) => setLinkBase(e.target.value)} />
          </Field>
          <button className="btn primary" disabled={busy} onClick={() => onSave({ cap: Number(cap) || 30, linkBase })}>Save</button>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2>Email templates</h2><span className="muted small">Follow-ups are sent as replies in the same thread. Use [Company] where the partner name goes.</span></div>
        <div className="tpl-grid">
          <div>
            <h3 style={{ marginTop: 0 }}>First email (locked, edit it in the sheet's Master email tab)</h3>
            <div className="mailbox"><div className="mail-head"><b>{t.subject}</b></div><div className="mail small-mail" dangerouslySetInnerHTML={{ __html: emailHtml(t.body || '') }} /></div>
          </div>
          <TplEditor title="Follow-up 1" hint={`Sent when due, about 5 days after the first email.`} value={f1} setValue={setF1} saved={!!t.followUp1} busy={busy} onSave={() => onSaveTemplate('f1', f1)} />
          <TplEditor title="Follow-up 2" hint={`Sent about 7 days after follow-up 1. The last one.`} value={f2} setValue={setF2} saved={!!t.followUp2} busy={busy} onSave={() => onSaveTemplate('f2', f2)} />
        </div>
      </section>
    </div>
  );
}

function TplEditor({ title, hint, value, setValue, saved, busy, onSave }) {
  return (
    <div>
      <h3 style={{ marginTop: 0 }}>{title} {saved ? <span className="tag t-green">saved</span> : <span className="tag t-amber">suggested, not saved yet</span>}</h3>
      <textarea rows={10} value={value} onChange={(e) => setValue(e.target.value)} />
      <p className="muted small">{hint}</p>
      <button className="btn primary" disabled={busy} onClick={onSave}>Save {title.toLowerCase()}</button>
    </div>
  );
}

function Toggle({ on, title, text, onChange, disabled }) {
  return (
    <div className="toggle-row">
      <div><b>{title}</b><p className="muted small">{text}</p></div>
      <button className={'switch' + (on ? ' on' : '')} disabled={disabled} onClick={() => onChange(!on)} aria-pressed={!!on}><span /></button>
    </div>
  );
}
