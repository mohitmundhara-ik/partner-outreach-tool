'use client';
import { useMemo, useState, useEffect, Fragment } from 'react';
import { F, emails, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, isCompetitor } from '@/lib/segments';
import { hasEmail, missing, isReady, followUpDue, withCurrent, SegTag, Tag, action, stageClass, Score, score, ReplyTag, Icon } from './common';

const isUrl = (v) => /^https?:\/\//.test(String(v || '').trim());
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'link'; } };
/** Link to this partner's own row in the Emails tab (gid 0). */
export const rowLink = (sheetUrl, row) => {
  const base = String(sheetUrl || '').split('#')[0].replace(/\/(edit|view|htmlview).*$/, '').replace(/\?.*$/, '');
  return base && row ? base + '/edit#gid=0&range=A' + row : '';
};

/** Everything the sheet knows about a partner, shown under its row. Empty fields are left out. */
export function PartnerDetails({ r, sheetUrl, onOpen }) {
  const fu = Number(r[F.followUps]) || 0;
  const followText = [
    fu ? `${fu} sent${r[F.lastFollowUp] ? ', last on ' + prettyDate(r[F.lastFollowUp]) : ''}` : '',
    r[F.followUp] && !r[F.bouncedOn] && !r[F.repliedOn] ? 'next due ' + prettyDate(r[F.followUp]) : '',
  ].filter(Boolean).join(' · ');
  const replyHead = [r[F.replyType], r[F.repliedOn] && 'on ' + prettyDate(r[F.repliedOn])].filter(Boolean).join(' ');
  const items = [
    ['Audience', r[F.audience]],
    ['Contact', [r[F.suggested], r[F.how]].filter(Boolean).join('\n')],
    [r[F.sentOn] ? 'Mail sent' : 'Mail goes to', [r[F.sentOn] && prettyDate(r[F.sentOn]), hasEmail(r) && 'to ' + emails(r[F.to]).join(', '), r[F.cc] && 'cc ' + r[F.cc]].filter(Boolean).join(' ')],
    ['Follow-ups', followText],
    ['Bounced', r[F.bouncedOn] && prettyDate(r[F.bouncedOn]) + '. Find a new contact.'],
    ['Their reply', [replyHead, r[F.reply]].filter(Boolean).join(': ')],
    ['Our reply', r[F.lastReplySent] ? 'Sent ' + prettyDate(r[F.lastReplySent]) : r[F.replyDraft] ? 'Draft ready in the hub, not sent' : ''],
    ['Next step', r[F.next]],
    ['Call', r[F.meetingOn] && prettyDate(r[F.meetingOn])],
    ['Partnership', [r[F.deal], r[F.leads] && r[F.leads] + ' leads', r[F.enrolments] && r[F.enrolments] + ' enrolments'].filter(Boolean).join(' · ')],
    ['Hook in email', r[F.initiative]],
    ['Notes', r[F.notes]],
  ].filter(([, v]) => v && String(v).trim());
  const links = [
    rowLink(sheetUrl, r._row) && { href: rowLink(sheetUrl, r._row), label: 'Row ' + r._row + ' in the sheet' },
    isUrl(r[F.initiativeSource]) && { href: r[F.initiativeSource].trim(), label: 'Latest news: ' + host(r[F.initiativeSource].trim()) },
    isUrl(r[F.form]) && { href: r[F.form].trim(), label: 'Contact form' },
    isUrl(r[F.link]) && { href: r[F.link].trim(), label: 'Tracking link' },
  ].filter(Boolean);
  return (
    <div className="pdetail">
      <dl>
        {items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}
      </dl>
      <div className="pdetail-links">
        {links.map((l) => <a key={l.href} className="btn small" href={l.href} target="_blank" rel="noreferrer"><Icon name="link" size={14} /> {l.label}</a>)}
        <button className="btn small" onClick={onOpen}><Icon name="reply" size={14} /> Email trail and actions</button>
      </div>
    </div>
  );
}

export default function Partners({ data, statuses, onOpen, onStatus, preset, onBulk, sheetUrl }) {
  const { rows, today } = data;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [seg, setSeg] = useState('');
  const [band, setBand] = useState('');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('sheet');
  const [sel, setSel] = useState([]);
  const [open, setOpen] = useState([]);
  const [all, setAll] = useState(false);
  const isOpen = (id) => all || open.includes(id);
  const flip = (id) => { if (all) { setAll(false); setOpen(list.map((r) => r._row).filter((x) => x !== id)); } else setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id])); };
  useEffect(() => {
    if (!preset) return;
    setSeg(preset.seg || ''); setBand(preset.band || ''); setView(preset.view || 'all'); setQ(preset.q || '');
  }, [preset]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && (r[F.status] || statuses[0]) !== status) return false;
      if (seg && segmentOf(r).key !== seg) return false;
      if (band && !bandsOf(r).some((b) => b.key === band)) return false;
      if (view === 'ready' && !isReady(r)) return false;
      if (view === 'due' && !followUpDue(r, today)) return false;
      if (view === 'form' && hasEmail(r)) return false;
      if (view === 'name' && !(hasEmail(r) && missing(r).length)) return false;
      if (view === 'comp' && !isCompetitor(r)) return false;
      if (view === 'bounced' && !r[F.bouncedOn]) return false;
      if (view === 'replies' && !r[F.replyType]) return false;
      if (!s) return true;
      return [F.company, F.companyType, F.to, F.audience, F.initiative, F.suggested, F.notes].some((k) => String(r[k] || '').toLowerCase().includes(s));
    }).map((r) => ({ r, sc: score(r) }))
      .sort((a, b) => (sort === 'score' ? b.sc - a.sc : sort === 'name' ? String(a.r[F.company]).localeCompare(b.r[F.company]) : 0))
      .map((x) => x.r);
  }, [rows, q, status, seg, band, view, today, statuses, sort]);
  const ids = list.map((r) => r._row);
  const sendable = list.filter((r) => isReady(r) && !r[F.bouncedOn]).map((r) => r._row);
  const picked = sel.filter((id) => sendable.includes(id));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const label = view === 'all' ? '' : { ready: 'ready to send', due: 'follow-up due', replies: 'has a reply', name: 'needs name', form: 'form only', bounced: 'bounced', comp: 'competitor flag' }[view];

  return (
    <div className="view">
      <div className="view-head">
        <div><h1>All partners</h1><p className="muted">{list.length} of {rows.length} shown. Tick partners that are ready to send, then press Send selected. Change a status here and it is written to the sheet.</p></div>
      </div>
      <section className="card">
        <div className="filters">
          <input className="search" placeholder="Search company, type, email, audience…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={seg} onChange={(e) => setSeg(e.target.value)}>
            <option value="">All segments</option>
            {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">All audience bands</option>
            {BANDS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {[['all', 'All'], ['ready', 'Ready to send'], ['due', 'Follow-up due'], ['replies', 'Has a reply'], ['name', 'Needs name'], ['form', 'Form only'], ['bounced', 'Bounced'], ['comp', 'Competitor flag']].map(([k, l]) => (
            <button key={k} className={'chip' + (view === k ? ' on' : '')} onClick={() => setView(k)}>{l}</button>
          ))}
          <span className="spacer" />
          <button className="chip" onClick={() => { setAll(!all); setOpen([]); }}>{all ? 'Hide details' : 'Show all details'}</button>
          <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="sheet">Sheet order</option>
            <option value="score">Highest priority first</option>
            <option value="name">A to Z</option>
          </select>
        </div>
        <div className="scroll">
          <table className="table">
            <thead><tr><th className="pick-col">{sendable.length > 0 && <input type="checkbox" className="pick" title="Select all ready to send" checked={picked.length > 0 && picked.length === sendable.length} onChange={() => setSel(picked.length === sendable.length ? [] : sendable)} />}</th><th className="exp-col" /><th>Company</th><th title="Priority score">Score</th><th>Segment</th><th>Status</th><th>Next</th><th>To</th><th>Sent</th><th>Follow-up</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const a = action(r, today);
                return (
                  <Fragment key={r._row}>
                  <tr className={(followUpDue(r, today) ? 'due' : '') + (picked.includes(r._row) ? ' picked' : '') + (isOpen(r._row) ? ' expanded' : '')} onClick={() => onOpen(r._row, ids, label)}>
                    <td className="pick-col" onClick={(e) => e.stopPropagation()}>{sendable.includes(r._row) && <input type="checkbox" className="pick" checked={picked.includes(r._row)} onChange={() => toggle(r._row)} aria-label={'Select ' + r[F.company]} />}</td>
                    <td className="exp-col" onClick={(e) => { e.stopPropagation(); flip(r._row); }}><button className={'exp' + (isOpen(r._row) ? ' on' : '')} aria-expanded={isOpen(r._row)} aria-label={'Details for ' + r[F.company]}><Icon name="arrow" size={16} /></button></td>
                    <td><div className="strong">{r[F.company]}</div><div className="muted small clip">{r[F.companyType]}</div></td>
                    <td><Score value={score(r)} /></td>
                    <td><SegTag row={r} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select className={'status-select ' + stageClass(r[F.status])} value={r[F.status] || statuses[0]} onChange={(e) => onStatus(r._row, e.target.value)}>
                        {withCurrent(statuses, r[F.status]).map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><Tag tone={a.tone}>{a.label}</Tag><ReplyTag row={r} />{isCompetitor(r) && a.tone !== 'red' && <Tag tone="red">competitor?</Tag>}</td>
                    <td className="small clip">{hasEmail(r) ? emails(r[F.to]).join(', ') : <span className="muted">{r[F.form] ? 'form' : 'none'}</span>}</td>
                    <td className="small">{prettyDate(r[F.sentOn])}</td>
                    <td className="small">{prettyDate(r[F.followUp])}</td>
                  </tr>
                  {isOpen(r._row) && <tr className="detail-row"><td colSpan={10}><PartnerDetails r={r} sheetUrl={sheetUrl} onOpen={() => onOpen(r._row, ids, label)} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!list.length && <p className="muted">No partners match.</p>}
        </div>
        {picked.length > 0 && (
          <div className="bulkbar">
            <b>{picked.length} selected</b>
            <button className="link small" onClick={() => setSel([])}>Clear</button>
            <span className="spacer" />
            <button className="btn send" onClick={() => onBulk(picked)}><Icon name="send" size={16} /> Send selected ({picked.length})</button>
          </div>
        )}
      </section>
    </div>
  );
}
