'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// DEMO BANNER — only rendered when NEXT_PUBLIC_DEMO_MODE=true
// Seeds a FN-DEMO tag for the current user and links to the finder page.
//
// Includes a manual code-entry field so you can open ANY tag's finder page by
// typing its serial — the testing stand-in for scanning a physical QR/NFC tag.
//
// TO GO LIVE: Set NEXT_PUBLIC_DEMO_MODE=false (or remove the env var).
//             This component will no longer render.
// ─────────────────────────────────────────────────────────────────────────────
export default function DemoBanner({ className }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [code, setCode] = useState('')

  async function seedAndOpen() {
    setState('loading')
    const res = await fetch('/api/demo/seed', { method: 'POST' })
    if (res.ok) {
      setState('ready')
      window.open('/found/FN-DEMO', '_blank')
    } else {
      setState('error')
    }
  }

  function openManual() {
    const serial = normalizeSerial(code)
    if (!serial) return
    window.open(`/found/${encodeURIComponent(serial)}`, '_blank')
  }

  return (
    <div
      className={className}
      style={{ padding: '14px 16px', borderRadius: 14, background: '#f6ecd8', border: '1px solid rgba(192,138,46,.35)', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c08a2e" strokeWidth="1.6" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#8a5a16', margin: '0 0 1px' }}>Demo mode</p>
            <p style={{ font: "400 12px 'Plus Jakarta Sans'", color: '#a07030', margin: 0 }}>Test the full finder workflow end-to-end</p>
          </div>
        </div>
        <button
          onClick={seedAndOpen}
          disabled={state === 'loading'}
          style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none', background: '#c08a2e', color: '#fff', font: "600 13px 'Plus Jakarta Sans'", cursor: state === 'loading' ? 'wait' : 'pointer', opacity: state === 'loading' ? 0.7 : 1, whiteSpace: 'nowrap' }}
        >
          {state === 'loading' ? 'Setting up…' : state === 'ready' ? 'Opened ↗' : 'Try finder page →'}
        </button>
      </div>

      {/* Manual serial entry — stand-in for scanning a physical tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px dashed rgba(192,138,46,.3)', paddingTop: 12 }}>
        <span style={{ font: "500 12px 'Plus Jakarta Sans'", color: '#a07030', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Or enter a code
        </span>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && openManual()}
          placeholder="FN-DEMO"
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(192,138,46,.4)', background: '#fff', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8a5a16', outline: 'none' }}
        />
        <button
          onClick={openManual}
          disabled={!normalizeSerial(code)}
          style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(192,138,46,.4)', background: '#fff', color: '#8a5a16', font: "600 13px 'Plus Jakarta Sans'", cursor: normalizeSerial(code) ? 'pointer' : 'default', opacity: normalizeSerial(code) ? 1 : 0.5, whiteSpace: 'nowrap' }}
        >
          Open ↗
        </button>
      </div>
    </div>
  )
}

// Normalizes typed input into a serial: trims, uppercases, prepends FN- if missing.
// Returns '' when there is nothing usable to open.
function normalizeSerial(raw: string): string {
  const v = raw.trim().toUpperCase()
  if (!v) return ''
  if (v.startsWith('FN-')) return v
  if (v.startsWith('FN')) return 'FN-' + v.slice(2)
  return 'FN-' + v
}
