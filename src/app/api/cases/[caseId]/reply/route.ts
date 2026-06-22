import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const { message } = await req.json()

  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // Verify ownership
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rc } = await supabase
    .from('recovery_cases')
    .select('id')
    .eq('id', caseId)
    .eq('owner_id', user.id)
    .single()

  if (!rc) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  // Store reply via service role (case_events has no owner INSERT policy)
  const service = createServiceClient()
  await service.from('case_events').insert({
    case_id: caseId,
    actor: 'owner',
    event_type: 'owner_reply',
    payload: { message: message.trim() },
  })

  return NextResponse.json({ ok: true })
}
