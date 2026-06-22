'use client'

import { useState, useTransition } from 'react'
import type { CaseStatus } from '@/types/database'
import { useRouter } from 'next/navigation'

const NEXT_STATUS: Record<CaseStatus, CaseStatus | null> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'archived',
  archived: null,
}

const BUTTON_LABEL: Record<CaseStatus, string> = {
  open: 'Mark in progress',
  in_progress: 'Mark resolved',
  resolved: 'Archive case',
  archived: '',
}

const PENDING_LABEL: Record<CaseStatus, string> = {
  open: 'Marking in progress…',
  in_progress: 'Marking resolved…',
  resolved: 'Archiving…',
  archived: '',
}

export default function CaseStatusForm({
  caseId,
  currentStatus,
}: {
  caseId: string
  currentStatus: CaseStatus
}) {
  // `submitting` covers the network round-trip; `isPending` covers the refresh
  // re-render. The button stays in its thinking state until BOTH finish, so the
  // new status is fully registered before it can be clicked again.
  const [submitting, setSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [archiving, setArchiving] = useState(false)
  const router = useRouter()
  const nextStatus = NEXT_STATUS[currentStatus]

  if (!nextStatus) return null

  const isArchiveAction = nextStatus === 'archived'
  const busy = submitting || isPending || archiving

  async function advance() {
    if (busy) return

    // ── ARCHIVE — play the "archive away" animation, then go to dashboard ──────
    if (isArchiveAction) {
      setArchiving(true)
      try {
        await fetch(`/api/cases/${caseId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: 'archived' }),
        })
      } catch { /* still navigate — the overlay shouldn't trap the user */ }
      // Let the animation breathe, then leave for the dashboard. We do NOT clear
      // `archiving`, so the overlay stays up through navigation (no flash back).
      setTimeout(() => router.push('/dashboard'), 1150)
      return
    }

    // ── NORMAL ADVANCE ────────────────────────────────────────────────────────
    setSubmitting(true)
    try {
      await fetch(`/api/cases/${caseId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: nextStatus }),
      })
    } finally {
      startTransition(() => router.refresh())
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={advance}
        disabled={busy}
        aria-busy={busy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 12, border: 'none',
          background: 'var(--ink)', color: 'var(--paper)',
          font: "600 14px 'Plus Jakarta Sans'",
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.65 : 1,
          transition: 'opacity .15s',
        }}
      >
        {busy && (
          <span
            aria-hidden
            style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,.35)',
              borderTopColor: '#fff',
              display: 'inline-block',
              animation: 'csfSpin .6s linear infinite',
            }}
          />
        )}
        <style>{`@keyframes csfSpin { to { transform: rotate(360deg) } }`}</style>
        {busy ? PENDING_LABEL[currentStatus] : BUTTON_LABEL[currentStatus]}
      </button>

      {archiving && <ArchiveOverlay />}
    </>
  )
}

// Full-screen "archive away" animation: the case card drops into an archive box,
// the lid closes, a check confirms, then the page navigates to the dashboard.
function ArchiveOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'var(--paper)',
        animation: 'aoFade .25s ease both',
      }}
    >
      <style>{`
        @keyframes aoFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes aoDrop {
          0%   { transform: translateY(-46px) scale(1); opacity: 0 }
          35%  { opacity: 1 }
          70%  { transform: translateY(6px) scale(.86); opacity: 1 }
          100% { transform: translateY(14px) scale(.7); opacity: 0 }
        }
        @keyframes aoLid {
          0%, 45% { transform: translateY(-3px) rotate(0deg) }
          70%     { transform: translateY(-7px) rotate(-7deg) }
          100%    { transform: translateY(0) rotate(0deg) }
        }
        @keyframes aoBoxPop {
          0%   { transform: scale(.9); opacity: 0 }
          100% { transform: scale(1); opacity: 1 }
        }
        @keyframes aoCheck {
          0%, 55% { transform: scale(0); opacity: 0 }
          75%     { transform: scale(1.15); opacity: 1 }
          100%    { transform: scale(1); opacity: 1 }
        }
        @keyframes aoTextIn {
          from { opacity: 0; transform: translateY(6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      {/* Scene */}
      <div style={{ position: 'relative', width: 140, height: 130, marginBottom: 26 }}>
        {/* Falling case card */}
        <div style={{ position: 'absolute', left: '50%', top: 8, width: 64, height: 46, marginLeft: -32, borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--line)', boxShadow: '0 6px 16px rgba(28,29,34,.12)', animation: 'aoDrop 1s cubic-bezier(.5,.05,.5,1) both' }}>
          <div style={{ height: 6, margin: '9px 10px 0', borderRadius: 3, background: 'var(--line2)' }} />
          <div style={{ height: 6, margin: '7px 10px 0', width: 28, borderRadius: 3, background: 'var(--line2)' }} />
        </div>

        {/* Archive box */}
        <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 110, height: 78, marginLeft: -55, animation: 'aoBoxPop .3s ease both' }}>
          {/* Box body */}
          <div style={{ position: 'absolute', bottom: 0, width: '100%', height: 60, borderRadius: '4px 4px 12px 12px', background: 'var(--accent-soft)', border: '1.5px solid var(--accent-soft2)' }} />
          {/* Slot */}
          <div style={{ position: 'absolute', bottom: 28, left: '50%', width: 34, height: 5, marginLeft: -17, borderRadius: 3, background: 'var(--accent-soft2)' }} />
          {/* Lid */}
          <div style={{ position: 'absolute', top: 6, left: -4, width: 'calc(100% + 8px)', height: 22, borderRadius: 6, background: 'var(--accent)', transformOrigin: 'center bottom', animation: 'aoLid 1s cubic-bezier(.5,.05,.5,1) both' }} />
        </div>

        {/* Confirm check */}
        <div style={{ position: 'absolute', right: 2, bottom: 4, width: 34, height: 34, borderRadius: '50%', background: '#3a8a64', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(58,138,100,.4)', animation: 'aoCheck 1.1s cubic-bezier(.22,.61,.36,1) both' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      </div>

      <p style={{ font: "800 19px 'Plus Jakarta Sans'", color: 'var(--ink)', margin: '0 0 6px', animation: 'aoTextIn .4s .55s ease both' }}>
        Case archived
      </p>
      <p style={{ font: "400 13.5px 'Plus Jakarta Sans'", color: 'var(--ink3)', margin: 0, animation: 'aoTextIn .4s .7s ease both' }}>
        Packing it away — back to your dashboard…
      </p>
    </div>
  )
}
