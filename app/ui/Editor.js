'use client';
import { useEffect, useState } from 'react';
import { F, stage, emailHtml, emails, placeholders, prettyDate, DEAL_STAGES, MAX_FOLLOW_UPS } from '@/lib/fields';
import { segmentOf, bandsOf, focusOf, isCompetitor, fmtReach, reachOf } from '@/lib/segments';
import { Field, Icon, Pill, Tag, withCurrent, followUpDue, action, ReplyTag, Score, score } from './common';

const EDITABLE = [F.company, F.companyType, F.segment, F.to, F.cc, F.status, F.sentOn, F.subject, F.body, F.reply, F.next, F.notes, F.initiative, F.audience, F.form, F.how, F.suggested, F.deal, F.link, F.leads, F.enrolments, F.contacts, F.followUp];

export default function Editor({ row, statuses, today, busy, hasSegmentCol, linkBase, loadThread, onClose, onSave, onDraft, onSend, onFollowUp, onMeet, nav }) {
  const [f, setF] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, row[k] || ''])));
  const [name, setName] = useState('');
  const [tab, setTab] = useState(() => (stage(row[F.status]) === 'new' && !row[F.sentOn] ? 'email' : 'trail'));
  const [mode, setMode] = useState('preview');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const changed = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== (row[k] || '')));
  const dirty = Object.keys(changed).length > 0;
  const left = placeholders(f[F.subject] + f[F.body]);
  const to = emails(f[F.to]);
  const canMail = to.length > 0 && !left.length && f[F.subject].trim() && f[F.body].trim();
  const st = stage(row[F.status]);
  const seg = segmentOf({ ...row, ...f });
  const go = (fn) => { if (!fn) return; if (dirty) onSave(changed); fn(); };
  useEffect(() => {
    if (!nav) return undefined;
    const onKey = (ev) => {
      const t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (ev.key === 'ArrowRight' && nav.next) { ev.preventDefault(); go(nav.next); }
      if (ev.key === 'ArrowLeft' && nav.prev) { ev.preventDefault(); go(nav.prev); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const bands = bandsOf({ ...row, ...f });
  const focus = focusOf({ ...row, ...f });
  const a = action(row, today);
  const nFU = Number(row[F.followUps]) || 0;
  const canFollow = st === 'sent' && !row[F.bouncedOn] && nFU < MAX_FOLLOW_UPS && to.length > 0;
  const slug = String(row[F.company] || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const makeLink = () => setF((x) => ({ ...x, [F.link]: (linkBase || 'https://interviewkickstart.com/in') + (String(linkBase || '').includes('?') ? '&' : '?') + 'utm_source=' + slug + '&utm_medium=partner&utm_campaign=partner_hub' }));

  function putName() {
    if (!name.trim()) return;
    const n = name.trim();
    const fix = (t) => t.split('[Name]').join(n).replace(/^Hi,/, 'Hi ' + n + ',');
    setF((x) => ({ ...x, [F.body]: fix(x[F.body]), [F.subject]: x[F.subject].split('[Name]').join(n) }));
  }

  async function copy() {
    const html = emailHtml(f[F.body], f[F.company] || row[F.company]);
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
            <div className="panel-kicker"><span className={'seg seg-' + seg.key}>{seg.name}</span> <Pill status={row[F.status]} /> <Tag tone={a.tone}>{a.label}</Tag> <ReplyTag row={row} /> <Score value={score(row)} /></div>
            <h2>{row[F.company]}</h2>
            <p className="muted small">{[row[F.companyType], row[F.route], row[F.verification]].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="panel-nav">
            {nav && nav.total > 1 && (
              <>
                <button className="icon-btn" onClick={() => go(nav.prev)} disabled={!nav.prev} aria-label="Previous partner" title="Previous (←)"><Icon name="chevl" /></button>
                <span className="muted small">{nav.pos} of {nav.total}{nav.label ? ' · ' + nav.label : ''}</span>
                <button className="btn small" onClick={() => go(nav.next)} disabled={!nav.next} title="Next (→)">Next <Icon name="arrow" size={14} /></button>
              </>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
        </div>

        {isCompetitor(row) && <div className="banner red">Possible competitor. Decide before sending.</div>}
        {row[F.bouncedOn] && <div className="banner red">The email to {row[F.to]} bounced on {prettyDate(row[F.bouncedOn])}. Find a new contact, change To, then set Status back to Not sent.</div>}
        {row[F.reply] && ['replied', 'call', 'closed'].includes(st) && (
          <div className="reply-card">
            <div className="reply-head"><Icon name="reply" size={16} /> <b>Their reply</b> <ReplyTag row={row} /> <span className="muted small">{prettyDate(row[F.repliedOn])}</span></div>
            <p>{row[F.reply]}</p>
          </div>
        )}

        <div className="timeline">
          <Step on={!!row[F.draftedOn]} label="Drafted" date={row[F.draftedOn]} />
          <Step on={!!row[F.sentOn]} label="Sent" date={row[F.sentOn]} />
          <Step on={nFU > 0} warn={followUpDue(row, today)} label={nFU ? `Follow-up ${nFU}/${MAX_FOLLOW_UPS}` : 'Follow-up'} date={followUpDue(row, today) || (st === 'sent' && nFU < MAX_FOLLOW_UPS) ? row[F.followUp] : row[F.lastFollowUp]} />
          <Step on={!!row[F.repliedOn]} label="Replied" date={row[F.repliedOn]} />
          <Step on={!!row[F.meetingOn]} label="Call" date={row[F.meetingOn]} />
        </div>

        <div className="ptabs">
          {[...(st !== 'new' || row[F.sentOn] ? [['trail', 'Email trail']] : []), ['email', st === 'new' ? 'Email' : 'First email'], ['plays', 'Plays for the call'], ['details', 'Company details']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'trail' && <Trail row={row} load={loadThread} />}

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
                <div className="mail" onDoubleClick={() => setMode('edit')} title="Double-click to edit" dangerouslySetInnerHTML={{ __html: emailHtml(f[F.body], f[F.company] || row[F.company]) }} />
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
            {['replied', 'call'].includes(st) || row[F.deal] ? (
              <div className="deal-box">
                <h3 style={{ marginTop: 0 }}>Partnership</h3>
                <div className="deal-steps">
                  {DEAL_STAGES.map((d) => <button key={d} className={'deal-step' + (f[F.deal] === d ? ' on' : '')} onClick={() => setF((x) => ({ ...x, [F.deal]: d }))}>{d}</button>)}
                </div>
                <Field label="Tracking link (share with the partner so you can count sign-ups from them)">
                  <div className="namebar">
                    <input value={f[F.link]} onChange={set(F.link)} placeholder="Create one with the button" />
                    <button className="btn" onClick={makeLink}><Icon name="link" size={16} /> Create</button>
                    {f[F.link] && <button className="btn ghost" onClick={() => navigator.clipboard.writeText(f[F.link])}><Icon name="copy" size={16} /></button>}
                  </div>
                </Field>
                <div className="two">
                  <Field label="Leads from this partner"><input type="number" min="0" value={f[F.leads]} onChange={set(F.leads)} /></Field>
                  <Field label="Enrolments from this partner"><input type="number" min="0" value={f[F.enrolments]} onChange={set(F.enrolments)} /></Field>
                </div>
              </div>
            ) : null}
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
              <Field label="Follow-up due"><input type="date" value={f[F.followUp]} onChange={set(F.followUp)} /></Field>
            </div>
            <Field label="Other contacts (name, role, email or LinkedIn, one per line)"><textarea rows={3} value={f[F.contacts]} onChange={set(F.contacts)} /></Field>
            {reachOf(row[F.audience]) > 0 && <p className="muted small">Estimated reach: {fmtReach(reachOf(row[F.audience]))} (from the Audience column)</p>}
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
            <>
              {canFollow && (
                <button className="btn send" disabled={!!busy} onClick={() => onFollowUp(nFU + 1)}>
                  <Icon name="reply" size={16} /> Send follow-up {nFU + 1}
                </button>
              )}
              {['sent', 'replied', 'call'].includes(st) && (
                <button className={'btn' + (st === 'replied' ? ' send' : '')} disabled={!!busy} onClick={onMeet}>
                  <Icon name="calendar" size={16} /> {st === 'call' ? 'Book another call' : 'Book call'}
                </button>
              )}
              {!canFollow && st === 'sent' && <span className="muted small">{row[F.bouncedOn] ? 'Bounced.' : nFU >= MAX_FOLLOW_UPS ? 'Both follow-ups sent.' : ''} Sync picks up replies.</span>}
              {st === 'closed' && <span className="muted small">Closed as {row[F.status]}.</span>}
            </>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={copy} title="Copy email with bold"><Icon name="copy" size={16} /></button>
          <button className="btn primary" disabled={!dirty || !!busy} onClick={() => onSave(changed)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
        </div>
      </aside>
    </div>
  );
}

function Trail({ row, load }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    load(row._row).then((d) => live && setState({ data: d }), (e) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [row._row]);
  if (state.loading) return <div className="trail-empty"><div className="loader small" /> Loading the email trail from Gmail…</div>;
  if (state.error) return <p className="warn-text">{state.error}</p>;
  const msgs = state.data?.messages || [];
  if (!msgs.length) return <p className="muted">No emails found in Gmail for this partner yet. Emails sent outside the hub show up here once their subject matches the one on this row.</p>;
  return (
    <div className="trail">
      <div className="trail-top">
        <span className="muted small">{msgs.length} email{msgs.length > 1 ? 's' : ''} · labelled "Partnership Outreach" in Gmail</span>
        {state.data.url && <a className="btn ghost small" href={state.data.url} target="_blank" rel="noreferrer">Open in Gmail</a>}
      </div>
      {msgs.map((m, i) => <Msg key={i} m={m} first={i === 0} company={row[F.company]} />)}
    </div>
  );
}

function Msg({ m, first, company }) {
  const [open, setOpen] = useState(!first || !m.mine);
  const when = new Date(m.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const who = m.bounce ? 'Delivery failed' : m.mine ? 'You' : String(m.from).replace(/<.*>/, '').replace(/"/g, '').trim() || m.from;
  return (
    <div className={'msg' + (m.mine ? ' mine' : '') + (m.bounce ? ' bounce' : '')}>
      <button className="msg-head" onClick={() => setOpen(!open)}>
        <span className="msg-who">{m.bounce && <Icon name="warn" size={14} />} {who}</span>
        <span className="muted small">{when}</span>
      </button>
      {!m.mine && !m.bounce && <div className="muted small msg-addr">{m.from}</div>}
      {open ? <div className="msg-body" dangerouslySetInnerHTML={{ __html: emailHtml(m.text, company) }} /> : <div className="msg-body clipped">{String(m.text).slice(0, 140)}…</div>}
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
