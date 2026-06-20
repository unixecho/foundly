import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import CaseStatusForm from './CaseStatusForm'

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('recovery_cases')
    .select(`
      *,
      tags (
        serial,
        items ( name, photo_url )
      )
    `)
    .eq('id', id)
    .single()

  if (!c) notFound()

  const { data: events } = await supabase
    .from('case_events')
    .select('*')
    .eq('case_id', c.id)
    .order('created_at', { ascending: true })

  const itemName = (c as any).tags?.items?.name ?? 'Unknown item'

  const statusChip: Record<string, string> = {
    open: 'chip chip-open',
    in_progress: 'chip chip-in-progress',
    resolved: 'chip chip-resolved',
    archived: 'chip chip-archived',
  }

  return (
    <div className="max-w-owner mx-auto">
      <div className="flex items-start gap-3 mb-1">
        <h1 style={{ font: "800 27px/1.18 'Plus Jakarta Sans'", letterSpacing: '-.025em', margin: 0, flex: 1 }}>
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

      {/* Finder info */}
      <section className="card p-5 mb-4">
        <h2 style={{ font: "700 15px 'Plus Jakarta Sans'", margin: '0 0 16px' }}>Finder information</h2>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px 16px' }}>
          {[
            ['Name', c.finder_name],
            ['Email', c.finder_email],
            ['Phone', c.finder_phone],
            ['Message', c.finder_message],
            ['Location', c.finder_location_label ?? (c.finder_location_lat ? `${c.finder_location_lat}, ${c.finder_location_lng}` : null)],
          ].map(([label, val]) => (
            <>
              <dt key={`dt-${label}`} style={{ font: "400 13px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: 0 }}>{label}</dt>
              <dd key={`dd-${label}`} style={{ font: "400 14px 'Plus Jakarta Sans'", color: val ? 'var(--ink)' : 'var(--ink3)', margin: 0 }}>
                {val ?? '—'}
              </dd>
            </>
          ))}
        </dl>
      </section>

      {/* Status action */}
      <div className="mb-6">
        <CaseStatusForm caseId={c.id} currentStatus={c.status} />
      </div>

      {/* Timeline */}
      <section>
        <h2 className="label" style={{ display: 'block', marginBottom: 12 }}>Timeline</h2>
        <ol className="flex flex-col gap-2">
          {events?.map(e => (
            <li key={e.id} className="flex gap-3" style={{ font: "400 13px 'Plus Jakarta Sans'", color: 'var(--ink2)' }}>
              <span style={{ color: 'var(--ink3)', flexShrink: 0, fontFamily: "'JetBrains Mono'", fontSize: 11 }}>
                {new Date(e.created_at).toLocaleString()}
              </span>
              <span>{formatEvent(e.event_type, e.payload as Record<string, string> | null)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function formatEvent(type: string, payload: Record<string, string> | null): string {
  switch (type) {
    case 'case_opened':    return 'Case opened by finder'
    case 'owner_notified': return 'Owner notified by email'
    case 'status_changed': return `Status changed: ${payload?.from} → ${payload?.to}`
    case 'note_added':     return `Note: ${payload?.note}`
    default:               return type
  }
}
