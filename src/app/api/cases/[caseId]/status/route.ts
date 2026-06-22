import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'archived',
}

// Advances a case's status one step and logs a `status_changed` case_event so the
// timeline (and its SSE stream) reflect the change in real time.
// The event log is what makes the move visible everywhere — the timeline streams
// case_events, so writing one here is what drives the live update.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const { to } = await req.json().catch(() => ({}))

  // Verify ownership with the user-scoped client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rc } = await supabase
    .from('recovery_cases')
    .select('id, status')
    .eq('id', caseId)
    .eq('owner_id', user.id)
    .single()

  if (!rc) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const from = rc.status
  const next = ALLOWED[from]

  // Guard against stale / duplicate clicks: only advance from the expected state.
  if (!next || (to && to !== next)) {
    return NextResponse.json({ ok: true, status: from, noop: true })
  }

  const service = createServiceClient()

  const patch: Record<string, unknown> = { status: next }
  if (next === 'resolved') patch.resolved_at = new Date().toISOString()

  const { error: updateErr } = await service
    .from('recovery_cases')
    .update(patch)
    .eq('id', caseId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Log the transition so the timeline picks it up (live, via SSE)
  await service.from('case_events').insert({
    case_id: caseId,
    actor: 'owner',
    event_type: 'status_changed',
    payload: { from, to: next },
  })

  return NextResponse.json({ ok: true, status: next })
}
