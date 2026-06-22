'use client'

import { useState } from 'react'

export default function RecoveryEmailSection({
  currentEmail,
  verified,
}: {
  currentEmail: string | null
  verified: boolean
}) {
  const [mode, setMode] = useState<'view' | 'add' | 'sent' | 'removing'>('view')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft)

  async function sendVerification() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/recovery/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: draft }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong. Please try again.')
    } else {
      setMode('sent')
    }
  }

  async function removeRecovery() {
    setLoading(true)
    await fetch('/api/recovery/remove', { method: 'POST' })
    setLoading(false)
    // Reload to reflect change
    window.location.reload()
  }

  const statusChip = !currentEmail
    ? { label: 'Not set', color: 'var(--ink3)', bg: 'var(--surface2)' }
    : verified
      ? { label: 'Verified', color: '#2e6a4d', bg: '#e4f0e9' }
      : { label: 'Unverified', color: '#8a5a16', bg: '#f6ecd8' }

  return (
    <section className="card p-5 mb-4" style={{ border: `1px solid ${!verified && currentEmail ? 'rgba(192,138,46,.3)' : 'var(--line)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ font: "700 16px var(--ff)", margin: 0 }}>Emergency email</h2>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, font: "600 11px var(--ff)", color: statusChip.color, background: statusChip.bg }}>
          {statusChip.label}
        </span>
      </div>
      <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 16px' }}>
        A backup way to recover your account if you lose access to your primary email. Never shown to finders.
      </p>

      {/* View state */}
      {mode === 'view' && (
        <>
          {currentEmail ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line)', marginBottom: 12 }}>
              <span style={{ font: "500 14px var(--ff)", color: 'var(--ink)' }}>{currentEmail}</span>
              {!verified && (
                <button
                  onClick={() => { setDraft(currentEmail); setMode('add') }}
                  style={{ border: 'none', background: 'transparent', font: "600 12px var(--ff)", color: 'var(--amber, #c08a2e)', cursor: 'pointer', padding: '4px 8px' }}
                >
                  Resend link
                </button>
              )}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setDraft(''); setMode('add') }}
              style={{ flex: 1, height: 44, border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', font: "600 13px var(--ff)", color: 'var(--ink2)', cursor: 'pointer' }}
            >
              {currentEmail ? 'Change' : 'Add emergency email'}
            </button>
            {currentEmail && (
              <button
                onClick={removeRecovery}
                disabled={loading}
                style={{ height: 44, padding: '0 16px', border: '1px solid var(--error-soft2)', borderRadius: 12, background: 'var(--error-soft)', font: "600 13px var(--ff)", color: 'var(--error)', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}

      {/* Add / send verification */}
      {mode === 'add' && (
        <div className="animate-reveal">
          <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 10px' }}>
            We'll send a confirmation link to verify you own this address.
          </p>
          <input
            type="email"
            className="input mb-3"
            placeholder="backup@email.com"
            value={draft}
            onChange={e => { setDraft(e.target.value); setError(null) }}
            autoFocus
          />
          {error && (
            <p style={{ font: "400 13px var(--ff)", color: 'var(--error)', margin: '0 0 10px' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={sendVerification}
              disabled={!isValid || loading}
              style={{ flex: 1, height: 46, border: 'none', borderRadius: 12, background: isValid && !loading ? 'var(--accent)' : 'var(--line2)', color: isValid && !loading ? 'var(--on-accent)' : 'var(--ink3)', font: "600 14px var(--ff)", cursor: isValid && !loading ? 'pointer' : 'default', transition: 'all .15s' }}
            >
              {loading ? 'Sending…' : 'Send confirmation link'}
            </button>
            <button
              onClick={() => setMode('view')}
              style={{ height: 46, padding: '0 16px', border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', font: "600 13px var(--ff)", color: 'var(--ink3)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sent confirmation */}
      {mode === 'sent' && (
        <div className="animate-reveal" style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#e4f0e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <p style={{ font: "700 15px var(--ff)", margin: '0 0 6px' }}>Confirmation sent</p>
          <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 16px' }}>
            Check <b>{draft}</b> and click the link to confirm. It expires in 24 hours.
          </p>
          <button
            onClick={() => setMode('view')}
            style={{ border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--surface)', font: "600 13px var(--ff)", color: 'var(--ink2)', cursor: 'pointer', padding: '8px 18px' }}
          >
            Done
          </button>
        </div>
      )}
    </section>
  )
}
