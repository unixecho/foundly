'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// Owner-facing Accept / Decline buttons for a finder's chat request.
// Each button enters a thinking state and stays disabled until the decision is
// fully registered (request + refresh), so it can't be double-fired.
export default function ChatRequest({ caseId }: { caseId: string }) {
  const [submitting, setSubmitting] = useState<null | 'accept' | 'decline'>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const busy = submitting !== null || isPending

  async function decide(decision: 'accept' | 'decline') {
    if (busy) return
    setSubmitting(decision)
    try {
      await fetch(`/api/cases/${caseId}/chat-accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
    } finally {
      startTransition(() => router.refresh())
      setSubmitting(null)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
      <style>{`@keyframes crSpin { to { transform: rotate(360deg) } }`}</style>
      <button
        onClick={() => decide('accept')}
        disabled={busy}
        aria-busy={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          flex: 1, height: 46, borderRadius: 12, border: 'none',
          background: 'var(--accent)', color: 'var(--on-accent)',
          font: "700 14px 'Plus Jakarta Sans'",
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
          boxShadow: 'var(--shadow-accent)', transition: 'opacity .15s',
        }}
      >
        {submitting === 'accept' && <Spinner />}
        {submitting === 'accept' ? 'Accepting…' : 'Accept & chat'}
      </button>
      <button
        onClick={() => decide('decline')}
        disabled={busy}
        aria-busy={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          height: 46, padding: '0 18px', borderRadius: 12,
          border: '1px solid var(--line2)', background: 'var(--surface)', color: 'var(--ink2)',
          font: "600 14px 'Plus Jakarta Sans'",
          cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, transition: 'opacity .15s',
        }}
      >
        {submitting === 'decline' ? 'Declining…' : 'Decline'}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff',
        display: 'inline-block', animation: 'crSpin .6s linear infinite',
      }}
    />
  )
}
