'use client';
import { useState } from 'react';
import { F, emails, emailHtml, placeholders, prettyDate, addDays, SUGGESTED_FOLLOW_UPS, MAX_FOLLOW_UPS, SECOND_FOLLOW_UP_DAYS } from '@/lib/fields';
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
      {preview ? <div className="mailbox"><div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(text) }} /></div> : <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} />}
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
