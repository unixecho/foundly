import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DemoBanner from '@/components/DemoBanner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('first_name')
    .eq('id', user!.id)
    .single()

  const { data: items } = await supabase
    .from('items')
    .select(`
      id, name,
      tags ( id, serial, status ),
      recovery_cases ( id, status, opened_at )
    `)
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: false })

  const hasItems = items && items.length > 0

  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  // ── EMPTY STATE ──────────────────────────────────────────────
  if (!hasItems) {
    return (
      <div className="max-w-owner mx-auto flex flex-col items-center justify-center" style={{ minHeight: '70vh', padding: '40px 0' }}>
        {demoMode && <DemoBanner className="mb-6 w-full" />}
        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>

        <h1 style={{ font: "800 28px/1.2 var(--ff)", letterSpacing: '-.025em', textAlign: 'center', margin: '0 0 12px' }}>
          Let's protect your<br />first item
        </h1>
        <p style={{ font: "400 15px/1.6 var(--ff)", color: 'var(--ink2)', textAlign: 'center', margin: '0 0 32px', maxWidth: 320 }}>
          Activate a Foundly tag and give it a nickname. If it's ever lost, a kind stranger can help return it — without ever seeing who you are.
        </p>

        <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {[
            'Tap your phone to the tag or scan it',
            'Give it a nickname like "Car Keys"',
            "That's it — it's protected, privately",
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-soft2)', color: 'var(--accent-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 13px var(--ff)", flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: 0 }}>{step}</p>
            </div>
          ))}
        </div>

        <Link
          href="/activate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 28px', borderRadius: 14, background: 'var(--accent)', color: 'var(--on-accent)', font: "700 15px var(--ff)", textDecoration: 'none', boxShadow: 'var(--shadow-accent)', marginBottom: 14 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14"/></svg>
          Activate your first tag
        </Link>

        <p style={{ font: "400 13px var(--ff)", color: 'var(--ink3)', margin: 0, textAlign: 'center' }}>
          Grab your tag and scan the QR code to get started.
        </p>
      </div>
    )
  }

  // ── POPULATED STATE ──────────────────────────────────────────
  const enriched = (items ?? []).map(item => {
    const tag = (item as any).tags?.[0]
    const cases: any[] = (item as any).recovery_cases ?? []
    const activeCase = cases.find(c => c.status === 'open' || c.status === 'in_progress')
    const resolvedCase = cases.find(c => c.status === 'resolved' || c.status === 'archived')

    let status: 'ACTIVE' | 'PROTECTED' | 'RETURNED' | 'INACTIVE' = 'INACTIVE'
    if (activeCase) status = 'ACTIVE'
    else if (resolvedCase) status = 'RETURNED'
    else if (tag?.status === 'active') status = 'PROTECTED'

    return { ...item, tag, activeCase, status }
  })

  const alertCount = enriched.filter(i => i.status === 'ACTIVE').length
  const allProtected = enriched.every(i => i.status === 'PROTECTED')

  const CHIPS = {
    ACTIVE:    { label: 'Recovery active', color: '#8a5a16', bg: '#f6ecd8', dot: '#c08a2e' },
    PROTECTED: { label: 'Protected',       color: '#2e6a4d', bg: '#e4f0e9', dot: '#3a8a64' },
    RETURNED:  { label: 'Returned',        color: 'var(--accent-ink)', bg: 'var(--accent-soft)', dot: 'var(--accent)' },
    INACTIVE:  { label: 'No tag',          color: 'var(--ink3)', bg: 'var(--surface2)', dot: 'var(--line2)' },
  }

  return (
    <div className="max-w-owner mx-auto">

      {/* Demo banner */}
      {demoMode && <DemoBanner className="mb-5" />}

      {/* Greeting */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ font: "800 26px/1.2 var(--ff)", letterSpacing: '-.025em', margin: 0 }}>
          Hi, {profile?.first_name || 'there'}
        </h1>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--accent-soft2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "700 15px var(--ff)", color: 'var(--accent-ink)' }}>
          {(profile?.first_name ?? 'U')[0].toUpperCase()}
        </div>
      </div>

      {/* Reassurance bar */}
      {allProtected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#e4f0e9', border: '1px solid rgba(58,138,100,.2)', marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a8a64" strokeWidth="1.6" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <p style={{ font: "500 13px var(--ff)", color: '#2e6a4d', margin: 0 }}>
            All {enriched.length} tag{enriched.length !== 1 ? 's' : ''} active &amp; working
          </p>
        </div>
      )}

      {/* Active case alert */}
      {alertCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: '#f6ecd8', border: '1px solid rgba(192,138,46,.3)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c08a2e" strokeWidth="1.6" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <p style={{ font: "600 13px var(--ff)", color: '#8a5a16', margin: 0 }}>
              {alertCount} item{alertCount !== 1 ? 's' : ''} {alertCount !== 1 ? 'need' : 'needs'} your attention
            </p>
          </div>
          <Link href="/dashboard/cases" style={{ font: "600 12px var(--ff)", color: '#8a5a16', textDecoration: 'none' }}>
            View →
          </Link>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ font: "700 16px var(--ff)", margin: 0 }}>Your items</h2>
        <Link
          href="/activate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 13px var(--ff)", textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Activate tag
        </Link>
      </div>

      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {enriched.map(item => {
          const chip = CHIPS[item.status]
          const isActive = item.status === 'ACTIVE'
          const href = isActive && item.activeCase
            ? `/dashboard/cases/${item.activeCase.id}`
            : `/dashboard/items`

          return (
            <Link
              key={item.id}
              href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 15px',
                borderRadius: 18, background: 'var(--surface)', textDecoration: 'none',
                border: `1px solid ${isActive ? 'rgba(192,138,46,.3)' : 'var(--line)'}`,
                boxShadow: isActive ? '0 0 0 3px rgba(192,138,46,.08)' : '0 1px 2px rgba(28,29,34,.03)',
              }}
            >
              <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ font: "600 15px var(--ff)", margin: '0 0 3px', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </p>
                <p style={{ font: "400 12px 'JetBrains Mono'", color: 'var(--ink3)', margin: 0 }}>
                  {item.tag?.serial ?? 'No tag linked'}
                  {isActive && (
                    <span style={{ fontFamily: "var(--ff)", fontWeight: 500, color: '#c08a2e', marginLeft: 8 }}>
                      · {item.activeCase?.status === 'in_progress' ? 'In progress' : 'New case'}
                    </span>
                  )}
                </p>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: chip.bg, flexShrink: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: chip.dot }} />
                <span style={{ font: "600 11.5px var(--ff)", color: chip.color, whiteSpace: 'nowrap' }}>{chip.label}</span>
              </div>
            </Link>
          )
        })}
      </div>

    </div>
  )
}
