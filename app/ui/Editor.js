'use client';
import { useEffect, useState } from 'react';
import { F, stage, emailHtml, emails, placeholders, prettyDate, DEAL_STAGES, MAX_FOLLOW_UPS, suggestedReply } from '@/lib/fields';
import { segmentOf, bandsOf, focusOf, isCompetitor, fmtReach, reachOf } from '@/lib/segments';
import { toolkit, toolkitText } from '@/lib/toolkit';
import { Field, Icon, Pill, Tag, withCurrent, followUpDue, action, ReplyTag, Score, score } from './common';

const EDITABLE = [F.company, F.companyType, F.segment, F.to, F.cc, F.status, F.sentOn, F.subject, F.body, F.reply, F.next, F.notes, F.initiative, F.audience, F.form, F.how, F.suggested, F.deal, F.link, F.leads, F.enrolments, F.contacts, F.followUp];

export default function Editor({ row, statuses, today, busy, hasSegmentCol, linkBase, loadThread, onClose, onSave, onDraft, onSend, onFollowUp, onReply, onMeet, nav }) {
  const [compose, setCompose] = useState(0);
  const [f, setF] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, row[k] || ''])));
  const [name, setName] = useState('');
  const mailed = !!row[F.sentOn] || ['sent', 'replied', 'call'].includes(stage(row[F.status]));
  const [tab, setTab] = useState(() => (mailed ? 'trail' : 'email'));
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
        <div className="timeline">
          <Step on={!!row[F.draftedOn]} label="Drafted" date={row[F.draftedOn]} />
          <Step on={!!row[F.sentOn]} label="Sent" date={row[F.sentOn]} />
          <Step on={nFU > 0} warn={followUpDue(row, today)} label={nFU ? `Follow-up ${nFU}/${MAX_FOLLOW_UPS}` : 'Follow-up'} date={followUpDue(row, today) || (st === 'sent' && nFU < MAX_FOLLOW_UPS) ? row[F.followUp] : row[F.lastFollowUp]} />
          <Step on={!!row[F.repliedOn]} label="Replied" date={row[F.repliedOn]} />
          <Step on={!!row[F.meetingOn]} label="Call" date={row[F.meetingOn]} />
        </div>

        <div className="ptabs">
          {[(mailed ? ['trail', 'Email trail'] : ['email', 'Email']), ['plays', 'Call prep'], ['details', 'Company details']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'trail' && (
          <Trail row={row} load={loadThread} busy={busy} compose={compose}
            canReply={['sent', 'replied', 'call'].includes(st) && !row[F.bouncedOn]}
            onReply={onReply} onMeet={['sent', 'replied', 'call'].includes(st) ? onMeet : null}
            followUp={canFollow ? () => onFollowUp(nFU + 1) : null} nFU={nFU} />
        )}

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

        {tab === 'plays' && <CallKit row={row} seg={seg} bands={bands} focus={focus} />}

        {tab === 'details' && (
          <div className="dsecs">
            {['replied', 'call'].includes(st) || row[F.deal] ? (
              <section className="dsec">
                <h4><Icon name="link" size={15} /> Partnership</h4>
                <div className="deal-steps">
                  {DEAL_STAGES.map((d) => <button key={d} className={'deal-step' + (f[F.deal] === d ? ' on' : '')} onClick={() => setF((x) => ({ ...x, [F.deal]: d }))}>{d}</button>)}
                </div>
                <Field label="Tracking link (share it with the partner to count sign-ups from them)">
                  <div className="namebar">
                    <input value={f[F.link]} onChange={set(F.link)} placeholder="Press Create to make one" />
                    <button className="btn" onClick={makeLink}><Icon name="link" size={16} /> Create</button>
                    {f[F.link] && <button className="btn ghost" onClick={() => navigator.clipboard.writeText(f[F.link])} title="Copy"><Icon name="copy" size={16} /></button>}
                  </div>
                </Field>
                <div className="two">
                  <Field label="Leads from this partner"><input type="number" min="0" value={f[F.leads]} onChange={set(F.leads)} /></Field>
                  <Field label="Enrolments from this partner"><input type="number" min="0" value={f[F.enrolments]} onChange={set(F.enrolments)} /></Field>
                </div>
              </section>
            ) : null}

            <section className="dsec">
              <h4><Icon name="calendar" size={15} /> Status and next step</h4>
              <div className="two">
                <Field label="Status">
                  <select value={f[F.status] || statuses[0]} onChange={set(F.status)}>{withCurrent(statuses, row[F.status]).map((x) => <option key={x}>{x}</option>)}</select>
                </Field>
                <Field label="Next step"><input value={f[F.next]} onChange={set(F.next)} placeholder="What happens next" /></Field>
                <Field label="Sent on"><input type="date" value={f[F.sentOn]} onChange={set(F.sentOn)} /></Field>
                <Field label="Follow-up due"><input type="date" value={f[F.followUp]} onChange={set(F.followUp)} /></Field>
              </div>
            </section>

            <section className="dsec">
              <h4><Icon name="reply" size={15} /> People and how to reach them</h4>
              <div className="two">
                <Field label="Email goes to"><input value={f[F.to]} onChange={set(F.to)} /></Field>
                <Field label="CC"><input value={f[F.cc]} onChange={set(F.cc)} /></Field>
                <Field label="How to reach"><input value={f[F.how]} onChange={set(F.how)} /></Field>
                <Field label="Suggested contact (not in the email)"><input value={f[F.suggested]} onChange={set(F.suggested)} /></Field>
              </div>
              <Field label="Other contacts (name, role, email or LinkedIn, one per line)"><textarea rows={2} value={f[F.contacts]} onChange={set(F.contacts)} /></Field>
              <Field label="Contact form">
                <div className="namebar">
                  <input value={f[F.form]} onChange={set(F.form)} placeholder="Link to their partner or contact form" />
                  {/^https?:\/\//.test(f[F.form]) && <a className="btn" href={f[F.form]} target="_blank" rel="noreferrer">Open</a>}
                </div>
              </Field>
            </section>

            <section className="dsec">
              <h4><Icon name="audience" size={15} /> About them</h4>
              <div className="two">
                <Field label="Company type"><input value={f[F.companyType]} onChange={set(F.companyType)} /></Field>
                {hasSegmentCol ? (
                  <Field label="Segment (overrides the automatic one)"><input value={f[F.segment]} onChange={set(F.segment)} placeholder={seg.name} /></Field>
                ) : (
                  <Field label="Segment"><input value={seg.name} disabled /></Field>
                )}
                <Field label="Audience"><input value={f[F.audience]} onChange={set(F.audience)} /></Field>
                <Field label="Hook used in the email"><input value={f[F.initiative]} onChange={set(F.initiative)} /></Field>
              </div>
              {reachOf(row[F.audience]) > 0 && <p className="muted small">Estimated reach: {fmtReach(reachOf(row[F.audience]))}</p>}
            </section>

            <section className="dsec">
              <h4><Icon name="draft" size={15} /> Notes</h4>
              <Field label="Their reply (summary)"><textarea rows={2} value={f[F.reply]} onChange={set(F.reply)} /></Field>
              <Field label="Notes and flags"><textarea rows={3} value={f[F.notes]} onChange={set(F.notes)} /></Field>
              {row[F.overlap] && <p className="muted small"><b>Overlap line (not in email):</b> {row[F.overlap]}</p>}
            </section>
          </div>
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
              {tab !== 'trail' && (
                <>
              {canFollow && (
                <button className="btn send" disabled={!!busy} onClick={() => onFollowUp(nFU + 1)}>
                  <Icon name="reply" size={16} /> Send follow-up {nFU + 1}
                </button>
              )}
              {['sent', 'replied', 'call'].includes(st) && !row[F.bouncedOn] && (
                <button className="btn" disabled={!!busy} onClick={() => { setTab('trail'); setCompose((n) => n + 1); }} title="Write back at the end of the conversation">
                  <Icon name="reply" size={16} /> {row[F.replyDraft] ? 'Reply (draft saved)' : 'Reply'}
                </button>
              )}
              {['sent', 'replied', 'call'].includes(st) && (
                <button className={'btn' + (st === 'replied' ? ' send' : '')} disabled={!!busy} onClick={onMeet}>
                  <Icon name="calendar" size={16} /> {st === 'call' ? 'Book another call' : 'Book call'}
                </button>
              )}
                </>
              )}
              {!canFollow && st === 'sent' && <span className="muted small">{row[F.bouncedOn] ? 'Bounced.' : nFU >= MAX_FOLLOW_UPS ? 'Both follow-ups sent.' : ''} Sync picks up replies.</span>}
              {st === 'closed' && <span className="muted small">{/^skip/i.test(row[F.status] || '') ? `Skip: never emailed. ${String(row[F.notes] || '').replace(/^skip:?\s*/i, '').slice(0, 140)}` : `Closed as ${row[F.status]}.`}</span>}
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

function Trail({ row, load, busy, compose, canReply, onReply, onMeet, followUp, nFU }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let live = true;
    load(row._row).then((d) => live && setState({ data: d }), (e) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [row._row]);
  if (state.loading) return <div className="trail-empty"><div className="loader small" /> Loading the conversation from Gmail…</div>;
  if (state.error) return <p className="warn-text">{state.error}</p>;
  const msgs = state.data?.messages || [];
  const last = msgs.length - 1;
  return (
    <div className="convo">
      <div className="convo-top">
        <div>
          <div className="convo-subject">{msgs[0]?.subject || row[F.subject] || row[F.company]}</div>
          <span className="muted small">{msgs.length ? `${msgs.length} email${msgs.length > 1 ? 's' : ''}${state.data.threads > 1 ? ` across ${state.data.threads} Gmail threads` : ''}, oldest first` : 'No emails found in Gmail yet'}</span>
        </div>
        {state.data.url && <a className="btn ghost small" href={state.data.url} target="_blank" rel="noreferrer">Open in Gmail</a>}
      </div>
      {!msgs.length && <p className="muted small">Emails sent outside the hub show up here once Sync matches them to this partner.</p>}
      {msgs.map((m, i) => (
        <Msg key={m.id || i} m={m} company={row[F.company]} startsThread={i > 0 && m.thread && m.thread !== msgs[i - 1].thread}
          open={i === last || (!m.mine && !m.bounce && i >= last - 2)} />
      ))}
      {canReply && <Composer key={compose} row={row} who={state.data.reply} them={theirName(msgs, row[F.company])} busy={busy} startOpen={compose > 0} onReply={onReply} onMeet={onMeet} followUp={followUp} nFU={nFU} />}
    </div>
  );
}

/** First name of whoever wrote to us last, if it looks like a person (not "Team" or a company inbox). */
function theirName(msgs, company) {
  const m = [...msgs].reverse().find((x) => !x.mine && !x.bounce);
  if (!m) return '';
  const n = nameOf(m.from).split(/\s+/)[0] || '';
  if (String(company || '').toLowerCase().includes(n.toLowerCase())) return '';
  return /^[A-Z][a-z]{1,20}$/.test(n) && !/^(team|info|hello|support|admin|partnerships?|contact|marketing|sales|no|the)$/i.test(n) ? n : '';
}

const nameOf = (from) => String(from || '').replace(/<.*>/, '').replace(/"/g, '').trim() || String(from || '');
const addrOf = (from) => (String(from || '').match(/<([^>]+)>/) || [, from])[1];

function Msg({ m, company, open: startOpen, startsThread }) {
  const [open, setOpen] = useState(startOpen);
  const d = new Date(m.date);
  const when = d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const who = m.bounce ? 'Mail Delivery Subsystem' : m.mine ? 'You' : nameOf(m.from);
  const to = [m.to, m.cc].filter(Boolean).join(', ').replace(/"([^"]*)"\s*/g, '$1 ');
  return (
    <>
      {startsThread && <div className="convo-split"><span>{m.subject}</span></div>}
      <div className={'gmsg' + (open ? ' open' : '') + (m.bounce ? ' bounce' : '')}>
        <button className="gmsg-head" onClick={() => setOpen(!open)}>
          <span className={'avatar' + (m.mine ? ' me' : '')}>{m.bounce ? '!' : who.slice(0, 1).toUpperCase()}</span>
          <span className="gmsg-meta">
            <span className="gmsg-who">{who} {!m.mine && !m.bounce && <span className="muted small">&lt;{addrOf(m.from)}&gt;</span>}</span>
            {open ? <span className="muted small gmsg-to">to {to || 'you'}</span> : <span className="muted small gmsg-snip">{String(m.text).replace(/\s+/g, ' ').slice(0, 110)}</span>}
          </span>
          <span className="muted small gmsg-when">{when}</span>
        </button>
        {open && <div className="msg-body gmsg-body" dangerouslySetInnerHTML={{ __html: emailHtml(m.text, company) }} />}
      </div>
    </>
  );
}

/** Gmail-style reply box at the end of the conversation: reply-all, draft or send (with one confirm). */
function Composer({ row, who, them, busy, startOpen, onReply, onMeet, followUp, nFU }) {
  const [open, setOpen] = useState(startOpen || !!row[F.replyDraft]);
  const suggestion = row[F.replyDraft] ? '' : suggestedReply(row, them);
  const [text, setText] = useState(() => row[F.replyDraft] || suggestion);
  const [sure, setSure] = useState(false);
  const ref = (el) => { if (el && startOpen) el.scrollIntoView({ block: 'nearest' }); };
  const left = placeholders(text);
  const rcpt = who ? [...(who.to || []), ...(who.cc || [])] : [];
  const ready = who && rcpt.length && text.trim() && !left.length;
  if (!open) {
    return (
      <div className="convo-actions">
        <button className="btn" onClick={() => setOpen(true)} disabled={!!busy}><Icon name="reply" size={16} /> Reply all</button>
        {followUp && <button className="btn send" onClick={followUp} disabled={!!busy}><Icon name="reply" size={16} /> Send follow-up {nFU + 1}</button>}
        {onMeet && <button className="btn" onClick={onMeet} disabled={!!busy}><Icon name="calendar" size={16} /> Book call</button>}
      </div>
    );
  }
  return (
    <div className="gcompose" ref={ref}>
      <div className="gcompose-head">
        <Icon name="reply" size={16} />
        {who ? <span><span className="muted">To</span> {(who.to || []).join(', ') || '(nobody)'}{who.cc?.length ? <><span className="muted"> · Cc</span> {who.cc.join(', ')}</> : null}</span>
          : <span className="warn-text">No Gmail thread with {row[F.company]} to reply in. Reply from Gmail this time.</span>}
      </div>
      <textarea rows={9} value={text} placeholder={`Write your reply to ${row[F.company]}…`} onChange={(e) => { setText(e.target.value); setSure(false); }} autoFocus={startOpen} />
      <p className="muted small">{row[F.replyDraft] ? 'Your saved draft.' : suggestion ? 'Suggested from their last message. Read it and edit before sending.' : 'No suggestion here: this one needs your own answer.'}</p>
      {left.length > 0 && <p className="warn-text small">Fill in {left.join(', ')} first.</p>}
      {row[F.lastReplySent] && <p className="muted small">Last reply sent {prettyDate(row[F.lastReplySent])}.</p>}
      {sure && <div className="banner">Send this to {rcpt.join(', ')} now? It can't be unsent.</div>}
      <div className="gcompose-actions">
        {!sure ? (
          <button className="btn send" disabled={!!busy || !ready} onClick={() => setSure(true)}><Icon name="send" size={16} /> Send</button>
        ) : (
          <button className="btn send" disabled={!!busy || !ready} onClick={() => onReply(text, 'send')}><Icon name="send" size={16} /> {busy === 'send' ? 'Sending…' : 'Yes, send it'}</button>
        )}
        <button className="btn" disabled={!!busy || !ready} onClick={() => onReply(text, 'draft')}><Icon name="draft" size={16} /> {busy === 'draft' ? 'Saving…' : 'Save as Gmail draft'}</button>
        <span className="spacer" />
        {onMeet && <button className="btn ghost" onClick={onMeet} disabled={!!busy}><Icon name="calendar" size={16} /> Book call</button>}
        <button className="btn ghost" onClick={() => { setOpen(false); setSure(false); }} disabled={!!busy}>Close</button>
      </div>
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

/** Call prep: how to open, what to ask, what to say, offers, pushback, close. Built from the first-call kit and their reply. */
function CallKit({ row, seg, bands, focus }) {
  const k = toolkit(row, seg, bands);
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  const asks = more ? k.ask : k.ask.slice(0, 8);
  const copy = async () => { try { await navigator.clipboard.writeText(toolkitText(row, k)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return (
    <div className="kit">
      <div className="kit-goal">
        <div>
          <div className="kit-label">Goal of the call</div>
          <p>{k.goal}</p>
        </div>
        <button className="btn ghost small" onClick={copy}><Icon name="copy" size={14} /> {copied ? 'Copied' : 'Copy as notes'}</button>
      </div>

      {k.where.length > 0 && (
        <dl className="kit-where">
          {k.where.map((w) => <div key={w.label}><dt>{w.label}</dt><dd>{w.text}</dd></div>)}
        </dl>
      )}

      <KitSection n="1" title="How to open">
        {k.open.map((x, i) => <p key={i} className="kit-say">"{x}"</p>)}
        <div className="kit-agenda">{k.agenda.map(([t, x]) => <div key={t}><b>{t}</b><span>{x}</span></div>)}</div>
      </KitSection>

      <KitSection n="2" title="What to ask" hint="Ask five or six, not all. Must-asks matter on every call.">
        <ol className="kit-list">
          {asks.map((a, i) => <li key={i}>{a.must && <span className="kit-must">Must-ask</span>} {a.q}{a.why && <span className="muted small kit-why"> {a.why}</span>}</li>)}
        </ol>
        {k.ask.length > 8 && <button className="btn ghost small" onClick={() => setMore(!more)}>{more ? 'Show fewer' : `Show all ${k.ask.length} questions`}</button>}
        <p className="muted small">Listen for: audience overlap with working engineers who want top-tier roles, an upcoming slot we can fill, and whether they need money (sponsorship) or value (content for members).</p>
      </KitSection>

      <KitSection n="3" title="What to say" hint="About 90 seconds. Talk about their members, not our programmes.">
        <div className="kit-beats">{k.say.map((b) => <div key={b.beat}><b>{b.beat}</b><p>{b.text}</p></div>)}</div>
      </KitSection>

      <KitSection n="4" title="What we can offer them" hint={`Lead with one or two, picked for a ${seg.name.toLowerCase()} partner.`}>
        <div className="kit-offers">
          {k.offers.map((o, i) => <div key={o.title} className="kit-offer"><span className="play-n">{i + 1}</span><h5>{o.title}</h5><p>{o.how}</p><p className="muted small"><b>Ask:</b> {o.ask}</p></div>)}
        </div>
        {k.extra.map((b) => <div key={b.band} className="bp"><b>{b.band}: {b.hook}</b><ul>{b.plays.map((x) => <li key={x}>{x}</li>)}</ul></div>)}
        {focus.length > 0 && <div className="chips">{focus.map((x) => <span key={x} className="chip static">{x}</span>)}</div>}
      </KitSection>

      <KitSection n="5" title="If they say…">
        <div className="kit-obj">{k.objections.map((o) => <div key={o.they}><b>{o.they}</b><p>{o.you}</p></div>)}</div>
      </KitSection>

      <KitSection n="6" title="Close and next steps">
        <ul className="kit-list plain">{k.close.map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="kit-label" style={{ marginTop: 10 }}>After the call</div>
        <ul className="kit-list plain">{k.after.map((x) => <li key={x}>{x}</li>)}</ul>
      </KitSection>

      <div className="kit-rules">
        <div><div className="kit-label">Facts you can say</div><ul>{k.facts.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><div className="kit-label">Do not</div><ul>{k.dont.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

function KitSection({ n, title, hint, children }) {
  return (
    <section className="kit-sec">
      <h4><span className="kit-n">{n}</span> {title}</h4>
      {hint && <p className="muted small kit-hint">{hint}</p>}
      {children}
    </section>
  );
}
