import { createClient } from '@/lib/supabase/server'
import type { RecoveryCaseWithTag } from '@/types/database'
import Link from 'next/link'

export default async function CasesPage() {
  const supabase = await createClient()

  const { data: cases } = await supabase
    .from('recovery_cases')
    .select(`
      *,
      tags (
        serial, status,
        items ( name, photo_url )
      )
    `)
    .order('opened_at', { ascending: false })

  const active = cases?.filter(c => c.status === 'open' || c.status === 'in_progress') ?? []
  const resolved = cases?.filter(c => c.status === 'resolved') ?? []
  const archived = cases?.filter(c => c.status === 'archived') ?? []

  const nothing = active.length === 0 && resolved.length === 0 && archived.length === 0

  return (
    <div className="max-w-owner mx-auto">
      <h1 style={{ font: "800 26px/1.2 'Plus Jakarta Sans'", letterSpacing: '-.025em', margin: '0 0 24px' }}>
        Recovery cases
      </h1>

      {nothing && (
        <p style={{ font: "400 14px 'Plus Jakarta Sans'", color: 'var(--ink3)' }}>
          No recovery cases yet. Cases are created when someone scans one of your tags.
        </p>
      )}

      {active.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="label" style={{ display: 'block', marginBottom: 12 }}>Active</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.map(c => <CaseRow key={c.id} c={c as RecoveryCaseWithTag} />)}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="label" style={{ display: 'block', marginBottom: 12 }}>Resolved</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolved.map(c => <CaseRow key={c.id} c={c as RecoveryCaseWithTag} />)}
          </div>
        </section>
      )}

      {/* Archived — packed away: compact, muted, tucked at the bottom */}
      {archived.length > 0 && (
        <section>
          <h2 className="label" style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
            Archived
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {archived.map(c => <ArchivedRow key={c.id} c={c as RecoveryCaseWithTag} />)}
          </div>
        </section>
      )}
    </div>
  )
}

const CHIP: Record<string, string> = {
  open: 'chip chip-open',
  in_progress: 'chip chip-in-progress',
  resolved: 'chip chip-resolved',
  archived: 'chip chip-archived',
}

function CaseRow({ c }: { c: RecoveryCaseWithTag }) {
  const itemName = c.tags?.items?.name ?? 'Unknown item'
  return (
    <Link
      href={`/dashboard/cases/${c.id}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 15px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--line)', textDecoration: 'none', boxShadow: '0 1px 2px rgba(28,29,34,.03)' }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ font: "600 15px 'Plus Jakarta Sans'", color: 'var(--ink)', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemName}</p>
        <p style={{ font: "400 12px 'JetBrains Mono'", color: 'var(--ink3)', margin: 0 }}>
          {c.tags?.serial} · {new Date(c.opened_at).toLocaleDateString()}
        </p>
      </div>
      <span className={CHIP[c.status] ?? 'chip'}>
        <span className="chip-dot" />
        {c.status.replace('_', ' ')}
      </span>
    </Link>
  )
}

// Compact, muted row for archived cases — visually "tucked away".
function ArchivedRow({ c }: { c: RecoveryCaseWithTag }) {
  const itemName = c.tags?.items?.name ?? 'Unknown item'
  return (
    <Link
      href={`/dashboard/cases/${c.id}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--line)', textDecoration: 'none', opacity: 0.72 }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ font: "500 14px 'Plus Jakarta Sans'", color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{itemName}</span>
        <span style={{ font: "400 11px 'JetBrains Mono'", color: 'var(--ink3)', flexShrink: 0 }}>{c.tags?.serial}</span>
      </div>
      <span style={{ font: "500 11px 'Plus Jakarta Sans'", color: 'var(--ink3)', flexShrink: 0 }}>
        {new Date(c.opened_at).toLocaleDateString()}
      </span>
    </Link>
  )
}
