'use client'

import { useState, useEffect } from 'react'
import LocalTime from '@/components/LocalTime'

type TimelineEvent = {
  id: string
  actor: string
  event_type: string
  payload: Record<string, string> | null
  created_at: string
}

// Live timeline — hydrates from server-rendered events, then subscribes to the
// case SSE stream and appends new non-chat events (status changes, notes, …) as
// they happen. No refresh needed.
export default function Timeline({
  caseId,
  initialEvents,
}: {
  caseId: string
  initialEvents: TimelineEvent[]
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents)

  useEffect(() => {
    const lastTs = events.length > 0
      ? events[events.length - 1].created_at
      : new Date(0).toISOString()

    const es = new EventSource(`/api/cases/${caseId}/stream?since=${encodeURIComponent(lastTs)}`)

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        // Stream sends chat as type:'message' and everything else as type:'event'
        if (data.type === 'event' && data.event) {
          setEvents(prev => {
            if (prev.some(e => e.id === data.event.id)) return prev
            return [...prev, data.event]
          })
        }
      } catch { /* ignore parse errors */ }
    }

    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  if (events.length === 0) return null

  return (
    <section>
      <style>{`@keyframes tlPop { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <h2 className="label" style={{ display: 'block', marginBottom: 12 }}>Timeline</h2>
      <ol className="flex flex-col gap-2">
        {events.map((e, idx) => (
          <li
            key={e.id}
            className="flex gap-3"
            style={{
              font: "400 13px var(--ff)",
              color: 'var(--ink2)',
              // Only the freshly-arrived (last) item animates in
              ...(idx === events.length - 1 && idx >= initialEvents.length
                ? { animation: 'tlPop .28s cubic-bezier(.22,.61,.36,1) both' }
                : {}),
            }}
          >
            <LocalTime
              iso={e.created_at}
              style={{ color: 'var(--ink3)', flexShrink: 0, fontFamily: "'JetBrains Mono'", fontSize: 11 }}
            />
            <span>{formatEvent(e.event_type, e.payload)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function formatEvent(type: string, payload: Record<string, string> | null): string {
  switch (type) {
    case 'case_opened':    return 'Case opened by finder'
    case 'owner_notified': return 'Owner notified by email'
    case 'status_changed': return `Status changed: ${labelFor(payload?.from)} → ${labelFor(payload?.to)}`
    case 'note_added':     return `Note: ${payload?.note}`
    case 'chat_accepted':
      return payload?.to
        ? `Chat accepted — case moved to ${labelFor(payload.to)}`
        : 'Chat accepted by owner'
    case 'chat_declined':  return 'Chat declined by owner'
    default:               return type
  }
}

function labelFor(status?: string): string {
  if (!status) return ''
  return status.replace('_', ' ')
}
