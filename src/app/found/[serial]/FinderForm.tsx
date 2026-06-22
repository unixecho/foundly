'use client'

import { useState, useEffect, useRef } from 'react'
import LocationMap from '@/components/LocationMap'

type Screen = 'intro' | 'hub' | 'location' | 'chat' | 'contact' | 'chatroom' | 'success'
type LocationState = 'idle' | 'loading' | 'captured' | 'denied'
type ChatEvent = {
  id: string
  actor: string
  event_type: string
  payload: { message: string }
  created_at: string
}

// Injected once — animations for screen transitions, bubble pop, waiting dots
const STYLES = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(14px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes bubblePop {
  from { opacity: 0; transform: scale(.9) translateY(5px) }
  to   { opacity: 1; transform: scale(1) translateY(0) }
}
@keyframes dotBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: .35 }
  30%            { transform: translateY(-5px); opacity: 1 }
}
@keyframes successPop {
  0%   { opacity: 0; transform: scale(.7) }
  60%  { transform: scale(1.08) }
  100% { opacity: 1; transform: scale(1) }
}
.fd-screen { animation: slideUp .22s cubic-bezier(.22,.61,.36,1) both }
.fd-bubble { animation: bubblePop .18s ease-out both }
`

export default function FinderForm({
  tagId,
  ownerName,
  itemName,
}: {
  tagId: string
  ownerName: string
  itemName: string
}) {
  const [screen, setScreen] = useState<Screen>('intro')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [caseId, setCaseId] = useState<string | null>(null)

  // What the finder has contributed so far (drives the hub checklist)
  const [locationShared, setLocationShared] = useState(false)
  const [contactShared, setContactShared] = useState(false)
  const [chatRequested, setChatRequested] = useState(false)

  // Chat thread + acceptance state
  const [chatEvents, setChatEvents] = useState<ChatEvent[]>([])
  const [chatAccepted, setChatAccepted] = useState(false)
  const [chatDeclined, setChatDeclined] = useState(false)
  const [caseResolved, setCaseResolved] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  // Location
  const [locationState, setLocationState] = useState<LocationState>('idle')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [locationLabel, setLocationLabel] = useState('')

  // Contact
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({})

  // Chat (compose first message)
  const [chatMessage, setChatMessage] = useState('')

  const firstName = ownerName.split(' ')[0]

  // Submits a contribution to the SAME case (server merges, notifies owner once).
  async function submitCase(payload: {
    finderName?: string
    finderEmail?: string
    finderPhone?: string
    finderMessage?: string
    lat?: number | null
    lng?: number | null
    locationLabel?: string
  }): Promise<string | null> {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/cases/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId, ...payload }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (res.ok) {
      if (json.caseId) setCaseId(json.caseId)
      return json.caseId ?? caseId
    }
    setError(json.error ?? 'Something went wrong. Please try again.')
    return null
  }

  // SSE — connect while in the chat room, disconnect on leave
  useEffect(() => {
    if (screen !== 'chatroom' || !caseId) return

    // Initial fetch (covers the gap before SSE connects) — includes the
    // chat_accepted/declined control events so we know the acceptance state.
    fetch(`/api/cases/${caseId}/messages`).then(r => r.json()).then(({ events }) => {
      const list: ChatEvent[] = events ?? []
      setChatEvents(list.filter(e => e.event_type === 'finder_message' || e.event_type === 'owner_reply'))
      if (list.some(e => e.event_type === 'chat_accepted')) setChatAccepted(true)
      if (list.some(e => e.event_type === 'chat_declined')) setChatDeclined(true)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    })

    const since = new Date(0).toISOString()
    const es = new EventSource(`/api/cases/${caseId}/stream?since=${encodeURIComponent(since)}`)
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'message') {
          setChatEvents(prev => {
            if (prev.some(e => e.id === data.event.id)) return prev
            return [...prev, data.event]
          })
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
        } else if (data.type === 'event' && data.event) {
          const t = data.event.event_type
          if (t === 'chat_accepted') setChatAccepted(true)
          if (t === 'chat_declined') setChatDeclined(true)
          // Owner resolved/archived the case → the conversation is closed.
          if (t === 'status_changed') {
            const to = data.event.payload?.to
            if (to === 'resolved' || to === 'archived') setCaseResolved(true)
          }
        }
      } catch { /* ignore */ }
    }

    return () => { es.close(); esRef.current = null }
  }, [screen, caseId])

  async function sendFirstMessage() {
    const msg = chatMessage.trim()
    if (!msg || loading) return
    const id = await submitCase({ finderMessage: msg })
    if (id) {
      setChatRequested(true)
      setChatMessage('')
      setScreen('chatroom')
    }
  }

  async function sendFinderReply() {
    if (!replyText.trim() || !caseId || replySending || !chatAccepted) return
    setReplySending(true)
    const res = await fetch(`/api/cases/${caseId}/finder-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText.trim() }),
    })
    if (res.ok) setReplyText('')
    setReplySending(false)
    // SSE will push the new message back automatically
  }

  function requestLocation() {
    if (!navigator.geolocation) { setLocationState('denied'); return }
    setLocationState('loading')
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocationState('captured') },
      () => setLocationState('denied'),
      { timeout: 8000 }
    )
  }

  async function sendLocation() {
    // Send GPS coords plus a manual label if the finder typed one.
    const id = await submitCase({ lat, lng, locationLabel: locationLabel.trim() || undefined })
    if (id) { setLocationShared(true); setScreen('hub') }
  }

  async function sendManualLocation() {
    // Manual address only — used when the finder disagrees with GPS or skips it.
    const label = locationLabel.trim()
    if (!label) return
    const id = await submitCase({ locationLabel: label })
    if (id) { setLocationShared(true); setScreen('hub') }
  }

  async function sendContact() {
    const { errs, phoneE164 } = validateContact(name, email, phone)
    setContactErrors(errs)
    if (Object.keys(errs).length > 0) return
    const id = await submitCase({ finderName: name.trim(), finderEmail: email.trim(), finderPhone: phoneE164 })
    if (id) { setContactShared(true); setScreen('hub') }
  }

  const backBtn = (to: Screen, label = 'Back') => (
    <button
      onClick={() => { setError(null); setScreen(to) }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', font: "500 13px var(--ff)", color: 'var(--ink3)', cursor: 'pointer', padding: '0 0 16px', marginLeft: -4 }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m15 18-6-6 6-6"/></svg>
      {label}
    </button>
  )

  // ── INTRO ────────────────────────────────────────────────────
  if (screen === 'intro') return (
    <div key="intro" className="fd-screen" style={{ textAlign: 'center' }}>
      <style>{STYLES}</style>
      <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      </div>
      <h1 style={{ font: "800 24px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 8px' }}>
        You found {itemName}
      </h1>
      <p style={{ font: "400 15px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 6px' }}>
        This belongs to <strong style={{ color: 'var(--ink)' }}>{ownerName}</strong>.
      </p>
      <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink3)', margin: '0 0 28px' }}>
        No account needed. The owner's contact info is always kept private.
      </p>
      <p style={{ font: "700 15px var(--ff)", color: 'var(--ink)', margin: '0 0 14px' }}>
        Do you want to help return it?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={() => setScreen('hub')}
          style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)', font: "700 15px var(--ff)", cursor: 'pointer', boxShadow: 'var(--shadow-accent)', transition: 'opacity .15s' }}
        >
          Yes, help return it
        </button>
        <button
          onClick={() => setScreen('success')}
          style={{ width: '100%', height: 48, border: '1px solid var(--line2)', borderRadius: 14, background: 'var(--surface)', color: 'var(--ink3)', font: "500 14px var(--ff)", cursor: 'pointer' }}
        >
          No thanks
        </button>
      </div>
    </div>
  )

  // ── HUB — pick (and stack) ways to help; nothing is a dead-end ────────────────
  if (screen === 'hub') {
    const chatStatusLabel = chatDeclined
      ? 'Chat declined'
      : chatAccepted
        ? 'Chat active'
        : chatRequested
          ? 'Chat requested'
          : null

    const opts: { key: Screen; icon: React.ReactNode; title: string; body: string; done: boolean; doneLabel?: string }[] = [
      {
        key: 'location',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
        title: locationShared ? 'Location shared' : 'Share your location',
        body: locationShared ? 'Tap to update where the item is.' : 'Let the owner know where their item is right now.',
        done: locationShared,
      },
      {
        key: 'chat',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
        title: chatRequested ? 'Your chat' : 'Send a message',
        body: chatRequested ? 'Open the conversation with the owner.' : 'Write a quick note — the owner can accept and reply.',
        done: chatRequested,
        doneLabel: chatStatusLabel ?? undefined,
      },
      {
        key: 'contact',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
        title: contactShared ? 'Contact info shared' : 'Share contact info',
        body: contactShared ? 'Tap to update your details.' : 'Leave your name, email, or phone so the owner can reach you.',
        done: contactShared,
      },
    ]

    const anyShared = locationShared || contactShared || chatRequested

    return (
      <div key="hub" className="fd-screen">
        <style>{STYLES}</style>
        {backBtn('intro')}
        <p style={{ font: "700 16px var(--ff)", color: 'var(--ink)', margin: '0 0 4px' }}>
          How would you like to help {firstName}?
        </p>
        <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--ink3)', margin: '0 0 16px' }}>
          You can do more than one — add a location, a message, or your contact info.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {opts.map((opt, i) => (
            <button
              key={opt.key}
              onClick={() => {
                setError(null)
                // Returning to a requested chat goes straight to the room
                if (opt.key === 'chat' && chatRequested) setScreen('chatroom')
                else setScreen(opt.key)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 16, border: `1px solid ${opt.done ? 'rgba(58,138,100,.35)' : 'var(--line)'}`, background: opt.done ? '#f3f9f5' : 'var(--surface)', cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, box-shadow .15s', animation: `slideUp .22s ${i * 0.06}s cubic-bezier(.22,.61,.36,1) both` }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 13, background: opt.done ? '#e4f0e9' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {opt.done
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="2.2"><path d="M20 6 9 17l-5-5"/></svg>
                  : opt.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ font: "700 14px var(--ff)", color: 'var(--ink)', margin: '0 0 3px' }}>{opt.title}</p>
                <p style={{ font: "400 13px/1.4 var(--ff)", color: 'var(--ink3)', margin: 0 }}>{opt.body}</p>
                {opt.doneLabel && (
                  <span style={{ display: 'inline-block', marginTop: 6, font: "600 11px var(--ff)", color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 999 }}>
                    {opt.doneLabel}
                  </span>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ marginLeft: 'auto', flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        {anyShared && (
          <button
            onClick={() => setScreen('success')}
            style={{ width: '100%', height: 50, marginTop: 16, border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)', font: "700 15px var(--ff)", cursor: 'pointer', boxShadow: 'var(--shadow-accent)' }}
          >
            Done — I've helped
          </button>
        )}
      </div>
    )
  }

  // ── LOCATION ─────────────────────────────────────────────────
  if (screen === 'location') {
    const canSendManual = locationLabel.trim().length > 0
    return (
    <div key="location" className="fd-screen">
      <style>{STYLES}</style>
      {backBtn('hub')}
      <div style={{ textAlign: 'center', padding: '8px 0 22px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <h2 style={{ font: "700 18px var(--ff)", margin: '0 0 8px' }}>Where did you find it?</h2>
        <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
          Use your phone's GPS for the exact spot, or type an address if that's easier or more accurate.
        </p>
      </div>

      {/* ── GPS path ── */}
      {locationState === 'idle' && (
        <button onClick={requestLocation} style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)', font: "700 15px var(--ff)", cursor: 'pointer' }}>
          Use my current location
        </button>
      )}
      {locationState === 'loading' && (
        <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--line2)', font: "500 14px var(--ff)", color: 'var(--ink3)', gap: 8 }}>
          <Dots /> Getting your location…
        </div>
      )}
      {locationState === 'captured' && lat != null && lng != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LocationMap lat={lat} lng={lng} height={170} />
          <button onClick={sendLocation} disabled={loading} style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)', font: "700 15px var(--ff)", cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Sending…' : locationShared ? 'Update location' : `Send this location`}
          </button>
          <button onClick={() => { setLat(null); setLng(null); setLocationState('idle') }} style={{ border: 'none', background: 'transparent', font: "500 13px var(--ff)", color: 'var(--ink3)', cursor: 'pointer', padding: 0 }}>
            This spot looks wrong — enter an address instead
          </button>
        </div>
      )}
      {locationState === 'denied' && (
        <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line2)', font: "400 13px/1.5 var(--ff)", color: 'var(--ink3)' }}>
          Location access was denied — no problem. Just type the address or a landmark below.
        </div>
      )}

      {/* ── Manual path (always available) ── */}
      {locationState !== 'captured' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line2)' }} />
            <span style={{ font: "500 12px var(--ff)", color: 'var(--ink3)' }}>or enter it manually</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line2)' }} />
          </div>
          <textarea
            placeholder="Address or landmark — e.g. 12 Oak St, or 'left at the front desk of Central Library'"
            value={locationLabel}
            onChange={e => setLocationLabel(e.target.value)}
            rows={3}
            className="input"
            style={{ resize: 'none', lineHeight: 1.5, marginBottom: 12 }}
          />
          {error && <p style={{ font: "400 13px var(--ff)", color: 'var(--error)', margin: '0 0 10px' }}>{error}</p>}
          <button
            onClick={sendManualLocation}
            disabled={!canSendManual || loading}
            style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: canSendManual ? 'var(--accent)' : 'var(--line2)', color: canSendManual ? 'var(--on-accent)' : 'var(--ink3)', font: "700 15px var(--ff)", cursor: canSendManual && !loading ? 'pointer' : 'default', transition: 'background .15s, color .15s', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Sending…' : 'Send this address'}
          </button>
        </>
      )}
    </div>
    )
  }

  // ── CHAT / FIRST MESSAGE (the request) ───────────────────────
  if (screen === 'chat') {
    const canSend = chatMessage.trim().length > 0
    return (
      <div key="chat" className="fd-screen">
        <style>{STYLES}</style>
        {backBtn('hub')}
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h2 style={{ font: "700 18px var(--ff)", margin: '0 0 8px' }}>Send a message</h2>
          <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
            {firstName} will get a chat request. Once they accept, you can talk back and forth securely.
          </p>
        </div>
        <textarea
          placeholder={`Hi, I found your ${itemName}…`}
          value={chatMessage}
          onChange={e => setChatMessage(e.target.value)}
          rows={4}
          className="input"
          style={{ resize: 'none', lineHeight: 1.6, marginBottom: 12 }}
          autoFocus
        />
        {error && <p style={{ font: "400 13px var(--ff)", color: 'var(--error)', margin: '0 0 10px' }}>{error}</p>}
        <button
          onClick={sendFirstMessage}
          disabled={!canSend || loading}
          style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: canSend ? 'var(--accent)' : 'var(--line2)', color: canSend ? 'var(--on-accent)' : 'var(--ink3)', font: "700 15px var(--ff)", cursor: canSend && !loading ? 'pointer' : 'default', transition: 'background .15s, color .15s', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Sending…' : 'Send chat request'}
        </button>
      </div>
    )
  }

  // ── CONTACT INFO ─────────────────────────────────────────────
  if (screen === 'contact') {
    const hasAtLeastOne = name.trim() || email.trim() || phone.trim()
    return (
      <div key="contact" className="fd-screen">
        <style>{STYLES}</style>
        {backBtn('hub')}
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 style={{ font: "700 18px var(--ff)", margin: '0 0 8px' }}>Share your contact info</h2>
          <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>
            Leave at least one way for {firstName} to reach you. All fields are optional.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
          <div>
            <input
              type="text" placeholder="Your name" value={name}
              onChange={e => { setName(e.target.value); if (contactErrors.name) setContactErrors(p => ({ ...p, name: undefined })) }}
              className="input"
              style={contactErrors.name ? { borderColor: 'var(--error)' } : undefined}
              aria-invalid={!!contactErrors.name}
            />
            {contactErrors.name && <FieldError>{contactErrors.name}</FieldError>}
          </div>
          <div>
            <input
              type="email" inputMode="email" autoComplete="email" placeholder="Your email" value={email}
              onChange={e => { setEmail(e.target.value); if (contactErrors.email) setContactErrors(p => ({ ...p, email: undefined })) }}
              className="input"
              style={contactErrors.email ? { borderColor: 'var(--error)' } : undefined}
              aria-invalid={!!contactErrors.email}
            />
            {contactErrors.email && <FieldError>{contactErrors.email}</FieldError>}
          </div>
          <div>
            <input
              type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone, e.g. 050-123-4567" value={phone}
              onChange={e => { setPhone(e.target.value); if (contactErrors.phone) setContactErrors(p => ({ ...p, phone: undefined })) }}
              className="input"
              style={contactErrors.phone ? { borderColor: 'var(--error)' } : undefined}
              aria-invalid={!!contactErrors.phone}
            />
            {contactErrors.phone && <FieldError>{contactErrors.phone}</FieldError>}
          </div>
        </div>
        {!hasAtLeastOne && Object.keys(contactErrors).length === 0 && (
          <p style={{ font: "400 12px var(--ff)", color: 'var(--ink3)', margin: '0 0 10px', textAlign: 'center' }}>
            Fill in at least one field so {firstName} can reach you.
          </p>
        )}
        {error && <p style={{ font: "400 13px var(--ff)", color: 'var(--error)', margin: '0 0 10px' }}>{error}</p>}
        <button
          onClick={sendContact}
          disabled={!hasAtLeastOne || loading}
          style={{ width: '100%', height: 52, border: 'none', borderRadius: 14, background: hasAtLeastOne ? 'var(--accent)' : 'var(--line2)', color: hasAtLeastOne ? 'var(--on-accent)' : 'var(--ink3)', font: "700 15px var(--ff)", cursor: hasAtLeastOne && !loading ? 'pointer' : 'default', transition: 'background .15s', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Sending…' : contactShared ? 'Update details' : `Send to ${firstName}`}
        </button>
      </div>
    )
  }

  // ── CHAT ROOM (waiting for acceptance → active) ──────────────
  if (screen === 'chatroom') {
    // Owner resolved/archived — the conversation is closed for good.
    if (caseResolved) return <ResolvedView firstName={firstName} itemName={itemName} />
    return (
      <div key="chatroom" className="fd-screen" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <style>{STYLES}</style>
        {backBtn('hub', 'Back to options')}

        {/* Thread */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', padding: '4px 0 12px' }}>
          {chatEvents.map((e, idx) => {
            const isFinder = e.actor === 'finder'
            const isNew = idx >= chatEvents.length - 1
            return (
              <div
                key={e.id}
                className={isNew ? 'fd-bubble' : undefined}
                style={{ display: 'flex', flexDirection: 'column', alignItems: isFinder ? 'flex-end' : 'flex-start', gap: 4 }}
              >
                <span style={{ font: "500 11px var(--ff)", color: 'var(--ink3)', ...(isFinder ? { paddingRight: 2 } : { paddingLeft: 2 }) }}>
                  {isFinder ? 'You' : firstName}
                </span>
                <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: isFinder ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: isFinder ? 'var(--accent)' : 'var(--surface2)', border: isFinder ? 'none' : '1px solid var(--line)', font: "400 14px/1.5 var(--ff)", color: isFinder ? 'var(--on-accent)' : 'var(--ink)' }}>
                  {e.payload?.message}
                </div>
              </div>
            )
          })}

          {/* Acceptance state banner */}
          {chatDeclined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
              <span style={{ font: "400 13px/1.4 var(--ff)", color: 'var(--ink3)' }}>
                {firstName} isn't able to chat right now. Thanks for reaching out — your message was delivered.
              </span>
            </div>
          ) : !chatAccepted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)' }}>
              <Dots />
              <span style={{ font: "400 13px/1.4 var(--ff)", color: 'var(--accent-ink)' }}>
                Chat request sent — waiting for {firstName} to accept…
              </span>
            </div>
          ) : null}
          <div ref={chatBottomRef} />
        </div>

        {/* Reply input — only once the owner has accepted */}
        {chatAccepted && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 12, marginBottom: 8 }}>
            <textarea
              placeholder="Reply…"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFinderReply() } }}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--surface)', font: "400 14px var(--ff)", color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.5 }}
            />
            <button
              onClick={sendFinderReply}
              disabled={!replyText.trim() || replySending}
              style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: replyText.trim() ? 'var(--accent)' : 'var(--line2)', color: replyText.trim() ? 'var(--on-accent)' : 'var(--ink3)', font: "600 13px var(--ff)", cursor: replyText.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background .15s, color .15s', opacity: replySending ? 0.7 : 1 }}
            >
              {replySending ? '…' : 'Send'}
            </button>
          </div>
        )}

        <button
          onClick={() => setScreen('success')}
          style={{ border: 'none', background: 'transparent', font: "500 12px var(--ff)", color: 'var(--ink3)', cursor: 'pointer', padding: '4px 0', textAlign: 'center' }}
        >
          Done — close chat
        </button>
      </div>
    )
  }

  // ── SUCCESS ──────────────────────────────────────────────────
  return (
    <div key="success" className="fd-screen" style={{ textAlign: 'center', padding: '16px 0' }}>
      <style>{STYLES}</style>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#e4f0e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'successPop .4s cubic-bezier(.22,.61,.36,1) both' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="2.2"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <h2 style={{ font: "800 22px/1.2 var(--ff)", letterSpacing: '-.02em', margin: '0 0 10px' }}>
        Thanks for helping!
      </h2>
      <p style={{ font: "400 14px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 20px' }}>
        {firstName} has been notified and will be in touch. You're a good person.
      </p>
      {chatRequested && !chatDeclined && (
        <button
          onClick={() => setScreen('chatroom')}
          style={{ width: '100%', height: 46, marginBottom: 14, border: '1px solid var(--line2)', borderRadius: 12, background: 'var(--surface)', color: 'var(--ink2)', font: "600 14px var(--ff)", cursor: 'pointer' }}
        >
          Back to chat
        </button>
      )}
      <div style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)' }}>
        <p style={{ font: "400 13px/1.5 var(--ff)", color: 'var(--accent-ink)', margin: 0 }}>
          The owner's contact info was never visible to you — that's Foundly keeping both sides private.
        </p>
      </div>
    </div>
  )
}

// Shown on the finder's side once the owner marks the case resolved/archived.
// The chat is closed for good — a warm wrap-up with a blessing from Foundly.
function ResolvedView({ firstName, itemName }: { firstName: string; itemName: string }) {
  return (
    <div key="resolved" style={{ textAlign: 'center', padding: '12px 0' }}>
      <style>{`
        @keyframes rvSeal { 0% { opacity:0; transform: scale(.6) } 60% { transform: scale(1.08) } 100% { opacity:1; transform: scale(1) } }
        @keyframes rvLift { from { opacity:0; transform: translateY(8px) } to { opacity:1; transform: translateY(0) } }
        @keyframes rvRing { 0% { opacity:.5; transform: scale(.8) } 100% { opacity:0; transform: scale(1.5) } }
      `}</style>

      <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 22px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #3a8a64', animation: 'rvRing .9s ease-out .2s both' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#e4f0e9', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'rvSeal .5s cubic-bezier(.22,.61,.36,1) both' }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="2.2"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      </div>

      <h2 style={{ font: "800 22px/1.25 var(--ff)", letterSpacing: '-.02em', margin: '0 0 10px', animation: 'rvLift .4s .25s ease both' }}>
        Recovery complete
      </h2>
      <p style={{ font: "400 14px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 8px', animation: 'rvLift .4s .35s ease both' }}>
        {firstName} has their {itemName} back and marked this case resolved. The chat is now closed.
      </p>
      <p style={{ font: "400 14px/1.6 var(--ff)", color: 'var(--ink2)', margin: '0 0 22px', animation: 'rvLift .4s .45s ease both' }}>
        None of this happens without people like you. Thank you.
      </p>

      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)', animation: 'rvLift .4s .55s ease both' }}>
        <p style={{ font: "600 13px/1.6 var(--ff)", color: 'var(--accent-ink)', margin: 0 }}>
          With gratitude and a blessing from all of us at Foundly. 💚
        </p>
      </div>
    </div>
  )
}

// Inline per-field error text shown under a contact input
function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 5, font: "500 12px var(--ff)", color: 'var(--error)', margin: '6px 2px 0' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      {children}
    </p>
  )
}

// ── Contact validation ───────────────────────────────────────
// Fields are optional, but anything the finder DOES enter must be valid, and at
// least one contact method is required.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Phone: characters allowed in raw input — digits + common separators, optional leading +.
const PHONE_ALLOWED_RE = /^[+\d][\d\s().-]*$/

// Israeli numbering plan (country code +972), validated on the national significant
// number (NSN, i.e. without the +972 / leading-0 trunk prefix):
//   mobile  05X  → NSN starts 5, 9 digits   (^5\d{8}$)
//   VoIP    07X  → NSN starts 7, 9 digits   (^7\d{8}$)
//   landline 02/03/04/08/09 → NSN starts 2/3/4/8/9, 8 digits (^[23489]\d{7}$)
const IL_NSN_RE = /^(?:5\d{8}|7\d{8}|[23489]\d{7})$/

// Normalize a raw phone string to E.164 (+972…) if it's a valid Israeli number.
// Accepts 0XX…, +972…, 972…, or a bare NSN, with spaces/dashes/dots/parens.
// Returns { e164 } on success or { error } with a user-facing message.
function normalizeILPhone(raw: string): { e164: string } | { error: string } {
  if (/[a-zA-Z]/.test(raw) || !PHONE_ALLOWED_RE.test(raw.trim())) {
    return { error: 'Phone numbers can only contain digits.' }
  }
  let digits = raw.replace(/\D/g, '')
  if (!digits) return { error: 'Enter a valid Israeli phone number.' }

  // Strip the +972/972 country code or the national trunk 0 to get the NSN.
  if (digits.startsWith('972')) {
    digits = digits.slice(3).replace(/^0/, '')
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (!IL_NSN_RE.test(digits)) {
    return { error: 'Enter a valid Israeli number, e.g. 050-123-4567.' }
  }
  return { e164: '+972' + digits }
}

// Validates the contact fields and returns the normalized E.164 phone (empty if none/invalid).
function validateContact(name: string, email: string, phone: string) {
  const errs: { name?: string; email?: string; phone?: string } = {}
  const n = name.trim(), e = email.trim(), p = phone.trim()
  let phoneE164 = ''

  if (!n && !e && !p) {
    errs.email = 'Add at least one way for the owner to reach you.'
    return { errs, phoneE164 }
  }

  if (n && n.length < 2) errs.name = 'Please enter your full name.'

  if (e && !EMAIL_RE.test(e)) {
    errs.email = 'Enter a valid email, e.g. you@example.com'
  }

  if (p) {
    const res = normalizeILPhone(p)
    if ('error' in res) errs.phone = res.error
    else phoneE164 = res.e164
  }

  return { errs, phoneE164 }
}

// Animated bounce dots used in location loading + waiting indicator
function Dots() {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            opacity: 0.35,
            animation: `dotBounce 1.1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
