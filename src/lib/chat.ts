// Chat handshake state — derived entirely from case_events so no schema change
// is needed. The finder's first message is a *request*; the owner must accept
// before a back-and-forth can happen.
//
//   none      — finder has not sent anything yet
//   pending   — finder requested a chat (≥1 finder_message), owner hasn't decided
//   active    — owner accepted; both sides can message freely
//   declined  — owner declined the chat request

export type ChatState = 'none' | 'pending' | 'active' | 'declined'

export const CHAT_ACCEPTED = 'chat_accepted'
export const CHAT_DECLINED = 'chat_declined'

type EventLike = { event_type: string }

export function deriveChatState(
  events: EventLike[],
  finderMessageFallback?: string | null
): ChatState {
  let accepted = false
  let declined = false
  let requested = !!finderMessageFallback
  for (const e of events) {
    if (e.event_type === CHAT_ACCEPTED) accepted = true
    else if (e.event_type === CHAT_DECLINED) declined = true
    else if (e.event_type === 'finder_message') requested = true
  }
  if (accepted) return 'active'
  if (declined) return 'declined'
  if (requested) return 'pending'
  return 'none'
}
