'use client';
import { F, stage, DEAL_STAGES } from '@/lib/fields';
import { SEGMENTS, segmentOf } from '@/lib/segments';
import { contacted, engaged, pct, Tag, SegTag } from './common';

const num = (v) => Number(String(v || '').replace(/[^\d.]/g, '')) || 0;

export default function Results({ data, onOpen }) {
  const { rows } = data;
  const deals = rows.filter((r) => r[F.deal]);
  const leads = rows.reduce((a, r) => a + num(r[F.leads]), 0);
  const enrol = rows.reduce((a, r) => a + num(r[F.enrolments]), 0);
  const live = rows.filter((r) => r[F.deal] === 'Live partner').length;
  const calls = rows.filter((r) => stage(r[F.status]) === 'call' || r[F.meetingOn]).length;
  const segs = SEGMENTS.map((s) => {
    const rs = rows.filter((r) => segmentOf(r).key === s.key);
    return {
      s, n: rs.length, c: rs.filter(contacted).length, e: rs.filter(engaged).length,
      calls: rs.filter((r) => stage(r[F.status]) === 'call' || r[F.meetingOn]).length,
      live: rs.filter((r) => r[F.deal] === 'Live partner').length,
      leads: rs.reduce((a, r) => a + num(r[F.leads]), 0), enrol: rs.reduce((a, r) => a + num(r[F.enrolments]), 0),
    };
  }).filter((x) => x.n);
  const top = [...rows].filter((r) => num(r[F.leads]) || num(r[F.enrolments])).sort((a, b) => num(b[F.enrolments]) - num(a[F.enrolments]) || num(b[F.leads]) - num(a[F.leads]));
  const maxDeal = Math.max(1, ...DEAL_STAGES.map((d) => deals.filter((r) => r[F.deal] === d).length));

  return (
    <div className="view">
      <div className="view-head"><div><h1>Results</h1><p className="muted">What partnerships turn into. Set the partnership stage, tracking link, leads and enrolments on each partner under Company details.</p></div></div>
      <section className="kpis">
        <Box label="Calls held or booked" value={calls} />
        <Box label="In partnership talks" value={deals.length} />
        <Box label="Live partners" value={live} tone="green" />
        <Box label="Leads from partners" value={leads} />
        <Box label="Enrolments" value={enrol} sub={leads ? `${pct(enrol, leads)}% of leads` : 'add numbers per partner'} tone="green" />
      </section>

      <div className="grid-main">
        <section className="card">
          <h2>Results by segment</h2>
          <div className="scroll">
            <table className="table static">
              <thead><tr><th>Segment</th><th className="num">Partners</th><th className="num">Contacted</th><th className="num">Replied</th><th className="num">Calls</th><th className="num">Live</th><th className="num">Leads</th><th className="num">Enrolments</th></tr></thead>
              <tbody>
                {segs.map(({ s, n, c, e, calls: cl, live: lv, leads: ld, enrol: en }) => (
                  <tr key={s.key}>
                    <td><span className={'dot seg-' + s.key} /> {s.name}</td>
                    <td className="num">{n}</td><td className="num">{c}</td>
                    <td className="num">{e} <span className="muted small">{pct(e, c)}%</span></td>
                    <td className="num">{cl}</td><td className="num">{lv}</td><td className="num">{ld}</td><td className="num strong">{en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>Partnership stages</h2>
          {DEAL_STAGES.map((d) => {
            const n = deals.filter((r) => r[F.deal] === d).length;
            return (
              <div key={d} className="band-line">
                <div className="band-top"><span>{d}</span><b>{n}</b></div>
                <div className="meter"><div className={'meter-fill' + (d === 'Live partner' ? ' green' : '')} style={{ width: `${(n / maxDeal) * 100}%` }} /></div>
              </div>
            );
          })}
          {!deals.length && <p className="muted small">No partnerships in talks yet. After a call, set the stage on the partner.</p>}
        </section>
      </div>

      <section className="card">
        <h2>Top partners by enrolments</h2>
        <div className="plist">
          {top.map((r) => (
            <button key={r._row} className="prow" onClick={() => onOpen(r._row)}>
              <div className="prow-main"><span className="strong">{r[F.company]}</span><span className="muted small">{r[F.deal] || 'No stage set'}</span></div>
              <div className="prow-side"><SegTag row={r} /><Tag tone="blue">{num(r[F.leads])} leads</Tag><Tag tone="green">{num(r[F.enrolments])} enrolments</Tag></div>
            </button>
          ))}
          {!top.length && <p className="muted">No numbers yet. Create a tracking link for each partner, then add leads and enrolments as they come in.</p>}
        </div>
      </section>
    </div>
  );
}

function Box({ label, value, sub, tone }) {
  return (
    <div className={'kpi static' + (tone ? ' k-' + tone : '')}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}
