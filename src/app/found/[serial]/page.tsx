import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import FinderForm from './FinderForm'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Found something? | Foundly',
    description: 'Help return this item to its owner — privately and securely.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA LAYER
//
// DEMO (now):  Tags are seeded via /api/demo/seed — real rows, same query.
// REAL (later): Provision physical NFC tags with real serials in the tags table.
//               NFC chip encodes: https://foundly.app/found/<serial>
//               Zero code change needed here — just real data.
// ─────────────────────────────────────────────────────────────────────────────
async function resolveTag(serial: string) {
  const supabase = await createClient()
  const { data: tag } = await supabase
    .from('tags')
    .select(`
      id, serial, status,
      items ( name ),
      users ( first_name, last_name )
    `)
    .eq('serial', serial.toUpperCase())
    .eq('status', 'active')
    .single()
  return tag
}

export default async function FoundPage({
  params,
}: {
  params: Promise<{ serial: string }>
}) {
  const { serial } = await params
  const tag = await resolveTag(serial)

  if (!tag) notFound()

  const user = (tag as any).users
  const ownerName = user
    ? `${user.first_name} ${user.last_name?.[0]?.toUpperCase() ?? ''}.`
    : 'someone'
  const itemName = (tag as any).items?.name ?? 'an item'
  const isDemo = serial.toUpperCase() === 'FN-DEMO'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 48px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Demo banner */}
        {isDemo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#f6ecd8', border: '1px solid rgba(192,138,46,.3)', marginBottom: 20 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c08a2e" strokeWidth="1.6" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <p style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a5a16', margin: 0 }}>Demo mode — this is a test tag</p>
          </div>
        )}

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 24 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span style={{ font: "700 16px 'Plus Jakarta Sans'", color: 'var(--ink)' }}>Foundly</span>
        </div>

        {/* Privacy pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft2)', marginBottom: 20 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: 'var(--accent-ink)' }}>
            No account needed · Owner&apos;s contact info stays private
          </span>
        </div>

        {/* Form card */}
        <div className="card p-5">
          <FinderForm tagId={tag.id} ownerName={ownerName} itemName={itemName} />
        </div>

        <p style={{ font: "400 12px/1.5 'Plus Jakarta Sans'", color: 'var(--ink3)', textAlign: 'center', margin: '20px 0 0' }}>
          Foundly connects finders and owners anonymously. Your info is only shared with the owner of this item.
        </p>
      </div>
    </main>
  )
}
