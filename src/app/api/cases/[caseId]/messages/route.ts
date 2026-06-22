import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Public endpoint — finder polls this to see owner replies.
// Auth: caseId UUID is the access token (hard to guess, acceptable for MVP).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const service = createServiceClient()

  // Includes chat control events (chat_accepted/chat_declined) so the finder can
  // derive whether the owner has accepted the chat on first load — the bubbles
  // themselves are filtered client-side.
  const { data: events } = await service
    .from('case_events')
    .select('id, actor, event_type, payload, created_at')
    .eq('case_id', caseId)
    .in('event_type', ['owner_reply', 'finder_message', 'chat_accepted', 'chat_declined'])
    .order('created_at', { ascending: true })

  return NextResponse.json({ events: events ?? [] })
}
