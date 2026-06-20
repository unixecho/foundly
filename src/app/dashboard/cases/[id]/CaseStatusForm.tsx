'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export default function CaseStatusForm({
  caseId,
  currentStatus,
}: {
  caseId: string
  currentStatus: CaseStatus
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const nextStatus = NEXT_STATUS[currentStatus]

  if (!nextStatus) return null

  async function advance() {
    setLoading(true)
    await supabase
      .from('recovery_cases')
      .update({ status: nextStatus })
      .eq('id', caseId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={advance}
      disabled={loading}
      className="bg-black text-white rounded-lg px-5 py-2.5 text-sm font-medium disabled:opacity-50"
    >
      {loading ? 'Updating…' : BUTTON_LABEL[currentStatus]}
    </button>
  )
}
