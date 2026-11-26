'use client';
import { useState } from 'react';
import { F, stage, emailHtml, emails, placeholders, prettyDate } from '@/lib/fields';
import { segmentOf, bandsOf, focusOf, isCompetitor } from '@/lib/segments';
import { Field, Icon, Pill, Tag, withCurrent, followUpDue, action } from './common';

const EDITABLE = [F.company, F.companyType, F.segment, F.to, F.cc, F.status, F.sentOn, F.subject, F.body, F.reply, F.next, F.notes, F.initiative, F.audience, F.form, F.how, F.suggested];

export default function Editor({ row, statuses, today, busy, hasSegmentCol, onClose, onSave, onDraft, onSend }) {
  const [f, setF] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, row[k] || ''])));
  const [name, setName] = useState('');
  const [tab, setTab] = useState('email');
  const [mode, setMode] = useState('preview');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== (row[k] || '')));
  const dirty = Object.keys(changed).length > 0;
  const left = placeholders(f[F.subject] + f[F.body]);
  const to = emails(f[F.to]);
  const canMail = to.length > 0 && !left.length && f[F.subject].trim() && f[F.body].trim();
  const st = stage(row[F.status]);
  const seg = segmentOf({ ...row, ...f });
  const bands = bandsOf({ ...row, ...f });
  const focus = focusOf({ ...row, ...f });
  const a = action(row, today);

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
            <div className="panel-kicker"><span className={'seg seg-' + seg.key}>{seg.name}</span> <Pill status={row[F.status]} /> <Tag tone={a.tone}>{a.label}</Tag></div>
            <h2>{row[F.company]}</h2>
            <p className="muted small">{[row[F.companyType], row[F.route], row[F.verification]].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        {isCompetitor(row) && <div className="banner red">Possible competitor. Decide before sending.</div>}

        <div className="timeline">
          <Step on={!!row[F.draftedOn]} label="Drafted" date={row[F.draftedOn]} />
          <Step on={!!row[F.sentOn]} label="Sent" date={row[F.sentOn]} />
          <Step on={!!row[F.followUp] && st === 'sent'} warn={followUpDue(row, today)} label="Follow-up" date={st === 'sent' ? row[F.followUp] : ''} />
          <Step on={!!row[F.repliedOn]} label="Replied" date={row[F.repliedOn]} />
          <Step on={!!row[F.meetingOn]} label="Call" date={row[F.meetingOn]} />
        </div>

        <div className="ptabs">
          {[['email', 'Email'], ['plays', 'Plays for the call'], ['details', 'Company details']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'email' && (
          <>
            <div className="two">
              <Field label="To"><input value={f[F.to]} onChange={set(F.to)} /></Field>
              <Field label="CC"><input value={f[F.cc]} onChange={set(F.cc)} /></Field>
            </div>
            {st === 'new' && (left.includes('[Name]') || /^Hi,/.test(f[F.body])) && (
              <div className="namebar">
                <input placeholder={row[F.suggested] ? 'Suggested: ' + row[F.suggested].slice(0, 60) : 'Contact first name (only if verified)'} value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn" onClick={putName}>{left.includes('[Name]') ? 'Put name in email' : 'Greet by name'}</button>
              </div>
            )}
            <Field label="Subject"><input value={f[F.subject]} onChange={set(F.subject)} /></Field>
            <div className="mailbox">
              <div className="mail-head">
                <div className="mail-head-row">
                  <div><span className="muted">To</span> {to.join(', ') || <span className="warn-text">no email</span>}{emails(f[F.cc]).length > 0 && <><span className="muted"> · Cc</span> {emails(f[F.cc]).join(', ')}</>}</div>
                  <div className="seg-toggle">
                    <button className={mode === 'preview' ? 'on' : ''} onClick={() => setMode('preview')}>Preview</button>
                    <button className={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}><Icon name="draft" size={14} /> Edit email</button>
                  </div>
                </div>
                <div className="strong">{f[F.subject]}</div>
              </div>
              {mode === 'preview' ? (
                <div className="mail" onDoubleClick={() => setMode('edit')} title="Double-click to edit" dangerouslySetInnerHTML={{ __html: emailHtml(f[F.body]) }} />
              ) : (
                <textarea className="mail-edit" rows={18} value={f[F.body]} onChange={set(F.body)} autoFocus />
              )}
            </div>
            {mode === 'edit' && <p className="muted small">"Interview Kickstart" and "30-minute" are made bold automatically. Press Save to write the change to the sheet; Send and Save as draft use your edited text.</p>}
            {dirty && <p className="warn-text small">Unsaved changes.</p>}
            {left.length > 0 && <p className="warn-text small">Fill in {left.join(', ')} before drafting or sending.</p>}
            {!to.length && <p className="muted small">No email address. Use the form link in Company details, then set the status to Sent.</p>}
          </>
        )}

        {tab === 'plays' && (
          <div className="plays-panel">
            <p className="muted small">Ideas to pitch on the 30-minute call, picked for a {seg.name.toLowerCase()} partner{bands.length ? ' whose audience is ' + bands.map((b) => b.name.toLowerCase()).join(', ') : ''}.</p>
            {seg.plays.map((p, i) => (
              <div key={p.title} className="play small-play">
                <span className="play-n">{i + 1}</span>
                <h4>{p.title}</h4>
                <p>{p.how}</p>
                <p className="ask"><b>Ask:</b> {p.ask}</p>
              </div>
            ))}
            {bands.map((b) => (
              <div key={b.key} className="bp">
                <b>{b.name}: {b.hook}</b>
                <ul>{b.plays.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
            {focus.length > 0 && <div className="chips">{focus.map((x) => <span key={x} className="chip static">{x}</span>)}</div>}
          </div>
        )}

        {tab === 'details' && (
          <>
            <div className="two">
              <Field label="Status">
                <select value={f[F.status] || statuses[0]} onChange={set(F.status)}>{withCurrent(statuses, row[F.status]).map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Sent on"><input type="date" value={f[F.sentOn]} onChange={set(F.sentOn)} /></Field>
              <Field label="Company type"><input value={f[F.companyType]} onChange={set(F.companyType)} /></Field>
              {hasSegmentCol ? (
                <Field label="Segment (overrides the automatic one)"><input value={f[F.segment]} onChange={set(F.segment)} placeholder={seg.name} /></Field>
              ) : (
                <Field label="Segment" hint="Add a Segment column to the sheet to override this."><input value={seg.name} disabled /></Field>
              )}
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
            <Field label="Reply"><textarea rows={2} value={f[F.reply]} onChange={set(F.reply)} /></Field>
            <Field label="Next step"><input value={f[F.next]} onChange={set(F.next)} /></Field>
            <Field label="Notes / flags"><textarea rows={3} value={f[F.notes]} onChange={set(F.notes)} /></Field>
            {row[F.overlap] && <p className="muted small"><b>Overlap line (not in email):</b> {row[F.overlap]}</p>}
          </>
        )}

        <div className="actionbar">
          {st === 'new' ? (
            <>
              <button className="btn send" disabled={!canMail || !!busy} onClick={() => onSend(changed)}>
                <Icon name="send" size={16} /> {busy === 'send' ? 'Sending…' : 'Send now'}
              </button>
              <button className="btn" disabled={!canMail || !!busy} onClick={() => onDraft(changed)}>
                <Icon name="draft" size={16} /> {busy === 'draft' ? 'Saving…' : row[F.draftedOn] ? 'Save another draft' : 'Save as Gmail draft'}
              </button>
            </>
          ) : (
            <span className="muted small">Already {String(row[F.status]).toLowerCase()}{row[F.sentOn] ? ' on ' + prettyDate(row[F.sentOn]) : ''}. Sync picks up replies from Gmail.</span>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={copy} title="Copy email with bold"><Icon name="copy" size={16} /></button>
          <button className="btn primary" disabled={!dirty || !!busy} onClick={() => onSave(changed)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        </div>
      </aside>
    </div>
  );
}

function Step({ on, warn, label, date }) {
  return (
    <div className={'step' + (on ? ' on' : '') + (warn ? ' warn' : '')}>
      <span className="step-dot" />
      <span className="step-label">{label}</span>
      <span className="step-date">{date ? prettyDate(date) : '·'}</span>
    </div>
  );
}

export function ConfirmSend({ row, busy, onCancel, onConfirm }) {
  const to = emails(row[F.to]), cc = emails(row[F.cc]);
  return (
    <div className="overlay center" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon"><Icon name="send" size={22} /></div>
        <h2>Send this email now?</h2>
        <p className="muted">It goes out from your Gmail straight away and can't be unsent. If you already saved a Gmail draft for it, that draft is the one sent.</p>
        <dl className="kv">
          <dt>To</dt><dd>{to.join(', ')}</dd>
          {cc.length > 0 && <><dt>Cc</dt><dd>{cc.join(', ')}</dd></>}
          <dt>Subject</dt><dd>{row[F.subject]}</dd>
          <dt>After sending</dt><dd>Status becomes Sent, Sent on is today, follow-up due in 5 days</dd>
        </dl>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn send" onClick={onConfirm} disabled={busy}><Icon name="send" size={16} /> {busy ? 'Sending…' : 'Send to ' + row[F.company]}</button>
        </div>
      </div>
    </div>
  );
}
