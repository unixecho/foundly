import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CHAT_ACCEPTED } from '@/lib/chat'

// Public — no auth. Finder replies are identified by caseId (UUID).
// This route is for FOLLOW-UP messages only. The finder's first message (the
// chat *request*) goes through /api/cases/submit. Until the owner accepts, the
// finder cannot keep sending — this prevents spamming the owner.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const { message } = await req.json()

  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  const service = createServiceClient()

  // Verify case exists and is still active
  const { data: rc } = await service
    .from('recovery_cases')
    .select('id, status')
    .eq('id', caseId)
    .single()

  if (!rc) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (rc.status === 'resolved' || rc.status === 'archived') {
    return NextResponse.json({ error: 'This case is already closed' }, { status: 409 })
  }

  // Gate: only allow follow-up messages once the owner has accepted the chat.
  const { data: accepted } = await service
    .from('case_events')
    .select('id')
    .eq('case_id', caseId)
    .eq('event_type', CHAT_ACCEPTED)
    .limit(1)

  if (!accepted || accepted.length === 0) {
    return NextResponse.json({ error: 'Waiting for the owner to accept the chat.' }, { status: 409 })
  }

  await service.from('case_events').insert({
    case_id: caseId,
    actor: 'finder',
    event_type: 'finder_message',
    payload: { message: message.trim() },
  })

  return NextResponse.json({ ok: true })
}
