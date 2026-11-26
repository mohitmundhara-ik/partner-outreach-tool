'use client';
import { useState } from 'react';
import { F } from '@/lib/fields';
import { SEGMENTS, BANDS, FOCUS, segmentOf, bandsOf, focusOf } from '@/lib/segments';
import { contacted, engaged, Pill, ReplyTag } from './common';

export default function Audience({ data, go, onOpen }) {
  const { rows } = data;
  const [band, setBand] = useState(BANDS[0].key);
  const inBand = (r, k) => bandsOf(r).some((x) => x.key === k);
  const segs = SEGMENTS.filter((s) => rows.some((r) => segmentOf(r).key === s.key));
  const cell = (s, b) => rows.filter((r) => segmentOf(r).key === s.key && inBand(r, b.key));
  const max = Math.max(1, ...segs.flatMap((s) => BANDS.map((b) => cell(s, b).length)));
  const untagged = rows.filter((r) => !bandsOf(r).length);
  const b = BANDS.find((x) => x.key === band);
  const reach = rows.filter((r) => inBand(r, band));
  const focus = FOCUS.map(([n]) => [n, rows.filter((r) => focusOf(r).includes(n)).length]).filter(([, n]) => n).sort((a, c) => c[1] - a[1]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Audience map</h1>
          <p className="muted">Tech professionals in India by career band, and which partners can put IK in front of each band. Worked out from the Audience column in your sheet.</p>
        </div>
      </div>

      <section className="card">
        <h2>Segment × band</h2>
        <div className="scroll">
          <table className="matrix">
            <thead>
              <tr><th /> {BANDS.map((x) => <th key={x.key}><span>{x.name}</span><small>{x.years}</small></th>)}</tr>
            </thead>
            <tbody>
              {segs.map((s) => (
                <tr key={s.key}>
                  <th><span className={'dot seg-' + s.key} /> {s.name}</th>
                  {BANDS.map((x) => {
                    const n = cell(s, x).length;
                    return (
                      <td key={x.key}>
                        <button className="heat" style={{ '--h': n / max }} disabled={!n} onClick={() => go('partners', { seg: s.key, band: x.key })}>{n || ''}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {untagged.length > 0 && <p className="muted small">{untagged.length} partners have no band yet because their Audience cell is empty or too general.</p>}
      </section>

      <div className="band-tabs">
        {BANDS.map((x) => (
          <button key={x.key} className={'band-tab' + (band === x.key ? ' on' : '')} onClick={() => setBand(x.key)}>
            <b>{x.name}</b><span>{x.years} · {rows.filter((r) => inBand(r, x.key)).length} partners{rows.some((r) => inBand(r, x.key) && r[F.bouncedOn]) ? ` · ${rows.filter((r) => inBand(r, x.key) && r[F.bouncedOn]).length} bounced` : ''}</span>
          </button>
        ))}
      </div>

      <div className="grid-main">
        <section className="card">
          <div className="eyebrow">What gets them to IK</div>
          <h2 className="big-h">{b.hook}</h2>
          <h3>Offers that work for this band</h3>
          <ul className="ticks">{b.plays.map((p) => <li key={p}>{p}</li>)}</ul>
          <h3>Best channels for this band</h3>
          <div className="chips">
            {SEGMENTS.map((s) => [s, cell(s, b).length]).filter(([, n]) => n).sort((a, c) => c[1] - a[1]).map(([s, n]) => (
              <button key={s.key} className="chip" onClick={() => go('ecosystem', { seg: s.key })}><span className={'dot seg-' + s.key} /> {s.name} · {n}</button>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Partners reaching {b.name.toLowerCase()}</h2><span className="muted small">{reach.filter(contacted).length} contacted · {reach.filter(engaged).length} replied{reach.some((r) => r[F.bouncedOn]) ? ` · ${reach.filter((r) => r[F.bouncedOn]).length} bounced` : ''}</span></div>
          <div className="plist compact">
            {reach.map((r) => (
              <button key={r._row} className="prow" onClick={() => onOpen(r._row)}>
                <div className="prow-main"><span className="strong">{r[F.company]}</span><span className="muted small">{r[F.audience]}</span></div>
                <div className="prow-side"><ReplyTag row={r} /><Pill status={r[F.status]} /></div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {focus.length > 0 && (
        <section className="card">
          <h2>Focus areas across all partners</h2>
          <div className="focus-grid">
            {focus.map(([n, c]) => <div key={n} className="focus"><b>{c}</b><span>{n}</span></div>)}
          </div>
        </section>
      )}
    </div>
  );
}
