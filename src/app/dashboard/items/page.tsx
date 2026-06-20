import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ItemsPage() {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('items')
    .select(`
      *,
      tags ( id, serial, status )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-owner mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ font: "800 27px/1.18 'Plus Jakarta Sans'", letterSpacing: '-.025em', margin: 0 }}>Items</h1>
        <Link
          href="/activate"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 14px 'Plus Jakarta Sans'", textDecoration: 'none', boxShadow: 'var(--shadow-accent)' }}
        >
          + Activate tag
        </Link>
      </div>

      {(!items || items.length === 0) ? (
        <div className="card p-8 text-center">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          </div>
          <p style={{ font: "700 16px 'Plus Jakarta Sans'", margin: '0 0 6px' }}>No items yet</p>
          <p style={{ font: "400 14px/1.5 'Plus Jakarta Sans'", color: 'var(--ink2)', margin: '0 0 20px' }}>
            Activate a Foundly tag to start protecting your belongings.
          </p>
          <Link href="/activate" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'var(--accent)', color: 'var(--on-accent)', font: "600 14px 'Plus Jakarta Sans'", textDecoration: 'none' }}>
            Activate your first tag
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const tag = (item as any).tags?.[0]
            const tagStatus = tag?.status ?? 'none'
            return (
              <div key={item.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p style={{ font: "600 15px 'Plus Jakarta Sans'", margin: '0 0 3px' }}>{item.name}</p>
                  {tag ? (
                    <p style={{ font: "400 13px 'JetBrains Mono'", color: 'var(--ink3)', margin: 0 }}>{tag.serial}</p>
                  ) : (
                    <p style={{ font: "400 13px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: 0 }}>No tag linked</p>
                  )}
                </div>
                <span className={`chip chip-${tagStatus === 'active' ? 'protected' : tagStatus === 'deactivated' ? 'archived' : 'open'}`}>
                  <span className="chip-dot" />
                  {tagStatus === 'active' ? 'Protected' : tagStatus === 'deactivated' ? 'Deactivated' : 'No tag'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
