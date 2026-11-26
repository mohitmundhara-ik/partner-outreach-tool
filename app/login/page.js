'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (r.ok) window.location.href = '/';
    else setErr('Wrong password');
  }
  return (
    <main className="login">
      <form onSubmit={submit} className="card">
        <div className="logo">IK</div><h1>Partner Hub</h1>
        <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <button className="btn primary" type="submit">Open</button>
        {err && <p className="error">{err}</p>}
      </form>
    </main>
  );
}
