import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CHAT_ACCEPTED, CHAT_DECLINED } from '@/lib/chat'

// Owner accepts (or declines) a finder's chat request. The finder cannot have a
// back-and-forth until the owner accepts here — this is the consent gate.
// Body: { decision: 'accept' | 'decline' }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const { decision } = await req.json().catch(() => ({}))

  if (decision !== 'accept' && decision !== 'decline') {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  // Verify ownership
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

  const service = createServiceClient()

  // Idempotent: don't log a duplicate decision if one already exists.
  const { data: prior } = await service
    .from('case_events')
    .select('event_type')
    .eq('case_id', caseId)
    .in('event_type', [CHAT_ACCEPTED, CHAT_DECLINED])
    .limit(1)

  if (prior && prior.length > 0) {
    return NextResponse.json({ ok: true, noop: true })
  }

  // Accepting a chat moves the case into 'in_progress' (owner is engaging).
  // We record the status change *on* the chat_accepted event so the timeline can
  // attribute it ("moved to in progress because the chat was accepted") instead
  // of logging a separate, context-free status_changed entry.
  const movedToInProgress = decision === 'accept' && rc.status === 'open'

  if (movedToInProgress) {
    await service.from('recovery_cases').update({ status: 'in_progress' }).eq('id', caseId)
  }

  await service.from('case_events').insert({
    case_id: caseId,
    actor: 'owner',
    event_type: decision === 'accept' ? CHAT_ACCEPTED : CHAT_DECLINED,
    payload: movedToInProgress ? { from: 'open', to: 'in_progress' } : {},
  })

  return NextResponse.json({ ok: true })
}
