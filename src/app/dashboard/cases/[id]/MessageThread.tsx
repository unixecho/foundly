'use client'

import { useState, useEffect, useRef } from 'react'
import type { CaseStatus } from '@/types/database'
import LocalTime from '@/components/LocalTime'

type ChatEvent = {
  id: string
  actor: string
  event_type: string
  payload: { message: string }
  created_at: string
}

export default function MessageThread({
  caseId,
  initialEvents,
  finderMessageFallback,
  caseStatus,
}: {
  caseId: string
  initialEvents: ChatEvent[]
  finderMessageFallback?: string | null
  caseStatus: CaseStatus
}) {
  const [events, setEvents] = useState<ChatEvent[]>(initialEvents)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const archived = caseStatus === 'archived'

  useEffect(() => {
    // Once archived the conversation is closed — no need to keep a stream open.
    if (archived) return

    const lastTs = events.length > 0
      ? events[events.length - 1].created_at
      : new Date(0).toISOString()

    const es = new EventSource(`/api/cases/${caseId}/stream?since=${encodeURIComponent(lastTs)}`)
    esRef.current = es

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'message') {
          setEvents(prev => {
            // Deduplicate by id
            if (prev.some(e => e.id === data.event.id)) return prev
            return [...prev, data.event]
          })
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
        }
      } catch { /* ignore parse errors */ }
    }

    return () => { es.close(); esRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, archived])

  async function sendReply() {
    if (!reply.trim() || sending || archived) return
    setSending(true)
    await fetch(`/api/cases/${caseId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply.trim() }),
    })
    setReply('')
    setSending(false)
    // SSE will pick up the new message automatically — no manual refresh needed
  }

  const showFallback =
    !!finderMessageFallback &&
    !events.find(e => e.event_type === 'finder_message')

  const messageCount = events.length + (showFallback ? 1 : 0)

  const ANIM = `
    @keyframes mtBubblePop { from { opacity:0; transform:scale(.94) translateY(4px) } to { opacity:1; transform:scale(1) translateY(0) } }
    @keyframes mtFoldIn { from { opacity:0; transform:translateY(-8px) scaleY(.96); transform-origin:top } to { opacity:1; transform:translateY(0) scaleY(1) } }
    @keyframes mtExpand { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }
  `

  // ── ARCHIVED — conversation closed, folded away into a tidy card ──────────────
  if (archived) {
    return (
      <div style={{ animation: 'mtFoldIn .34s cubic-bezier(.22,.61,.36,1) both' }}>
        <style>{ANIM}</style>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 14,
            background: 'var(--surface2)', border: '1px solid var(--line)',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.6"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ font: "600 13.5px 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 2px' }}>
              Conversation archived
            </p>
            <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: 0 }}>
              {messageCount} message{messageCount !== 1 ? 's' : ''} · packed away, read-only
            </p>
          </div>
          {messageCount > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ flexShrink: 0, border: '1px solid var(--line2)', background: 'var(--surface)', borderRadius: 10, padding: '7px 12px', font: "600 12px 'Plus Jakarta Sans'", color: 'var(--ink2)', cursor: 'pointer' }}
            >
              {expanded ? 'Hide' : 'View'}
            </button>
          )}
        </div>

        {expanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', animation: 'mtExpand .25s ease both' }}>
            {showFallback && <Bubble actor="finder" message={finderMessageFallback!} />}
            {events.map(e => (
              <Bubble key={e.id} actor={e.actor} message={e.payload?.message ?? ''} timestamp={e.created_at} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── LIVE — open conversation ─────────────────────────────────────────────────
  return (
    <div>
      <style>{ANIM}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>

        {/* Initial finder_message stored on recovery_cases (pre-event-log legacy) */}
        {showFallback && (
          <Bubble actor="finder" message={finderMessageFallback!} />
        )}

        {events.map(e => (
          <Bubble
            key={e.id}
            actor={e.actor}
            message={e.payload?.message ?? ''}
            timestamp={e.created_at}
            animate
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Reply to finder…"
          rows={2}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() }
          }}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--surface)', font: "400 14px 'Plus Jakarta Sans'", color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.5 }}
        />
        <button
          onClick={sendReply}
          disabled={!reply.trim() || sending}
          style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: reply.trim() ? 'var(--accent)' : 'var(--line2)', color: reply.trim() ? 'var(--on-accent)' : 'var(--ink3)', font: "600 13px 'Plus Jakarta Sans'", cursor: reply.trim() && !sending ? 'pointer' : 'default', flexShrink: 0, transition: 'background .15s, color .15s', opacity: sending ? 0.7 : 1 }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

function Bubble({
  actor,
  message,
  timestamp,
  animate = false,
}: {
  actor: string
  message: string
  timestamp?: string
  animate?: boolean
}) {
  const isOwner = actor === 'owner'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwner ? 'flex-end' : 'flex-start',
        gap: 4,
        ...(animate ? { animation: 'mtBubblePop .2s ease-out' } : {}),
      }}
    >
      <span style={{ font: "500 11px 'Plus Jakarta Sans'", color: 'var(--ink3)', ...(isOwner ? { paddingRight: 2 } : { paddingLeft: 2 }) }}>
        {isOwner ? 'You' : 'Finder'}
      </span>
      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: isOwner ? '14px 4px 14px 14px' : '4px 14px 14px 14px', background: isOwner ? 'var(--accent)' : 'var(--surface2)', border: isOwner ? 'none' : '1px solid var(--line)', font: "400 14px/1.5 'Plus Jakarta Sans'", color: isOwner ? 'var(--on-accent)' : 'var(--ink)' }}>
        {message}
      </div>
      {timestamp && (
        <LocalTime
          iso={timestamp}
          mode="time"
          style={{ font: "400 11px 'JetBrains Mono'", color: 'var(--ink3)' }}
        />
      )}
    </div>
  )
}
