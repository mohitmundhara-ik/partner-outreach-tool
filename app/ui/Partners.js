'use client';
import { useMemo, useState, useEffect } from 'react';
import { F, emails, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, isCompetitor } from '@/lib/segments';
import { hasEmail, missing, isReady, followUpDue, withCurrent, SegTag, Tag, action, stageClass, Score, score, ReplyTag } from './common';

export default function Partners({ data, statuses, onOpen, onStatus, preset }) {
  const { rows, today } = data;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [seg, setSeg] = useState('');
  const [band, setBand] = useState('');
  const [view, setView] = useState('all');
  const [sort, setSort] = useState('sheet');
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

  return (
    <div className="view">
      <div className="view-head">
        <div><h1>All partners</h1><p className="muted">{list.length} of {rows.length} shown. Change a status here and it is written to the sheet.</p></div>
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
            <thead><tr><th>Company</th><th title="Priority score">Score</th><th>Segment</th><th>Status</th><th>Next</th><th>To</th><th>Sent</th><th>Follow-up</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const a = action(r, today);
                return (
                  <tr key={r._row} className={followUpDue(r, today) ? 'due' : ''} onClick={() => onOpen(r._row)}>
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
      </section>
    </div>
  );
}
