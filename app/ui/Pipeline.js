'use client';
import { useState } from 'react';
import { F, stage, prettyDate } from '@/lib/fields';
import { SEGMENTS, segmentOf } from '@/lib/segments';
import { STAGES, SegTag, Tag, action, followUpDue } from './common';

export default function Pipeline({ data, onOpen }) {
  const { rows, today } = data;
  const [seg, setSeg] = useState('');
  const list = seg ? rows.filter((r) => segmentOf(r).key === seg) : rows;
  const present = SEGMENTS.filter((s) => rows.some((r) => segmentOf(r).key === s.key));
  return (
    <div className="view">
      <div className="view-head">
        <div><h1>Pipeline</h1><p className="muted">Every partner by stage. Click a card to open it.</p></div>
        <div className="chips">
          <button className={'chip' + (!seg ? ' on' : '')} onClick={() => setSeg('')}>All</button>
          {present.map((s) => <button key={s.key} className={'chip' + (seg === s.key ? ' on' : '')} onClick={() => setSeg(s.key)}>{s.short}</button>)}
        </div>
      </div>
      <div className="board">
        {STAGES.map(([k, label]) => {
          const col = list.filter((r) => stage(r[F.status]) === k);
          return (
            <section key={k} className={'lane lane-' + k}>
              <div className="lane-head"><span>{label}</span><b>{col.length}</b></div>
              <div className="lane-body">
                {col.map((r) => {
                  const a = action(r, today);
                  return (
                    <button key={r._row} className={'bcard' + (followUpDue(r, today) ? ' due' : '') + (r[F.bouncedOn] ? ' bounced' : '')} onClick={() => onOpen(r._row, col.map((x) => x._row), label.toLowerCase())}>
                      <span className="strong">{r[F.company]}</span>
                      <span className="bcard-meta"><SegTag row={r} /> {r[F.sentOn] && <span className="muted small">sent {prettyDate(r[F.sentOn])}</span>}</span>
                      {k !== 'closed' && <Tag tone={a.tone}>{a.label}</Tag>}
                      {k === 'closed' && <span className="muted small">{r[F.status]}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
