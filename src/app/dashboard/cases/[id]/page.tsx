import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'
import CaseStatusForm from './CaseStatusForm'
import MessageThread from './MessageThread'
import Timeline from './Timeline'
import ChatRequest from './ChatRequest'
import LocationMap from '@/components/LocationMap'
import { deriveChatState } from '@/lib/chat'

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('recovery_cases')
    .select(`*, tags ( serial, items ( name, photo_url ) )`)
    .eq('id', id)
    .single()

  if (!c) notFound()

  const { data: events } = await supabase
    .from('case_events')
    .select('*')
    .eq('case_id', c.id)
    .order('created_at', { ascending: true })

  const itemName = (c as any).tags?.items?.name ?? 'Unknown item'
  const chatEvents = (events ?? []).filter(e =>
    e.event_type === 'finder_message' || e.event_type === 'owner_reply'
  )
  const timelineEvents = (events ?? []).filter(e =>
    e.event_type !== 'finder_message' && e.event_type !== 'owner_reply'
  )

  const chatState = deriveChatState(events ?? [], c.finder_message)
  const finderMessages = chatEvents.filter(e => e.event_type === 'finder_message')

  const statusChip: Record<string, string> = {
    open: 'chip chip-open',
    in_progress: 'chip chip-in-progress',
    resolved: 'chip chip-resolved',
    archived: 'chip chip-archived',
  }

  const hasFinderContact = c.finder_name || c.finder_email || c.finder_phone
  const lat = c.finder_location_lat != null ? Number(c.finder_location_lat) : null
  const lng = c.finder_location_lng != null ? Number(c.finder_location_lng) : null
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
  const hasLocation = hasCoords || c.finder_location_label

  return (
    <div className="max-w-owner mx-auto">

      {/* Header */}
      <div className="flex items-start gap-3 mb-1">
        <h1 style={{ font: "800 27px/1.18 var(--ff)", letterSpacing: '-.025em', margin: 0, flex: 1 }}>
          {itemName}
        </h1>
        <span className={statusChip[c.status] ?? 'chip'} style={{ marginTop: 6 }}>
          <span className="chip-dot" />
          {c.status.replace('_', ' ')}
        </span>
      </div>
      <p style={{ font: "500 12px 'JetBrains Mono'", color: 'var(--ink3)', letterSpacing: '.04em', margin: '0 0 24px' }}>
        {(c as any).tags?.serial}
      </p>

      {/* ── CHAT REQUEST (pending) — owner must accept before chatting ────────── */}
      {chatState === 'pending' && (
        <section className="card p-5 mb-4" style={{ border: '1px solid var(--accent-soft2)', background: 'var(--accent-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h2 style={{ font: "700 15px var(--ff)", margin: 0, color: 'var(--accent-ink)' }}>
              The finder wants to chat
            </h2>
          </div>
          <p style={{ font: "400 13.5px/1.55 var(--ff)", color: 'var(--ink2)', margin: '0 0 14px' }}>
            Accept to start a private, two-way conversation. Your contact details stay hidden either way.
          </p>

          {/* Read-only preview of what the finder said */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(finderMessages.length > 0
              ? finderMessages.map(e => ({ id: e.id, text: (e.payload as any)?.message ?? '' }))
              : c.finder_message ? [{ id: 'fallback', text: c.finder_message }] : []
            ).map(m => (
              <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: '4px 14px 14px 14px', background: 'var(--surface)', border: '1px solid var(--line)', font: "400 14px/1.5 var(--ff)", color: 'var(--ink)' }}>
                {m.text}
              </div>
            ))}
          </div>

          <ChatRequest caseId={c.id} />
        </section>
      )}

      {/* ── ACTIVE CHAT — live two-way thread ─────────────────────────────────── */}
      {chatState === 'active' && (
        <section className="card p-5 mb-4">
          <h2 style={{ font: "700 15px var(--ff)", margin: '0 0 16px' }}>Messages</h2>
          <MessageThread
            caseId={c.id}
            initialEvents={chatEvents}
            finderMessageFallback={c.finder_message}
            caseStatus={c.status}
          />
        </section>
      )}

      {/* ── DECLINED — chat request was turned down ───────────────────────────── */}
      {chatState === 'declined' && (
        <section className="card p-5 mb-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          <p style={{ font: "400 14px var(--ff)", color: 'var(--ink3)', margin: 0 }}>
            You declined the chat request. The finder's other details (if any) are below.
          </p>
        </section>
      )}

      {/* Finder contact info */}
      {hasFinderContact && (
        <section className="card p-5 mb-4">
          <h2 style={{ font: "700 15px var(--ff)", margin: '0 0 16px' }}>Finder information</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px 16px' }}>
            {[
              ['Name', c.finder_name],
              ['Email', c.finder_email],
              ['Phone', c.finder_phone],
            ].filter(([, v]) => v).map(([label, val]) => (
              <Fragment key={label as string}>
                <dt style={{ font: "400 13px var(--ff)", color: 'var(--ink3)', margin: 0 }}>{label as string}</dt>
                <dd style={{ font: "400 14px var(--ff)", color: 'var(--ink)', margin: 0 }}>{val as string}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}

      {/* Location with map preview */}
      {hasLocation && (
        <section className="card p-5 mb-4">
          <h2 style={{ font: "700 15px var(--ff)", margin: '0 0 16px' }}>Where it was found</h2>
          {hasCoords ? (
            <LocationMap lat={lat!} lng={lng!} label={c.finder_location_label} />
          ) : (
            <p style={{ font: "400 14px var(--ff)", color: 'var(--ink)', margin: 0 }}>
              {c.finder_location_label}
            </p>
          )}
        </section>
      )}

      {/* Nothing shared */}
      {!hasFinderContact && !hasLocation && chatState === 'none' && (
        <section className="card p-5 mb-4" style={{ textAlign: 'center' }}>
          <p style={{ font: "400 14px var(--ff)", color: 'var(--ink3)', margin: 0 }}>
            The finder notified you anonymously without sharing any contact details.
          </p>
        </section>
      )}

      {/* Status action */}
      <div className="mb-6">
        <CaseStatusForm caseId={c.id} currentStatus={c.status} />
      </div>

      {/* Timeline (live — updates via SSE as actions happen) */}
      <Timeline caseId={c.id} initialEvents={timelineEvents as any} />
    </div>
  )
}
