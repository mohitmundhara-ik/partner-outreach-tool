'use client';
import { useState } from 'react';
import { F, emailHtml, fillTemplate } from '@/lib/fields';
import { segmentOf, bandsOf } from '@/lib/segments';
import { Field } from './common';

export default function AddPartner({ template, types, onAdd, busy }) {
  const blank = { company: '', type: '', initiative: '', name: '', to: '', cc: '', audience: '', form: '', route: 'Direct email', notes: '' };
  const [v, setV] = useState(blank);
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const mail = fillTemplate(template, { company: v.company, initiative: v.initiative, name: v.name });
  const probe = { [F.companyType]: v.type, [F.company]: v.company, [F.audience]: v.audience };
  const seg = segmentOf(probe);
  const bands = bandsOf(probe);

  function submit(e) {
    e.preventDefault();
    onAdd({
      [F.company]: v.company.trim(), [F.companyType]: v.type, [F.to]: v.to.trim(), [F.cc]: v.cc.trim(),
      [F.audience]: v.audience, [F.initiative]: v.initiative, [F.form]: v.form, [F.route]: v.route, [F.notes]: v.notes,
      [F.subject]: mail.subject, [F.body]: mail.body,
    });
    setV(blank);
  }

  return (
    <div className="view">
      <div className="view-head"><div><h1>Add a partner</h1><p className="muted">It is added as a new row at the bottom of your sheet. The email is built from your fixed master text; only company, initiative and name change.</p></div></div>
      <div className="grid-main">
        <form className="card" onSubmit={submit}>
          <Field label="Company *"><input required value={v.company} onChange={set('company')} /></Field>
          <div className="two">
            <Field label="Company type" hint="This decides the segment">
              <input list="types" value={v.type} onChange={set('type')} placeholder="e.g. Tech job portal" />
              <datalist id="types">{types.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Audience" hint="This decides the audience bands"><input value={v.audience} onChange={set('audience')} placeholder="e.g. Senior backend engineers" /></Field>
          </div>
          <p className="small">Goes into <span className={'seg seg-' + seg.key}>{seg.name}</span> {bands.map((b) => <span key={b.key} className="band">{b.name}</span>)}</p>
          <Field label="Initiative or offering (goes in the email) *"><input required value={v.initiative} onChange={set('initiative')} placeholder="e.g. the Product (Un)Conference in Bengaluru" /></Field>
          <Field label="Contact first name (leave empty if not verified)"><input value={v.name} onChange={set('name')} /></Field>
          <div className="two">
            <Field label="To email"><input value={v.to} onChange={set('to')} /></Field>
            <Field label="CC email"><input value={v.cc} onChange={set('cc')} /></Field>
            <Field label="Route type">
              <select value={v.route} onChange={set('route')}>{['Direct email', 'Shared email', 'Partner form', 'Publisher email', 'Professional profile'].map((x) => <option key={x}>{x}</option>)}</select>
            </Field>
            <Field label="Form link"><input value={v.form} onChange={set('form')} /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={v.notes} onChange={set('notes')} /></Field>
          <button className="btn primary" disabled={busy}>{busy ? 'Adding…' : 'Add partner'}</button>
        </form>
        <div className="card">
          <h2>Email preview</h2>
          <div className="mailbox">
            <div className="mail-head"><div className="strong">{mail.subject}</div></div>
            <div className="mail" dangerouslySetInnerHTML={{ __html: emailHtml(mail.body, v.company) }} />
          </div>
        </div>
      </div>
    </div>
  );
}
