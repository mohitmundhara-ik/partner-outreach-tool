'use client';
import { useMemo, useState, useEffect } from 'react';
import { F, emails, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, isCompetitor } from '@/lib/segments';
import { hasEmail, missing, isReady, followUpDue, withCurrent, SegTag, Tag, action, stageClass, Score, score, ReplyTag, Icon } from './common';

export default function Partners({ data, statuses, onOpen, onStatus, preset, onBulk }) {
  const { rows, today } = data;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [seg, setSeg] = useState('');
  const [band, setBand] = useState('');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('sheet');
  const [sel, setSel] = useState([]);
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
          <select className="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="sheet">Sheet order</option>
            <option value="score">Highest priority first</option>
            <option value="name">A to Z</option>
          </select>
        </div>
        <div className="scroll">
          <table className="table">
            <thead><tr><th className="pick-col">{sendable.length > 0 && <input type="checkbox" className="pick" title="Select all ready to send" checked={picked.length > 0 && picked.length === sendable.length} onChange={() => setSel(picked.length === sendable.length ? [] : sendable)} />}</th><th>Company</th><th title="Priority score">Score</th><th>Segment</th><th>Status</th><th>Next</th><th>To</th><th>Sent</th><th>Follow-up</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const a = action(r, today);
                return (
                  <tr key={r._row} className={(followUpDue(r, today) ? 'due' : '') + (picked.includes(r._row) ? ' picked' : '')} onClick={() => onOpen(r._row, ids, label)}>
                    <td className="pick-col" onClick={(e) => e.stopPropagation()}>{sendable.includes(r._row) && <input type="checkbox" className="pick" checked={picked.includes(r._row)} onChange={() => toggle(r._row)} aria-label={'Select ' + r[F.company]} />}</td>
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
