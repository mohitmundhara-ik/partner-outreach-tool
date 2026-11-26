'use client';
import { useState } from 'react';
import { F, stage, addDays, prettyDate } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, gapsOf } from '@/lib/segments';
import { contacted, engaged, followUpDue, isReady, hasEmail, missing, pct, Meter, Icon, SegTag, Score, score, ReplyTag } from './common';

export default function Overview({ data, go, onOpen, onBulk }) {
  const { rows, today } = data;
  const next = rows.filter((r) => isReady(r) && !r[F.bouncedOn]).map((r) => ({ r, s: score(r) })).sort((a, b) => b.s - a.s).slice(0, 6);
  const gaps = gapsOf(rows).slice(0, 6);
  const bounced = rows.filter((r) => r[F.bouncedOn] && ['new', 'sent'].includes(stage(r[F.status])));

  const on = (field, day) => rows.filter((r) => r[field] === day).length;
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
  const peak = Math.max(...series.map((s) => Math.max(s.sent, s.replies, s.drafted)), 1);

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
          <h1 className="hero-title">Partner outreach</h1>
          <p className="hero-sub">
            {due.length ? `${due.length} follow-up${due.length > 1 ? 's' : ''} due. ` : ''}
            {ready.length + drafted.length} ready to send. {toBook.length ? `${toBook.length} repl${toBook.length > 1 ? 'ies' : 'y'} waiting for a call.` : ''}
          </p>
        </div>
        <div className="hero-ring">
          <Ring value={pct(nReplied, nContacted)} />
          <div className="ring-label">reply rate<br /><b>{nReplied}</b> of {nContacted} contacted</div>
        </div>
      </section>

      <section className="kpis">
        <Kpi label="Partners in the system" value={rows.length} sub={`${open} still open`} onClick={() => go('partners')} />
        <Kpi label="Contacted" value={nContacted} sub={bounced.length ? `${bounced.length} bounced` : `${pct(nContacted, rows.length)}% of the list`} tone={bounced.length ? 'redsub' : ''} onClick={() => (bounced.length ? go('partners', { view: 'bounced' }) : go('pipeline'))} />
        <Kpi label="Replies" value={nReplied} sub={`${on(F.repliedOn, today)} today`} tone="green" onClick={() => go('pipeline')} />
        <Kpi label="Calls booked" value={nCalls} sub={`${pct(nCalls, nContacted)}% of contacted`} tone="green" onClick={() => go('pipeline')} />
        <Kpi label="Follow-ups due" value={due.length} sub={due.length ? 'do these first' : 'all clear'} tone={due.length ? 'amber' : ''} onClick={() => go('partners', { view: 'due' })} />
      </section>

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2>Activity, last 14 days</h2><div className="legend"><i className="lg-sent" />Sent <i className="lg-rep" />Replies <i className="lg-dr" />Drafted</div></div>
          <div className="chart">
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
          {bounced.length > 0 && <button className="gap-line gap-red" onClick={() => go('partners', { view: 'bounced' })}><Icon name="warn" size={14} /> {bounced.length} email{bounced.length > 1 ? 's' : ''} bounced. Find new contacts.</button>}
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

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2>Contact next</h2><span className="muted small">Ready to send, highest priority first</span></div>
          <div className="plist">
            {next.map(({ r, s }) => (
              <button key={r._row} className="prow" onClick={() => onOpen(r._row)}>
                <div className="prow-main"><span className="strong">{r[F.company]}</span><span className="muted small">{r[F.audience]}</span></div>
                <div className="prow-side"><SegTag row={r} /><Score value={s} /></div>
              </button>
            ))}
            {!next.length && <p className="muted">Nobody is ready to send. Check "Needs a contact or name" below, or add targets.</p>}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Gaps</h2><button className="link" onClick={() => go('targets')}>Targets library <Icon name="arrow" size={14} /></button></div>
          {gaps.map((g) => (
            <button key={g.text} className={'gap-line gap-' + g.level} onClick={() => go('targets')}><Icon name="warn" size={14} /> {g.text}</button>
          ))}
          {!gaps.length && <p className="muted">No obvious gaps. Every band and segment has partners.</p>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2>Do next</h2><span className="muted small">In this order: follow-ups, replies, then new sends</span></div>
        <div className="todo">
          <Todo title="Send follow-ups" tone="amber" rows={due} onOpen={onOpen} extra={(r) => (Number(r[F.followUps]) ? 'follow-up 2 · ' : 'follow-up 1 · ') + 'sent ' + prettyDate(r[F.sentOn])} />
          <Todo title="Reply and book the call" tone="green" rows={toBook} onOpen={onOpen} extra={(r) => (r[F.replyType] ? r[F.replyType] + ' · ' : '') + 'replied ' + prettyDate(r[F.repliedOn])} />
          <Todo title="Bounced: find a new contact" tone="grey" rows={bounced} onOpen={onOpen} extra={(r) => r[F.to]} />
          <Todo title="Send drafted" tone="blue" rows={drafted} onOpen={onOpen} onBulk={onBulk} extra={(r) => 'drafted ' + prettyDate(r[F.draftedOn])} />
          <Todo title="Ready to send" tone="blue" rows={ready} onOpen={onOpen} onBulk={onBulk} />
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

function Todo({ title, tone, rows, onOpen, extra, onBulk }) {
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState([]);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 5);
  const ids = rows.map((r) => r._row);
  const picked = sel.filter((id) => ids.includes(id));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className={'todo-col td-' + tone}>
      <div className="todo-head">
        <span>{title}</span>
        <span className="todo-head-r">
          {onBulk && <button className="link small" onClick={() => { setSel(picked.length === ids.length ? [] : ids); setAll(true); }}>{picked.length === ids.length ? 'Clear' : 'Select all'}</button>}
          <b>{rows.length}</b>
        </span>
      </div>
      {shown.map((r) => (
        <div key={r._row} className={'todo-row' + (picked.includes(r._row) ? ' picked' : '')}>
          {onBulk && <input type="checkbox" className="pick" checked={picked.includes(r._row)} onChange={() => toggle(r._row)} aria-label={'Select ' + r[F.company]} />}
          <button className="todo-item" onClick={() => onOpen(r._row, ids, title.toLowerCase())}>
            <span className="todo-name">{r[F.company]}</span>
            <span className="todo-sub"><SegTag row={r} /> {extra ? extra(r) : r[F.to]}</span>
          </button>
        </div>
      ))}
      {rows.length > 5 && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${rows.length}`}</button>}
      {onBulk && picked.length > 0 && (
        <button className="btn send small full" onClick={() => onBulk(picked)}><Icon name="send" size={14} /> Send selected ({picked.length})</button>
      )}
    </div>
  );
}
