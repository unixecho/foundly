'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LocalTime from '@/components/LocalTime'

export type ItemRowData = {
  id: string
  name: string
  createdAt: string
  tag: { serial: string; status: string } | null
  recoveries: number
  activeCases: number
}

export default function ItemRow({ item }: { item: ItemRowData }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = item.tag?.status ?? 'none'
  const chip = status === 'active'
    ? { cls: 'chip-protected', label: 'Protected' }
    : status === 'deactivated'
      ? { cls: 'chip-archived', label: 'Deactivated' }
      : { cls: 'chip-open', label: 'No tag' }

  async function save() {
    const trimmed = name.trim()
    if (trimmed === item.name) { setEditing(false); return }
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Could not rename. Try again.'); return }
    setEditing(false)
    router.refresh()
  }

  function cancel() {
    setName(item.name)
    setError(null)
    setEditing(false)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        </div>

        {/* Name + meta */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {editing ? (
            <div className="animate-reveal">
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  style={{ height: 38, flex: 1 }}
                  value={name}
                  autoFocus
                  onChange={e => { setName(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
                />
                <button onClick={save} disabled={loading || !name.trim()} className="btn-primary" style={{ height: 38, padding: '0 14px', width: 'auto' }}>
                  {loading ? '…' : 'Save'}
                </button>
                <button onClick={cancel} disabled={loading} style={{ height: 38, padding: '0 12px', border: '1px solid var(--line2)', borderRadius: 10, background: 'var(--surface)', font: "600 13px var(--ff)", color: 'var(--ink3)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
              {error && <p style={{ font: "400 12px var(--ff)", color: 'var(--error)', margin: '6px 0 0' }}>{error}</p>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <p style={{ font: "600 15px var(--ff)", margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Rename item"
                  style={{ flexShrink: 0, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'var(--ink3)', cursor: 'pointer', borderRadius: 6 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                </button>
              </div>
              <div className="flex items-center gap-2" style={{ marginTop: 3 }}>
                {item.tag ? (
                  <span style={{ font: "400 12.5px 'JetBrains Mono'", color: 'var(--ink3)' }}>{item.tag.serial}</span>
                ) : (
                  <span style={{ font: "400 12.5px var(--ff)", color: 'var(--ink3)' }}>No tag linked</span>
                )}
                <span style={{ color: 'var(--line2)' }}>·</span>
                <span style={{ font: "400 12.5px var(--ff)", color: 'var(--ink3)' }}>
                  Added <LocalTime iso={item.createdAt} mode="date" />
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right side: recovery badge + status chip */}
        {!editing && (
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            {item.recoveries > 0 && (
              <span
                title={`${item.recoveries} recovery ${item.recoveries === 1 ? 'case' : 'cases'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: item.activeCases > 0 ? 'var(--amber-soft)' : 'var(--surface2)', font: "600 11.5px var(--ff)", color: item.activeCases > 0 ? 'var(--amber-ink)' : 'var(--ink3)', border: '1px solid var(--line)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {item.recoveries}×
              </span>
            )}
            <span className={`chip ${chip.cls}`}>
              <span className="chip-dot" />
              {chip.label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
