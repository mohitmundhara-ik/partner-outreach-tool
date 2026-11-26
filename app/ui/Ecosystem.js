'use client';
import { F, stage, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, focusOf, isCompetitor } from '@/lib/segments';
import { contacted, engaged, pct, Pill, Tag, Icon, STAGES, action, Bands } from './common';

function StageBar({ rows }) {
  const n = rows.length || 1;
  return (
    <div className="stagebar">
      {STAGES.map(([k]) => {
        const c = rows.filter((r) => stage(r[F.status]) === k).length;
        return c ? <div key={k} className={'sb-' + k} style={{ width: `${(c / n) * 100}%` }} title={`${c} ${k}`} /> : null;
      })}
    </div>
  );
}

export default function Ecosystem({ data, seg, setSeg, onOpen }) {
  const { rows } = data;
  if (seg) return <Segment data={data} seg={SEGMENTS.find((s) => s.key === seg) || SEGMENTS[0]} back={() => setSeg(null)} onOpen={onOpen} />;

  const groups = SEGMENTS.map((s) => ({ s, rs: rows.filter((r) => segmentOf(r).key === s.key) })).filter((g) => g.rs.length || g.s.key !== 'other');

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Ecosystem</h1>
          <p className="muted">Every place IK can reach tech professionals in India, grouped by segment. The hiring industry comes first because its users are trying to get hired right now.</p>
        </div>
      </div>
      <div className="eco-grid">
        {groups.map(({ s, rs }, i) => {
          const bandCounts = BANDS.map((b) => [b, rs.filter((r) => bandsOf(r).some((x) => x.key === b.key)).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
          return (
            <button key={s.key} className={'eco-card' + (i === 0 ? ' feature' : '')} onClick={() => setSeg(s.key)}>
              <div className="eco-top">
                <span className={'eco-num seg-' + s.key}>{i + 1}</span>
                <span className="eco-count">{rs.length} <small>partners</small></span>
              </div>
              <h3>{s.name}</h3>
              <p>{s.blurb}</p>
              <StageBar rows={rs} />
              <div className="eco-stats">
                <span><b>{rs.filter(contacted).length}</b> contacted</span>
                <span><b>{rs.filter(engaged).length}</b> replied</span>
                <span><b>{s.plays.length}</b> plays</span>
              </div>
              <div className="eco-bands">{bandCounts.slice(0, 3).map(([b, n]) => <span key={b.key} className="band">{b.name} · {n}</span>)}</div>
              <span className="eco-open">Open hub <Icon name="arrow" size={14} /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Segment({ data, seg, back, onOpen }) {
  const { rows, today } = data;
  const rs = rows.filter((r) => segmentOf(r).key === seg.key);
  const bandCounts = BANDS.map((b) => [b, rs.filter((r) => bandsOf(r).some((x) => x.key === b.key))]).filter(([, l]) => l.length);
  const focus = {};
  rs.forEach((r) => focusOf(r).forEach((f) => { focus[f] = (focus[f] || 0) + 1; }));
  const nC = rs.filter(contacted).length, nE = rs.filter(engaged).length;
  const order = { call: 0, replied: 1, sent: 2, new: 3, closed: 4 };
  const sorted = [...rs].sort((a, b) => order[stage(a[F.status])] - order[stage(b[F.status])] || String(a[F.company]).localeCompare(b[F.company]));

  return (
    <div className="view">
      <button className="link back" onClick={back}>← All segments</button>
      <section className={'seg-hero seg-bg-' + seg.key}>
        <div>
          <div className="eyebrow">Segment hub</div>
          <h1>{seg.name}</h1>
          <p>{seg.blurb}</p>
        </div>
        <div className="seg-hero-stats">
          <div><b>{rs.length}</b><span>partners</span></div>
          <div><b>{nC}</b><span>contacted</span></div>
          <div><b>{nE}</b><span>replied</span></div>
          <div><b>{pct(nE, nC)}%</b><span>reply rate</span></div>
        </div>
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2>Partners in this segment</h2><StageBar rows={rs} /></div>
          <div className="plist">
            {sorted.map((r) => {
              const a = action(r, today);
              return (
                <button key={r._row} className="prow" onClick={() => onOpen(r._row)}>
                  <div className="prow-main">
                    <span className="strong">{r[F.company]}</span>
                    <span className="muted small">{r[F.companyType]}</span>
                    <span className="prow-bands"><Bands row={r} /></span>
                  </div>
                  <div className="prow-side">
                    {isCompetitor(r) && <Tag tone="red">competitor?</Tag>}
                    <Tag tone={a.tone}>{a.label}</Tag>
                    <Pill status={r[F.status]} />
                    <span className="muted small date">{prettyDate(r[F.sentOn])}</span>
                  </div>
                </button>
              );
            })}
            {!rs.length && <p className="muted">No partners in this segment yet. Add one from "Add partner".</p>}
          </div>
        </section>

        <aside>
          <section className="card">
            <h2>Who they reach</h2>
            {bandCounts.map(([b, l]) => (
              <div key={b.key} className="reach">
                <div className="band-top"><span>{b.name}</span><span className="muted small">{b.years}</span><b>{l.length}</b></div>
                <p className="muted small">{b.hook}</p>
              </div>
            ))}
            {Object.keys(focus).length > 0 && (
              <>
                <h3>Focus areas</h3>
                <div className="chips">{Object.entries(focus).sort((a, b) => b[1] - a[1]).map(([f, n]) => <span key={f} className="chip static">{f} · {n}</span>)}</div>
              </>
            )}
          </section>
        </aside>
      </div>

      <section className="card">
        <div className="card-head"><h2>Playbook: how to bring their audience to IK</h2><span className="muted small">Ideas for the 30-minute call. The first email stays the same.</span></div>
        <div className="plays">
          {seg.plays.map((p, i) => (
            <div key={p.title} className="play">
              <span className="play-n">{i + 1}</span>
              <h4>{p.title}</h4>
              <p>{p.how}</p>
              <p className="ask"><b>Ask:</b> {p.ask}</p>
            </div>
          ))}
        </div>
        {bandCounts.length > 0 && (
          <>
            <h3>Tailor it to the audience</h3>
            <div className="band-plays">
              {bandCounts.map(([b]) => (
                <div key={b.key} className="bp">
                  <b>{b.name}</b>
                  <ul>{b.plays.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
