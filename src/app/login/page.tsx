'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Screen = 'email' | 'otp' | 'verified' | 'profile' | 'recovery' | 'done'

const RESEND_COOLDOWN = 30
const OTP_LENGTH = 8

export default function LoginPage() {
  const [screen, setScreen] = useState<Screen>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [resendSecs, setResendSecs] = useState(RESEND_COOLDOWN)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const otpInputRef = useRef<HTMLInputElement>(null)

  function isValidEmail(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)
  }
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Resend cooldown timer
  useEffect(() => {
    if (screen !== 'otp') return
    timerRef.current = setInterval(() => {
      setResendSecs(s => {
        if (s <= 1) { clearInterval(timerRef.current!); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [screen])

  // Focus OTP input when screen changes to otp
  useEffect(() => {
    if (screen === 'otp') setTimeout(() => otpInputRef.current?.focus(), 100)
  }, [screen])

  // Auto-advance from 'verified' to 'profile'
  useEffect(() => {
    if (screen === 'verified') {
      const t = setTimeout(() => setScreen('profile'), 1400)
      return () => clearTimeout(t)
    }
  }, [screen])

  async function sendCode() {
    if (!isValidEmail(email)) return
    setLoading(true)
    setSendError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setSendError('Something went wrong sending the code. Please try again.')
    } else {
      setOtp('')
      setOtpError(null)
      setResendSecs(RESEND_COOLDOWN)
      setScreen('otp')
    }
  }

  function handleOtpChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setOtp(digits)
    setOtpError(null)
    if (digits.length === OTP_LENGTH) {
      setTimeout(() => verifyOtp(digits), 180)
    }
  }

  async function verifyOtp(code = otp) {
    if (code.length < OTP_LENGTH) return
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setOtpError(error.message.includes('expired') ? 'expired' : 'wrong')
    } else {
      setScreen('verified')
    }
  }

  async function saveProfile() {
    if (!firstName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('users').update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }).eq('id', user.id)
    setScreen('recovery')
  }

  async function saveRecovery(skip = false) {
    if (!skip && recoveryEmail.includes('@')) {
      await fetch('/api/recovery/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.trim() }),
      })
    }
    setScreen('done')
  }

  const finderPreview = firstName.trim() && lastName.trim()
    ? `${firstName.trim()} ${lastName.trim()[0].toUpperCase()}.`
    : firstName.trim() || null

  // ── Digit boxes for OTP ──
  const otpDigits = Array.from({ length: OTP_LENGTH }, (_, i) => {
    const ch = otp[i] ?? ''
    const active = otp.length === i && !otpError
    const isErr = !!otpError && otpError !== 'expired'
    const isExpired = otpError === 'expired'
    const borderColor = isErr || isExpired
      ? (isErr ? 'rgba(192,57,43,.45)' : 'var(--amber)')
      : active
        ? 'var(--accent)'
        : ch
          ? 'var(--accent-soft2)'
          : 'var(--line2)'
    const bg = isErr ? '#fff9f9' : ch || active ? 'var(--surface)' : 'var(--paper)'
    const color = isErr ? 'var(--error)' : isExpired ? 'var(--ink3)' : 'var(--ink)'
    return { ch: isExpired ? '–' : ch, borderColor, bg, color }
  })

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper p-6">
      <div className="w-full max-w-owner">

        {/* ── EMAIL ── */}
        {screen === 'email' && (
          <div className="animate-reveal">
            <div className="flex items-center gap-2 mb-10">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span style={{ font: "700 18px var(--ff)" }}>Foundly</span>
            </div>
            <h1 style={{ font: "800 28px/1.2 var(--ff)", letterSpacing: '-.025em', margin: '0 0 10px' }}>
              Welcome back.
            </h1>
            <p style={{ font: "400 15px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 28px' }}>
              Enter your email and we'll send a one-time code. No password to remember — ever.
            </p>
            <label className="label block mb-2">Email address</label>
            <div className="flex items-center gap-2 input mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendCode()}
                style={{ flex: 1, border: 'none', outline: 'none', font: "400 15px var(--ff)", background: 'transparent', color: 'var(--ink)', minWidth: 0 }}
              />
            </div>
            <button
              onClick={sendCode}
              disabled={!isValidEmail(email) || loading}
              className="btn-primary"
            >
              {loading ? 'Sending…' : 'Send me a code'}
            </button>
            {sendError && (
              <div className="error-inline mt-3 animate-reveal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                <span>{sendError}</span>
              </div>
            )}
            <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink3)', textAlign: 'center', margin: '22px 0 0' }}>
              New here? Your account is created automatically — same simple step either way.
            </p>
          </div>
        )}

        {/* ── OTP ── */}
        {screen === 'otp' && (
          <div className="animate-reveal">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setScreen('email')}
                style={{ width: 38, height: 38, border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.6"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{ font: "700 17px var(--ff)" }}>Foundly</span>
              </div>
              <div style={{ width: 38 }} />
            </div>

            <div className="text-center mb-6">
              <div style={{ width: 62, height: 62, borderRadius: 19, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m2 17 6-4"/></svg>
              </div>
              <h2 style={{ font: "800 23px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>Check your email</h2>
              <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
                We sent an 8-digit code to<br />
                <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{email}</b>
              </p>
            </div>

            {/* OTP digit boxes */}
            <div
              className="relative mb-3"
              onClick={() => otpInputRef.current?.focus()}
            >
              <div className="flex gap-2 justify-center pointer-events-none">
                {otpDigits.map((d, i) => (
                  <div key={i} style={{
                    width: 46, height: 56, borderRadius: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700,
                    color: d.color,
                    border: `${d.ch && !d.borderColor.includes('line') ? '2px' : '1.5px'} solid ${d.borderColor}`,
                    background: d.bg,
                    transition: 'border-color .15s',
                  }}>
                    {d.ch}
                  </div>
                ))}
              </div>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={e => handleOtpChange(e.target.value)}
                style={{ position: 'absolute', inset: 0, opacity: 0.01, cursor: 'text', fontSize: 16, background: 'transparent', border: 'none', outline: 'none', width: '100%', zIndex: 10 }}
              />
            </div>

            {otpError && (
              <div className="error-inline mb-3 animate-reveal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                <span>
                  {otpError === 'expired'
                    ? 'This code has expired. Request a new one.'
                    : "That code doesn't match. Please try again."}
                </span>
              </div>
            )}

            <button
              onClick={() => verifyOtp()}
              disabled={otp.length < OTP_LENGTH || loading}
              className="btn-primary"
            >
              {loading ? 'Verifying…' : 'Verify code'}
            </button>

            <div className="text-center mt-4">
              {resendSecs === 0 ? (
                <button
                  onClick={() => { setOtp(''); setOtpError(null); setResendSecs(RESEND_COOLDOWN); sendCode() }}
                  style={{ border: 'none', background: 'transparent', font: "600 14px var(--ff)", color: 'var(--accent)', cursor: 'pointer', padding: 8 }}
                >
                  Resend code
                </button>
              ) : (
                <span style={{ font: "400 13px var(--ff)", color: 'var(--ink3)' }}>
                  Didn't get it? Resend in <b style={{ color: 'var(--ink2)', fontWeight: 600 }}>{resendSecs}s</b>
                </span>
              )}
            </div>
            <p style={{ font: "400 12px var(--ff)", color: 'var(--ink3)', textAlign: 'center', margin: '10px 0 0' }}>
              Code expires in 10 minutes.
            </p>
          </div>
        )}

        {/* ── VERIFIED ── */}
        {screen === 'verified' && (
          <div className="animate-scale flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
            <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h2 style={{ font: "800 26px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 10px' }}>Email confirmed.</h2>
            <p style={{ font: "400 15px/1.55 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
              Just a couple of quick things and you're in…
            </p>
          </div>
        )}

        {/* ── PROFILE ── */}
        {screen === 'profile' && (
          <div className="animate-reveal">
            {/* Progress bar */}
            <div className="flex gap-1 mb-5">
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--line2)' }} />
            </div>
            <span className="mono" style={{ color: 'var(--ink3)', display: 'block', marginBottom: 8 }}>STEP 1 OF 2</span>
            <h2 style={{ font: "800 26px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>What should we call you?</h2>
            <p style={{ font: "400 15px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 20px' }}>
              This is how you'll appear when someone finds something of yours.
            </p>
            <div className="info-panel mb-5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6" style={{ flexShrink: 0, marginTop: 2 }}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
              <p style={{ font: "400 13.5px/1.5 var(--ff)", color: 'var(--accent-ink)', margin: 0 }}>
                A finder will only ever see <b style={{ fontWeight: 700 }}>"{finderPreview ?? 'John D.'}"</b> — your first name and last initial. Your full last name is never shown to anyone.
              </p>
            </div>
            <label className="label block mb-2">First name</label>
            <input
              className="input mb-3"
              placeholder="e.g. John"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <label className="label block mb-2">Last name</label>
            <input
              className="input mb-5"
              placeholder="e.g. Doe"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
            {finderPreview && (
              <div className="animate-reveal text-center mb-4" style={{ padding: 13, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line)' }}>
                <div className="label mb-1">Finders will see</div>
                <div className="flex items-center gap-2 justify-center">
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-soft2)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 13px var(--ff)" }}>
                    {firstName[0]?.toUpperCase()}
                  </span>
                  <span style={{ font: "700 20px var(--ff)", color: 'var(--ink)' }}>{finderPreview}</span>
                </div>
              </div>
            )}
            <button
              onClick={saveProfile}
              disabled={!firstName.trim()}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── RECOVERY EMAIL ── */}
        {screen === 'recovery' && (
          <div className="animate-reveal">
            <div className="flex gap-1 mb-5">
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--accent)' }} />
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="mono" style={{ color: 'var(--ink3)' }}>STEP 2 OF 2</span>
              <span style={{ font: "600 11px var(--ff)", color: 'var(--ink3)', background: 'var(--surface2)', border: '1px solid var(--line)', padding: '3px 9px', borderRadius: 999 }}>Optional</span>
            </div>
            <h2 style={{ font: "800 26px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>Add a recovery email?</h2>
            <p style={{ font: "400 15px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 20px' }}>
              A safety net in case you ever lose access to your main email.
            </p>
            <div style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, background: 'rgba(58,138,100,.09)', border: '1px solid rgba(58,138,100,.2)', marginBottom: 22 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="1.6" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p style={{ font: "400 13.5px/1.5 var(--ff)", color: '#2c6b4e', margin: 0 }}>
                This is <b style={{ fontWeight: 700 }}>only for recovering your account</b> — it is never shown to finders or anyone else. Your privacy stays fully intact.
              </p>
            </div>
            <label className="label block mb-2">Recovery email</label>
            <input
              type="email"
              className="input mb-4"
              placeholder="backup@email.com"
              value={recoveryEmail}
              onChange={e => setRecoveryEmail(e.target.value)}
            />
            <button
              onClick={() => saveRecovery(false)}
              disabled={!recoveryEmail.includes('@')}
              className="btn-primary mb-3"
            >
              Add recovery email
            </button>
            <button onClick={() => saveRecovery(true)} className="btn-secondary">
              Skip for now
            </button>
            <p style={{ font: "400 12px/1.5 var(--ff)", color: 'var(--ink3)', textAlign: 'center', margin: '14px 0 0' }}>
              You can add or change this anytime in Settings → Security.
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {screen === 'done' && (
          <div className="animate-reveal flex flex-col items-center justify-center text-center" style={{ minHeight: 400 }}>
            <div style={{ width: 88, height: 88, borderRadius: 28, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
            <h2 style={{ font: "800 28px/1.2 var(--ff)", letterSpacing: '-.025em', margin: '0 0 12px' }}>
              You're all set{firstName ? `, ${firstName}` : ''}.
            </h2>
            <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 32px', padding: '0 12px' }}>
              Your account is ready and your first tag is waiting. Privacy built in, from day one.
            </p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ maxWidth: 240 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Go to my tags
            </button>
          </div>
        )}

      </div>
    </main>
  )
}
