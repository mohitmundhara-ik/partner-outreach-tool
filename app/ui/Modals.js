'use client';
import { useEffect, useRef, useState } from 'react';
import { F, emails, emailHtml, placeholders, prettyDate, addDays, SUGGESTED_FOLLOW_UPS, MAX_FOLLOW_UPS, SECOND_FOLLOW_UP_DAYS, suggestedReply } from '@/lib/fields';
import { segmentOf, bandsOf } from '@/lib/segments';
import { Modal, Icon, Field } from './common';

const fillCompany = (t, company) => String(t || '').split('[Company]').join(company);
const toTemplate = (t, company) => (company ? String(t || '').split(company).join('[Company]') : t);

export function FollowUpModal({ row, n, template, busy, today, onCancel, onSend, onSaveTemplate }) {
  const saved = n === 1 ? template?.followUp1 : template?.followUp2;
  const [text, setText] = useState(() => fillCompany(saved || SUGGESTED_FOLLOW_UPS[n - 1], row[F.company]));
  const [preview, setPreview] = useState(false);
  const to = emails(row[F.to]), cc = emails(row[F.cc]);
  const left = placeholders(text);
  return (
    <Modal icon="reply" title={`Send follow-up ${n} to ${row[F.company]}?`} onClose={onCancel} wide>
      <p className="muted">It goes as a reply in the same Gmail thread as your first email ("{row[F.subject]}"), from your Gmail, straight away. It can't be unsent.</p>
      {!saved && <div className="banner">This is suggested text. Edit it, then press "Save as my template" so every follow-up {n} uses your wording.</div>}
      <dl className="kv">
        <dt>To</dt><dd>{to.join(', ')}</dd>
        {cc.length > 0 && <><dt>Cc</dt><dd>{cc.join(', ')}</dd></>}
        <dt>First email</dt><dd>sent {prettyDate(row[F.sentOn])}</dd>
        <dt>After sending</dt><dd>{n < MAX_FOLLOW_UPS ? `Follow-up ${n + 1} due ${prettyDate(addDays(today, SECOND_FOLLOW_UP_DAYS))}` : 'No more follow-ups scheduled'}</dd>
      </dl>
      <div className="seg-toggle" style={{ marginBottom: 8 }}>
        <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Edit</button>
        <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview ? <div className="mailbox"><div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(text, row[F.company]) }} /></div> : <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />}
      {left.length > 0 && <p className="warn-text small">Fill in {left.join(', ')} first.</p>}
      <div className="modal-actions">
        <button className="btn ghost" disabled={busy} onClick={() => onSaveTemplate(n === 1 ? 'f1' : 'f2', toTemplate(text, row[F.company]))}>Save as my template</button>
        <span className="spacer" />
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn send" onClick={() => onSend(text)} disabled={busy || !text.trim() || left.length > 0}><Icon name="reply" size={16} /> {busy ? 'Sending…' : 'Send follow-up'}</button>
      </div>
    </Modal>
  );
}

/**
 * Write back to a partner in their Gmail thread (reply-all to the latest message).
 * Shows who it goes to first, then saves it as a Gmail draft or sends it after a second confirm.
 */
export function ReplyModal({ row, busy, loadPreview, onCancel, onReply }) {
  const [text, setText] = useState(() => row[F.replyDraft] || suggestedReply(row));
  const [preview, setPreview] = useState(false);
  const [who, setWho] = useState(null);
  const [whoErr, setWhoErr] = useState('');
  const [sure, setSure] = useState(false);
  useEffect(() => {
    let live = true;
    loadPreview(row._row).then((w) => live && setWho(w)).catch((e) => live && setWhoErr(e.message));
    return () => { live = false; };
  }, [row._row]);
  const left = placeholders(text);
  const ready = who && !whoErr && text.trim() && !left.length;
  const rcpt = who ? [...(who.to || []), ...(who.cc || [])].join(', ') : '';
  return (
    <Modal icon="reply" title={`Reply to ${row[F.company]}`} onClose={onCancel} wide>
      <p className="muted">Goes as a reply-all to their latest message, in the same Gmail thread, from your Gmail. Save it as a draft to finish it in Gmail, or send it from here.</p>
      {whoErr ? <div className="banner red">{whoErr}</div> : (
        <dl className="kv">
          <dt>Thread</dt><dd>{who ? <a href={who.url} target="_blank" rel="noreferrer">{who.subject}</a> : 'Finding the thread…'}</dd>
          {who && <><dt>Latest from</dt><dd>{who.lastFrom} · {prettyDate(String(who.lastDate || '').slice(0, 10))}</dd></>}
          {who && <><dt>To</dt><dd>{(who.to || []).join(', ') || '(nobody)'}</dd></>}
          {who && who.cc?.length > 0 && <><dt>Cc</dt><dd>{who.cc.join(', ')}</dd></>}
          {row[F.lastReplySent] && <><dt>Last reply sent</dt><dd>{prettyDate(row[F.lastReplySent])}</dd></>}
        </dl>
      )}
      {row[F.reply] && <p className="small"><b>What they said:</b> {row[F.reply]}</p>}
      <div className="seg-toggle" style={{ marginBottom: 8 }}>
        <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Edit</button>
        <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
      </div>
      {preview ? <div className="mailbox"><div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(text, row[F.company]) }} /></div> : <textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); setSure(false); }} />}
      {left.length > 0 && <p className="warn-text small">Fill in {left.join(', ')} first.</p>}
      {sure && <div className="banner">Send this reply to {rcpt} now? It can't be unsent.</div>}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <span className="spacer" />
        <button className="btn" disabled={busy || !ready} onClick={() => onReply(text, 'draft')}><Icon name="draft" size={16} /> {busy === 'draft' ? 'Saving…' : 'Save as Gmail draft'}</button>
        {!sure ? (
          <button className="btn send" disabled={busy || !ready} onClick={() => setSure(true)}><Icon name="reply" size={16} /> Send reply</button>
        ) : (
          <button className="btn send" disabled={busy || !ready} onClick={() => onReply(text, 'send')}><Icon name="send" size={16} /> {busy === 'send' ? 'Sending…' : 'Yes, send it'}</button>
        )}
      </div>
    </Modal>
  );
}

function briefFor(row) {
  const seg = segmentOf(row);
  const bands = bandsOf(row);
  return [
    `Call with ${row[F.company]} (${seg.name})`,
    row[F.companyType] && `Type: ${row[F.companyType]}`,
    row[F.audience] && `Audience: ${row[F.audience]}`,
    bands.length && `Bands: ${bands.map((b) => b.name).join(', ')}`,
    row[F.reply] && `\nTheir reply: ${row[F.reply]}`,
    '\nPlays to pitch:',
    ...seg.plays.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}. Ask: ${p.ask}`),
    ...bands.slice(0, 2).map((b) => `For ${b.name.toLowerCase()}: ${b.plays[0]}`),
    row[F.link] && `\nTracking link: ${row[F.link]}`,
  ].filter(Boolean).join('\n');
}

export function MeetModal({ row, busy, onCancel, onBook }) {
  const tomorrow = new Date(Date.now() + 864e5);
  const [date, setDate] = useState(tomorrow.toLocaleDateString('en-CA'));
  const [time, setTime] = useState('11:00');
  const [minutes, setMinutes] = useState(30);
  const [invite, setInvite] = useState(false);
  const [guests, setGuests] = useState('');
  const [title, setTitle] = useState(`Interview Kickstart x ${row[F.company]}`);
  const [brief, setBrief] = useState(() => briefFor(row));
  const to = emails(row[F.to]);
  const start = new Date(`${date}T${time}:00`);
  return (
    <Modal icon="calendar" title={`Book a call with ${row[F.company]}`} onClose={onCancel} wide>
      <p className="muted">Creates an event in your Google Calendar with a call brief, and marks the partner Call booked.</p>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="three">
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Length">
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} disabled={!to.length} />
        <span>Send a calendar invite to {to.join(', ') || 'the partner (no email on file)'}</span>
      </label>
      {invite && <Field label="Other guests (optional)"><input value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="name@company.com" /></Field>}
      {invite ? (
        <p className="muted small">Guests can read an event's description, so the event gets a short neutral note instead of your call brief. Your brief stays in the hub under "Plays for the call".</p>
      ) : (
        <Field label="Call brief (saved in the event description, only you can see it)"><textarea rows={8} value={brief} onChange={(e) => setBrief(e.target.value)} /></Field>
      )}
      <p className="muted small">Add a Google Meet link from Calendar after it is created if you need one.</p>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn send" disabled={busy || isNaN(start)} onClick={() => onBook({ start: start.toISOString(), minutes, invite, guests, title, brief: invite ? `Partnership conversation: Interview Kickstart and ${row[F.company]}.` : brief })}>
          <Icon name="calendar" size={16} /> {busy ? 'Booking…' : invite ? 'Create event and send invite' : 'Create event'}
        </button>
      </div>
    </Modal>
  );
}

/** Send several ready partners one after another, after one confirm. Stops on the first error or when you press Stop. */
export function BulkSendModal({ rows, demo, cap, used, onSendOne, onClose }) {
  const [phase, setPhase] = useState('confirm'); // confirm | sending | done
  const [state, setState] = useState({}); // row id -> 'sending' | 'sent' | error text
  const [stop, setStop] = useState(false);
  const stopRef = useRef(false);
  const left = Math.max(0, cap - used);
  const list = rows.slice(0, demo ? rows.length : left);
  const over = rows.length - list.length;
  const sent = Object.values(state).filter((v) => v === 'sent').length;

  async function run() {
    setPhase('sending');
    for (const r of list) {
      if (stopRef.current) break;
      setState((s) => ({ ...s, [r._row]: 'sending' }));
      try {
        await onSendOne(r._row);
        setState((s) => ({ ...s, [r._row]: 'sent' }));
      } catch (e) {
        setState((s) => ({ ...s, [r._row]: e.message || 'Failed' }));
        break;
      }
    }
    setPhase('done');
  }
  const halt = () => { stopRef.current = true; setStop(true); };

  return (
    <Modal icon="send" title={phase === 'confirm' ? `Send ${list.length} email${list.length === 1 ? '' : 's'} now?` : phase === 'sending' ? `Sending ${sent + 1} of ${list.length}…` : `${sent} sent`} wide onClose={phase === 'sending' ? undefined : () => onClose(sent)}>
      {phase === 'confirm' && (
        <p className="muted">Each one goes out from your Gmail, one at a time, exactly as written in its row (a matching Gmail draft is sent if you saved one). They can't be unsent. Each row becomes Sent with a follow-up due in 5 days.</p>
      )}
      {over > 0 && phase === 'confirm' && <div className="banner amber">Your daily cap is {cap} and {used} are used today, so only the first {list.length} will be sent. The other {over} stay ready for tomorrow.</div>}
      <div className="bulk-list">
        {list.map((r) => {
          const st = state[r._row];
          return (
            <div key={r._row} className={'bulk-row' + (st === 'sent' ? ' ok' : st && st !== 'sending' ? ' bad' : '')}>
              <span className="strong">{r[F.company]}</span>
              <span className="muted small">{emails(r[F.to]).join(', ')}</span>
              <span className="bulk-st small">{!st ? '' : st === 'sending' ? 'Sending…' : st === 'sent' ? 'Sent' : st}</span>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        {phase === 'confirm' && <>
          <button className="btn" onClick={() => onClose(0)}>Cancel</button>
          <button className="btn send" onClick={run} disabled={!list.length}><Icon name="send" size={16} /> Send {list.length} email{list.length === 1 ? '' : 's'}</button>
        </>}
        {phase === 'sending' && <button className="btn" onClick={halt} disabled={stop}>{stop ? 'Stopping after this one…' : 'Stop'}</button>}
        {phase === 'done' && <button className="btn primary" onClick={() => onClose(sent)}>Done</button>}
      </div>
    </Modal>
  );
}
