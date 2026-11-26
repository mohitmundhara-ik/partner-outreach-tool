'use client';
import { useMemo, useState } from 'react';
import { F } from '@/lib/fields';
import { SEGMENTS, BANDS, segmentOf, bandsOf, gapsOf, scoreOf, isCompetitor } from '@/lib/segments';
import { Field, Icon, Score, Tag } from './common';

export const asRow = (t) => ({ [F.company]: t.company, [F.companyType]: t.type, [F.audience]: t.audience, [F.segment]: t.segment, size: t.size, [F.notes]: '' });

export default function Targets({ data, busy, onPromote, onTarget, onAddTarget, go }) {
  const targets = data.targets || [];
  const gaps = gapsOf(data.rows);
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('');
  const [band, setBand] = useState('');
  const [show, setShow] = useState('New');
  const [adding, setAdding] = useState(false);
  const inPipeline = new Set(data.rows.map((r) => String(r[F.company] || '').toLowerCase().trim()));

  const list = useMemo(() => targets
    .map((t) => ({ t, r: asRow(t) }))
    .map((x) => ({ ...x, seg: segmentOf(x.r), score: scoreOf(x.r, { hasEmail: false }), dup: inPipeline.has(String(x.t.company).toLowerCase().trim()) }))
    .filter(({ t, r, seg: s }) => {
      const st = t.tstatus || 'New';
      if (show && st !== show) return false;
      if (seg && s.key !== seg) return false;
      if (band && !bandsOf(r).some((b) => b.key === band)) return false;
      const qq = q.trim().toLowerCase();
      return !qq || [t.company, t.type, t.audience, t.city, t.why].some((v) => String(v || '').toLowerCase().includes(qq));
    })
    .sort((a, b) => b.score - a.score), [targets, q, seg, band, show, data.rows]);

  const counts = { New: 0, Added: 0, Skip: 0 };
  targets.forEach((t) => { counts[t.tstatus || 'New'] = (counts[t.tstatus || 'New'] || 0) + 1; });

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Targets library</h1>
          <p className="muted">New places to reach tech professionals in India, from the Targets tab in your sheet. Add the good ones to your pipeline; they get the master email with [specific initiative or offering] left for you to fill in.</p>
        </div>
        <button className="btn" onClick={() => setAdding(!adding)}><Icon name="add" size={16} /> Add a target</button>
      </div>

      {gaps.length > 0 && (
        <section className="card gaps">
          <div className="card-head"><h2><Icon name="warn" size={16} /> Gaps in your ecosystem</h2><span className="muted small">Click one to see targets that fill it</span></div>
          <div className="chips">
            {gaps.map((g) => (
              <button key={g.text} className={'chip gap-' + g.level} onClick={() => { setSeg(g.seg || ''); setBand(g.band || ''); setShow('New'); }}>{g.text}</button>
            ))}
          </div>
        </section>
      )}

      {adding && <AddTarget busy={busy} onAdd={(f) => { onAddTarget(f); setAdding(false); }} />}

      <section className="card">
        <div className="filters">
          <input className="search" placeholder="Search targets…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={seg} onChange={(e) => setSeg(e.target.value)}>
            <option value="">All segments</option>
            {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="">All audience bands</option>
            {BANDS.map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}
          </select>
          <select value={show} onChange={(e) => setShow(e.target.value)}>
            <option value="New">New ({counts.New || 0})</option>
            <option value="Added">Added to pipeline ({counts.Added || 0})</option>
            <option value="Skip">Skipped ({counts.Skip || 0})</option>
            <option value="">All ({targets.length})</option>
          </select>
        </div>
        <div className="tgrid">
          {list.map(({ t, r, seg: s, score, dup }) => (
            <div key={t._row} className="tcard">
              <div className="tcard-top">
                <span className={'seg seg-' + s.key}>{s.short}</span>
                <Score value={score} />
              </div>
              <h4>{t.company}</h4>
              <p className="muted small">{[t.type, t.city].filter(Boolean).join(' · ')}</p>
              {t.audience && <p className="small"><b>Audience:</b> {t.audience}</p>}
              {t.why && <p className="small muted">{t.why}</p>}
              <div className="tcard-bands">{bandsOf(r).map((b) => <span key={b.key} className="band">{b.name}</span>)}{isCompetitor(r) && <Tag tone="red">competitor?</Tag>}</div>
              <div className="tcard-actions">
                {t.website && <a className="btn ghost small" href={t.website} target="_blank" rel="noreferrer">Website</a>}
                <span className="spacer" />
                {(t.tstatus || 'New') === 'New' && (
                  <>
                    <button className="btn small" disabled={busy} onClick={() => onTarget(t._row, { tstatus: 'Skip' })}>Skip</button>
                    <button className="btn send small" disabled={busy || dup} title={dup ? 'Already in your pipeline' : ''} onClick={() => onPromote(t)}>{dup ? 'In pipeline' : 'Add to pipeline'}</button>
                  </>
                )}
                {t.tstatus === 'Skip' && <button className="btn small" disabled={busy} onClick={() => onTarget(t._row, { tstatus: 'New' })}>Restore</button>}
                {t.tstatus === 'Added' && <button className="btn small" onClick={() => go('partners', { q: t.company })}>Open in pipeline</button>}
              </div>
            </div>
          ))}
        </div>
        {!targets.length && <p className="muted">No Targets tab yet. Add a target and the tab is created in your sheet.</p>}
        {targets.length > 0 && !list.length && <p className="muted">No targets match these filters.</p>}
      </section>
    </div>
  );
}

function AddTarget({ busy, onAdd }) {
  const blank = { company: '', type: '', audience: '', city: '', website: '', why: '' };
  const [v, setV] = useState(blank);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const s = segmentOf(asRow(v));
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); onAdd({ ...v, segment: s.name }); setV(blank); }}>
      <h2>Add a target</h2>
      <div className="two">
        <Field label="Company *"><input required value={v.company} onChange={set('company')} /></Field>
        <Field label="Type" hint={'Goes into ' + s.name}><input value={v.type} onChange={set('type')} placeholder="e.g. College tech fest" /></Field>
        <Field label="Audience"><input value={v.audience} onChange={set('audience')} placeholder="e.g. 50k+ engineering students" /></Field>
        <Field label="City"><input value={v.city} onChange={set('city')} /></Field>
        <Field label="Website"><input value={v.website} onChange={set('website')} /></Field>
        <Field label="Why it fits"><input value={v.why} onChange={set('why')} /></Field>
      </div>
      <button className="btn primary" disabled={busy}>Add target</button>
    </form>
  );
}
