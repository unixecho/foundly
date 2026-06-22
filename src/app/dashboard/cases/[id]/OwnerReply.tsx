'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OwnerReply({ caseId }: { caseId: string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const canSend = text.trim().length > 0

  async function send() {
    if (!canSend) return
    setLoading(true)
    await fetch(`/api/cases/${caseId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    })
    setText('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
      <textarea
        placeholder="Reply to finder…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line2)', background: 'var(--surface)', font: "400 14px var(--ff)", color: 'var(--ink)', resize: 'none', outline: 'none', lineHeight: 1.5 }}
      />
      <button
        onClick={send}
        disabled={!canSend || loading}
        style={{ height: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: canSend ? 'var(--accent)' : 'var(--line2)', color: canSend ? 'var(--on-accent)' : 'var(--ink3)', font: "600 13px var(--ff)", cursor: canSend ? 'pointer' : 'default', flexShrink: 0, transition: 'all .15s', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? '…' : 'Send'}
      </button>
    </div>
  )
}
