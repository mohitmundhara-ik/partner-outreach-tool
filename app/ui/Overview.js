'use client';
import { useEffect, useState } from 'react';
import { F, stage, addDays, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf } from '@/lib/segments';
import { contacted, engaged, followUpDue, isReady, hasEmail, missing, pct, Meter, Icon, SegTag } from './common';

export default function Overview({ data, go, onOpen }) {
  const { rows, today } = data;
  const [goal, setGoal] = useState(10);
  useEffect(() => { try { const g = Number(localStorage.getItem('ik_goal')); if (g) setGoal(g); } catch {} }, []);
  const saveGoal = (g) => { setGoal(g); try { localStorage.setItem('ik_goal', String(g)); } catch {} };

  const on = (field, day) => rows.filter((r) => r[field] === day).length;
  const sentToday = on(F.sentOn, today);
  const nContacted = rows.filter(contacted).length;
  const nReplied = rows.filter(engaged).length;
  const nCalls = rows.filter((r) => stage(r[F.status]) === 'call').length;
  const due = rows.filter((r) => followUpDue(r, today));
  const ready = rows.filter((r) => isReady(r) && !r[F.draftedOn]);
  const drafted = rows.filter((r) => isReady(r) && r[F.draftedOn]);
  const toBook = rows.filter((r) => stage(r[F.status]) === 'replied');
  const blocked = rows.filter((r) => stage(r[F.status]) === 'new' && (!hasEmail(r) || missing(r).length));
  const open = rows.filter((r) => stage(r[F.status]) !== 'closed').length;

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const series = days.map((d) => ({ d, sent: on(F.sentOn, d), replies: on(F.repliedOn, d), drafted: on(F.draftedOn, d) }));
  const peak = Math.max(Math.ceil(goal * 1.15), ...series.map((s) => Math.max(s.sent, s.replies, s.drafted)), 1);
  const week = series.slice(-7).reduce((a, s) => a + s.sent, 0);
  const streak = (() => { let n = 0; for (let i = series.length - 1; i >= 0; i--) { if (series[i].sent > 0) n++; else if (i !== series.length - 1) break; } return n; })();

  const funnel = [
    ['Partners', rows.length],
    ['Contacted', nContacted],
    ['Replied', nReplied],
    ['Call booked', nCalls],
  ];

  const segStats = SEGMENTS.map((s) => {
    const rs = rows.filter((r) => segmentOf(r).key === s.key);
    return { s, n: rs.length, c: rs.filter(contacted).length, e: rs.filter(engaged).length };
  }).filter((x) => x.n);

  const bandStats = BANDS.map((b) => ({ b, n: rows.filter((r) => bandsOf(r).some((x) => x.key === b.key)).length }));
  const bandMax = Math.max(1, ...bandStats.map((x) => x.n));

  return (
    <div className="view">
      <section className="hero">
        <div className="hero-main">
          <div className="eyebrow">Today, {prettyDate(today)}</div>
          <h1 className="hero-title">{sentToday} of {goal} sent today</h1>
          <p className="hero-sub">
            {due.length ? `${due.length} follow-up${due.length > 1 ? 's' : ''} due. ` : ''}
            {ready.length + drafted.length} ready to send. {toBook.length ? `${toBook.length} repl${toBook.length > 1 ? 'ies' : 'y'} waiting for a call.` : ''}
          </p>
          <div className="hero-bar"><div style={{ width: `${Math.min(100, pct(sentToday, goal))}%` }} /></div>
          <div className="hero-meta">
            <span>Daily goal <input type="number" min="1" value={goal} onChange={(e) => saveGoal(Number(e.target.value) || 1)} /></span>
            <span>{week} sent in the last 7 days</span>
            {streak > 1 && <span>{streak}-day sending streak</span>}
          </div>
        </div>
        <div className="hero-ring">
          <Ring value={pct(nReplied, nContacted)} />
          <div className="ring-label">reply rate<br /><b>{nReplied}</b> of {nContacted} contacted</div>
        </div>
      </section>

      <section className="kpis">
        <Kpi label="Partners in the system" value={rows.length} sub={`${open} still open`} onClick={() => go('partners')} />
        <Kpi label="Contacted" value={nContacted} sub={`${pct(nContacted, rows.length)}% of the list`} onClick={() => go('pipeline')} />
        <Kpi label="Replies" value={nReplied} sub={`${on(F.repliedOn, today)} today`} tone="green" onClick={() => go('pipeline')} />
        <Kpi label="Calls booked" value={nCalls} sub={`${pct(nCalls, nContacted)}% of contacted`} tone="green" onClick={() => go('pipeline')} />
        <Kpi label="Follow-ups due" value={due.length} sub={due.length ? 'do these first' : 'all clear'} tone={due.length ? 'amber' : ''} onClick={() => go('partners', { view: 'due' })} />
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2>Activity, last 14 days</h2><div className="legend"><i className="lg-sent" />Sent <i className="lg-rep" />Replies <i className="lg-dr" />Drafted</div></div>
          <div className="chart">
            <div className="goal-line" style={{ '--g': goal / peak }}><span>goal {goal}</span></div>
            {series.map((s) => (
              <div key={s.d} className={'col' + (s.d === today ? ' now' : '')} title={`${prettyDate(s.d)}: ${s.sent} sent, ${s.replies} replies, ${s.drafted} drafted`}>
                <div className="bars">
                  <div className="b b-sent" style={{ height: `${(s.sent / peak) * 100}%` }} />
                  <div className="b b-rep" style={{ height: `${(s.replies / peak) * 100}%` }} />
                  <div className="b b-dr" style={{ height: `${(s.drafted / peak) * 100}%` }} />
                </div>
                <div className="x">{s.d.slice(8)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Funnel</h2>
          <div className="funnel">
            {funnel.map(([l, n], i) => (
              <div key={l} className="f-row">
                <div className="f-bar" style={{ width: `${Math.max(8, pct(n, rows.length))}%`, opacity: 1 - i * 0.16 }}><b>{n}</b></div>
                <div className="f-label">{l}{i > 0 && <span> {pct(n, funnel[i - 1][1])}%</span>}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2>Ecosystem coverage</h2><button className="link" onClick={() => go('ecosystem')}>Open ecosystem <Icon name="arrow" size={14} /></button></div>
          <div className="seg-table">
            {segStats.map(({ s, n, c, e }) => (
              <button key={s.key} className="seg-line" onClick={() => go('ecosystem', { seg: s.key })}>
                <span className={'dot seg-' + s.key} />
                <span className="seg-name">{s.name}</span>
                <span className="seg-meter"><Meter value={c} max={n} /></span>
                <span className="num muted">{c}/{n} contacted</span>
                <span className="num">{e ? <b className="good">{e} replied</b> : <span className="muted">no replies yet</span>}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>Audience reach</h2><button className="link" onClick={() => go('audience')}>Audience map <Icon name="arrow" size={14} /></button></div>
          {bandStats.map(({ b, n }) => (
            <div key={b.key} className="band-line">
              <div className="band-top"><span>{b.name}</span><span className="muted small">{b.years}</span><b>{n}</b></div>
              <Meter value={n} max={bandMax} tone="violet" />
            </div>
          ))}
          <p className="muted small">Number of partners whose audience includes each band.</p>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2>Do next</h2><span className="muted small">In this order: follow-ups, replies, then new sends</span></div>
        <div className="todo">
          <Todo title="Follow up" tone="amber" rows={due} onOpen={onOpen} extra={(r) => 'sent ' + prettyDate(r[F.sentOn])} />
          <Todo title="Book the call" tone="green" rows={toBook} onOpen={onOpen} extra={(r) => 'replied ' + prettyDate(r[F.repliedOn])} />
          <Todo title="Send drafted" tone="blue" rows={drafted} onOpen={onOpen} extra={(r) => 'drafted ' + prettyDate(r[F.draftedOn])} />
          <Todo title="Ready to send" tone="blue" rows={ready} onOpen={onOpen} />
          <Todo title="Needs a contact or name" tone="grey" rows={blocked} onOpen={onOpen} extra={(r) => (!hasEmail(r) ? (r[F.form] ? 'form only' : 'no email') : missing(r)[0])} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, tone, onClick }) {
  return (
    <button className={'kpi' + (tone ? ' k-' + tone : '')} onClick={onClick}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </button>
  );
}

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="ring">
      <circle cx="60" cy="60" r={r} className="ring-bg" />
      <circle cx="60" cy="60" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      <text x="60" y="67" textAnchor="middle">{value}%</text>
    </svg>
  );
}

function Todo({ title, tone, rows, onOpen, extra }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 5);
  return (
    <div className={'todo-col td-' + tone}>
      <div className="todo-head"><span>{title}</span><b>{rows.length}</b></div>
      {shown.map((r) => (
        <button key={r._row} className="todo-item" onClick={() => onOpen(r._row)}>
          <span className="todo-name">{r[F.company]}</span>
          <span className="todo-sub"><SegTag row={r} /> {extra ? extra(r) : r[F.to]}</span>
        </button>
      ))}
      {rows.length > 5 && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${rows.length}`}</button>}
    </div>
  );
}
