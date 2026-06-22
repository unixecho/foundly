import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// SSE endpoint — streams new case events (chat AND timeline) in real time.
// Server polls every 2 s using `since` (ISO timestamp) as cursor.
// Each consumer filters by event_type: MessageThread/FinderForm keep the chat
// events, Timeline keeps the rest. No auth: caseId UUID is the access token.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await params
  const url = new URL(req.url)
  const since = url.searchParams.get('since') ?? new Date(0).toISOString()

  const encoder = new TextEncoder()
  let closed = false
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // One service client, reused across polls
      const service = createServiceClient()
      let cursor = since

      const tick = async () => {
        if (closed) return
        try {
          const { data: events } = await service
            .from('case_events')
            .select('id, actor, event_type, payload, created_at')
            .eq('case_id', caseId)
            .gt('created_at', cursor)
            .order('created_at', { ascending: true })

          if (events?.length) {
            cursor = events[events.length - 1].created_at
            for (const e of events) {
              const isChat = e.event_type === 'owner_reply' || e.event_type === 'finder_message'
              // `message` kept for back-compat with chat consumers; `event` carries all types.
              send({ type: isChat ? 'message' : 'event', event: e })
            }
          }
        } catch {
          // DB error — silently skip, will retry next tick
        }
      }

      // Send initial ping so client knows the connection is live
      send({ type: 'connected' })

      const pollTimer = setInterval(tick, 2000)
      const hbTimer = setInterval(() => {
        if (closed) return
        try { controller.enqueue(encoder.encode(': heartbeat\n\n')) } catch { closed = true }
      }, 25000)

      cleanup = () => {
        closed = true
        clearInterval(pollTimer)
        clearInterval(hbTimer)
      }
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
