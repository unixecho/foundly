'use client'

import { useState } from 'react'

export default function ProfileSection({
  firstName,
  lastName,
  email,
}: {
  firstName: string
  lastName: string
  email: string
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [first, setFirst] = useState(firstName)
  const [last, setLast] = useState(lastName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = first.trim().length >= 2 && last.trim().length >= 1
  const lastInitial = last.trim()[0]?.toUpperCase() ?? ''

  async function save() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/profile/name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: first.trim(), lastName: last.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.')
      return
    }
    // Reload so the layout/greeting and "finders see" reflect the new name.
    window.location.reload()
  }

  function cancel() {
    setFirst(firstName)
    setLast(lastName)
    setError(null)
    setMode('view')
  }

  return (
    <section className="card p-5 mb-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ font: "700 16px 'Plus Jakarta Sans'", margin: 0 }}>Profile</h2>
        {mode === 'view' && (
          <button
            onClick={() => setMode('edit')}
            style={{ border: 'none', background: 'transparent', font: "600 12px 'Plus Jakarta Sans'", color: 'var(--accent)', cursor: 'pointer', padding: '4px 8px' }}
          >
            Edit name
          </button>
        )}
      </div>

      {mode === 'view' ? (
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 14 }}>
          <dt style={{ color: 'var(--ink3)' }}>Name</dt>
          <dd style={{ margin: 0 }}>{firstName} {lastName}</dd>
          <dt style={{ color: 'var(--ink3)' }}>Email</dt>
          <dd style={{ margin: 0 }}>{email}</dd>
          <dt style={{ color: 'var(--ink3)' }}>Finders see</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>
            {firstName} {lastName?.[0]?.toUpperCase()}.
          </dd>
        </dl>
      ) : (
        <div className="animate-reveal">
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label block mb-2">First name</label>
              <input
                className="input"
                value={first}
                onChange={e => { setFirst(e.target.value); setError(null) }}
                autoFocus
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label block mb-2">Last name</label>
              <input
                className="input"
                value={last}
                onChange={e => { setLast(e.target.value); setError(null) }}
              />
            </div>
          </div>
          <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: '0 0 14px' }}>
            Finders will see <b>{first.trim() || '—'} {lastInitial && `${lastInitial}.`}</b> — your last name stays private.
          </p>
          {error && (
            <p style={{ font: "400 13px 'Plus Jakarta Sans'", color: 'var(--error)', margin: '0 0 10px' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={save}
              disabled={!valid || loading}
              style={{ flex: 1, height: 46, border: 'none', borderRadius: 12, background: valid && !loading ? 'var(--accent)' : 'var(--line2)', color: valid && !loading ? 'var(--on-accent)' : 'var(--ink3)', font: "600 14px 'Plus Jakarta Sans'", cursor: valid && !loading ? 'pointer' : 'default', transition: 'all .15s' }}
            >
              {loading ? 'Saving…' : 'Save name'}
            </button>
            <button
              onClick={cancel}
              disabled={loading}
              style={{ height: 46, padding: '0 16px', border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', font: "600 13px 'Plus Jakarta Sans'", color: 'var(--ink3)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
