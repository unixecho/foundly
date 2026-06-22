import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ItemRow, { type ItemRowData } from './ItemRow'

export default async function ItemsPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('items')
    .select(`
      *,
      tags ( id, serial, status )
    `)
    .order('created_at', { ascending: false })

  // Recovery counts per tag (RLS scopes these to the owner's own cases).
  const { data: cases } = await supabase
    .from('recovery_cases')
    .select('tag_id, status')

  const counts = new Map<string, { total: number; active: number }>()
  for (const c of cases ?? []) {
    if (!c.tag_id) continue
    const entry = counts.get(c.tag_id) ?? { total: 0, active: 0 }
    entry.total += 1
    if (c.status === 'open' || c.status === 'in_progress') entry.active += 1
    counts.set(c.tag_id, entry)
  }

  const rows: ItemRowData[] = (items ?? []).map((item) => {
    const tag = (item as any).tags?.[0] ?? null
    const c = tag ? counts.get(tag.id) : undefined
    return {
      id: item.id,
      name: item.name,
      createdAt: item.created_at,
      tag: tag ? { serial: tag.serial, status: tag.status } : null,
      recoveries: c?.total ?? 0,
      activeCases: c?.active ?? 0,
    }
  })

  const protectedCount = rows.filter(r => r.tag?.status === 'active').length

  return (
    <div className="max-w-owner mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ font: "800 27px/1.18 var(--ff)", letterSpacing: '-.025em', margin: 0 }}>Items</h1>
          {rows.length > 0 && (
            <p style={{ font: "400 13px var(--ff)", color: 'var(--ink3)', margin: '4px 0 0' }}>
              {rows.length} {rows.length === 1 ? 'item' : 'items'} · {protectedCount} protected
            </p>
          )}
        </div>
        <Link
          href="/activate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 14px var(--ff)", textDecoration: 'none', boxShadow: 'var(--shadow-accent)' }}
        >
          + Activate tag
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <p style={{ font: "700 16px var(--ff)", margin: '0 0 6px' }}>No items yet</p>
          <p style={{ font: "400 14px/1.5 var(--ff)", color: 'var(--ink2)', margin: '0 0 20px' }}>
            Activate a Foundly tag to start protecting your belongings.
          </p>
          <Link href="/activate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 14px var(--ff)", textDecoration: 'none' }}>
            Activate your first tag
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <ItemRow key={row.id} item={row} />
          ))}
        </div>
      )}
    </div>
  )
}
