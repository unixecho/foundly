'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Screen = 'scan' | 'used' | 'invalid' | 'name' | 'success'

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivateContent />
    </Suspense>
  )
}

function ActivateContent() {
  const [screen, setScreen] = useState<Screen>('scan')
  const [codeInput, setCodeInput] = useState('')
  const [verifiedCode, setVerifiedCode] = useState('')
  const [verifiedTagId, setVerifiedTagId] = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Pre-fill from ?code= param (set by legacy /activate/[token] redirect)
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setCodeInput(code.toUpperCase())
      lookupCode(code)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Blocked nicknames: generic placeholders the design explicitly rejects
  const BLOCKED = /^(tag\s*#?\d*|item\s*#?\d*|my\s*tag|new\s*tag|untitled)$/i

  async function lookupCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase().replace(/^FN-?/, 'FN-')
    if (!code.startsWith('FN-') || code.length < 5) {
      setScreen('invalid')
      return
    }

    setLoading(true)
    // Tags have serial = the full code (e.g. "FN-8KQ2-X4")
    // activation_token is a separate one-time token used in the URL-based flow
    // In the QR flow, the QR encodes the activation URL: /activate?code=FN-8KQ2-X4
    // We look up the tag by its activation_token which matches the code on the QR
    const { data: tag } = await supabase
      .from('tags')
      .select('id, serial, status, activation_token')
      .eq('activation_token', code)
      .single()

    setLoading(false)

    if (!tag) {
      setScreen('invalid')
      return
    }

    if (tag.status !== 'unactivated') {
      setScreen('used')
      return
    }

    setVerifiedCode(code)
    setVerifiedTagId(tag.id)
    setScreen('name')
  }

  function handleCodeChange(val: string) {
    // Auto-prepend FN- if user starts typing without it
    let v = val.toUpperCase()
    if (v && !v.startsWith('FN-') && !v.startsWith('FN')) {
      v = 'FN-' + v
    }
    setCodeInput(v)
  }

  function validateNickname(val: string): string | null {
    if (!val.trim()) return 'Please give this item a nickname.'
    if (BLOCKED.test(val.trim())) return 'Use a descriptive name like "Blue Backpack" or "House Keys".'
    if (val.trim().length < 2) return 'Must be at least 2 characters.'
    return null
  }

  async function activateTag() {
    const err = validateNickname(nickname)
    if (err) { setNicknameError(err); return }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      sessionStorage.setItem('pending_activation_code', verifiedCode)
      router.push('/login?next=/activate')
      return
    }

    // Create item
    const { data: item, error: itemErr } = await supabase
      .from('items')
      .insert({ name: nickname.trim(), owner_id: user.id })
      .select('id')
      .single()

    if (itemErr || !item) {
      setNicknameError('Could not create item. Please try again.')
      setLoading(false)
      return
    }

    // Activate via API (needs service role to clear activation_token)
    const res = await fetch('/api/tags/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId: verifiedTagId, itemId: item.id, activationToken: verifiedCode }),
    })

    setLoading(false)
    if (res.ok) {
      setScreen('success')
    } else {
      const { error } = await res.json()
      setNicknameError(error ?? 'Activation failed. Please try again.')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-owner">

        {/* ── SCAN ── */}
        {screen === 'scan' && (
          <div className="animate-reveal">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => router.push('/dashboard')}
                style={{ width: 38, height: 38, border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.6"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
              <span className="mono" style={{ color: 'var(--ink3)' }}>STEP 1 OF 2</span>
              <div style={{ width: 38 }} />
            </div>

            <h2 style={{ font: "800 25px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>
              Scan your tag's QR code
            </h2>
            <p style={{ font: "400 14.5px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 22px' }}>
              Point your camera at the QR printed on the Foundly tag or its card. Each tag activates exactly once.
            </p>

            {/* QR viewfinder mock */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: 24, overflow: 'hidden', background: '#0d0e13', marginBottom: 18 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 120% at 50% 30%, #2a2c38 0%, #0d0e13 70%)' }} />
              {/* Corner brackets */}
              {[
                { top: 24, left: 24, borderTop: true, borderLeft: true },
                { top: 24, right: 24, borderTop: true, borderRight: true },
                { bottom: 24, left: 24, borderBottom: true, borderLeft: true },
                { bottom: 24, right: 24, borderBottom: true, borderRight: true },
              ].map((c, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 36, height: 36,
                  ...(c.top !== undefined ? { top: c.top } : { bottom: c.bottom }),
                  ...(c.left !== undefined ? { left: c.left } : { right: c.right }),
                  borderTop: c.borderTop ? '3px solid rgba(255,255,255,.85)' : undefined,
                  borderLeft: c.borderLeft ? '3px solid rgba(255,255,255,.85)' : undefined,
                  borderBottom: c.borderBottom ? '3px solid rgba(255,255,255,.85)' : undefined,
                  borderRight: c.borderRight ? '3px solid rgba(255,255,255,.85)' : undefined,
                  borderRadius: c.borderTop && c.borderLeft ? '8px 0 0 0' : c.borderTop && c.borderRight ? '0 8px 0 0' : c.borderBottom && c.borderLeft ? '0 0 0 8px' : '0 0 8px 0',
                }} />
              ))}
              {/* Center QR icon */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 96, height: 96, borderRadius: 16, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.4">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  <path d="M14 14h1v1h-1zM16 14h1v1h-1zM18 14h3v1h-3zM14 16h1v1h-1zM16 16h1v3h-1zM18 16h1v1h-1zM20 16h1v1h-1zM18 18h1v1h-1zM20 18h1v3h-1z"/>
                </svg>
              </div>
              <p style={{ position: 'absolute', bottom: 16, width: '100%', textAlign: 'center', font: "500 12px var(--ff)", color: 'rgba(255,255,255,.4)', margin: 0 }}>
                Camera access required
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-4">
              <div style={{ flex: 1, height: 1, background: 'var(--line2)' }} />
              <span style={{ font: "500 12px var(--ff)", color: 'var(--ink3)' }}>or enter the code</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line2)' }} />
            </div>

            {/* Manual code input */}
            <div className="flex items-center gap-3 input mb-3" style={{ marginBottom: 16 }}>
              <span className="mono" style={{ color: 'var(--ink3)', flexShrink: 0 }}>FN-</span>
              <input
                type="text"
                placeholder="8KQ2-X4"
                value={codeInput.replace(/^FN-?/, '')}
                onChange={e => handleCodeChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupCode(codeInput)}
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', background: 'transparent', color: 'var(--ink)', minWidth: 0 }}
              />
            </div>
            <button
              onClick={() => lookupCode(codeInput)}
              disabled={!codeInput.trim() || loading}
              className="btn-primary"
            >
              {loading ? 'Checking…' : 'Submit code'}
            </button>
          </div>
        )}

        {/* ── USED (already activated) ── */}
        {screen === 'used' && (
          <div className="animate-scale flex flex-col" style={{ minHeight: 500 }}>
            <div style={{ width: 84, height: 84, borderRadius: 26, background: 'var(--amber-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.6"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <h2 style={{ font: "800 24px/1.22 var(--ff)", letterSpacing: '-.02em', margin: '0 0 10px' }}>This tag's already in use</h2>
            <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 8px', padding: '0 6px' }}>
              Activation codes work once and then retire — that's what keeps a tag tied to a single owner. Nothing's wrong on your end.
            </p>
            <p style={{ font: "400 13.5px/1.55 var(--ff)", color: 'var(--ink3)', margin: '0 0 auto', padding: '0 10px' }}>
              If you believe this tag should be yours, we can help you recover it.
            </p>
            <div className="flex flex-col gap-3 mt-8">
              <button onClick={() => { setCodeInput(''); setScreen('scan') }} className="btn-primary">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
                Try another tag
              </button>
              <button className="btn-secondary">Contact support</button>
            </div>
          </div>
        )}

        {/* ── INVALID ── */}
        {screen === 'invalid' && (
          <div className="animate-scale flex flex-col" style={{ minHeight: 500 }}>
            <div style={{ width: 84, height: 84, borderRadius: 26, background: 'var(--error-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.6"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <h2 style={{ font: "800 24px/1.22 var(--ff)", letterSpacing: '-.02em', margin: '0 0 10px' }}>We couldn't read that code</h2>
            <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 20px', padding: '0 6px' }}>
              It doesn't match any Foundly tag. Give it another scan, or double-check the code printed on the tag.
            </p>
            <div className="flex flex-col gap-2 mb-auto">
              {[
                <>Make sure the whole QR is in frame</>,
                <>Wipe the tag if it's scratched or dusty</>,
                <>Codes start with <span className="mono" style={{ fontWeight: 600 }}>FN-</span></>,
              ].map((hint, i) => (
                <div key={i} className="flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M20 6 9 17l-5-5"/></svg>
                  <span style={{ font: "400 13px var(--ff)", color: 'var(--ink2)' }}>{hint}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { setCodeInput(''); setScreen('scan') }} className="btn-primary mt-8">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              Scan again
            </button>
          </div>
        )}

        {/* ── NAME ITEM ── */}
        {screen === 'name' && (
          <div className="animate-reveal">
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setScreen('scan')}
                style={{ width: 38, height: 38, border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.6"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span className="mono" style={{ color: 'var(--ink3)' }}>STEP 2 OF 2</span>
              <div style={{ width: 38 }} />
            </div>

            {/* Verified badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 999, background: 'rgba(58,138,100,.1)', border: '1px solid rgba(58,138,100,.2)', width: 'fit-content', marginBottom: 20 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
              <span style={{ font: "600 12.5px var(--ff)", color: '#2c6b4e' }}>
                Tag verified · <span className="mono">{verifiedCode}</span>
              </span>
            </div>

            <h2 style={{ font: "800 25px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>
              What is this tag protecting?
            </h2>
            <p style={{ font: "400 14.5px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 22px' }}>
              Give it a nickname you'll recognise at a glance. It's only ever for your eyes.
            </p>

            <label className="label block mb-2">Item nickname</label>
            <input
              className="input mb-2"
              placeholder='e.g. "Blue Backpack" or "House Keys"'
              value={nickname}
              onChange={e => { setNickname(e.target.value); setNicknameError(null) }}
              onKeyDown={e => e.key === 'Enter' && activateTag()}
            />
            {nicknameError && (
              <div className="error-inline mb-3 animate-reveal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                <span>{nicknameError}</span>
              </div>
            )}
            <p style={{ font: "400 12px var(--ff)", color: 'var(--ink3)', margin: '0 0 20px' }}>
              Descriptive names make it easier to identify recovered items.
            </p>
            <button
              onClick={activateTag}
              disabled={!nickname.trim() || loading}
              className="btn-primary"
            >
              {loading ? 'Activating…' : 'Activate tag'}
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {screen === 'success' && (
          <div className="animate-scale flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <h2 style={{ font: "800 28px/1.2 var(--ff)", letterSpacing: '-.025em', margin: '0 0 12px' }}>
              {nickname} is now protected.
            </h2>
            <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 32px', padding: '0 12px' }}>
              If someone finds it and scans the tag, you'll be notified right away.
            </p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ maxWidth: 240 }}>
              Back to dashboard
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
