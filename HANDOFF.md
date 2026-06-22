# Foundly — Session Handoff
_Last updated: 2026-06-20_

---

## What this is

Privacy-first NFC lost item recovery platform. Owners tag belongings, finders scan NFC → anonymous recovery flow through a dashboard. Owner's contact info is never exposed to the finder. Foundly is the communication bridge.

**Code:** `C:\Users\Johnathan\Claude\Projects\Foundly`
**Stack:** Next.js 15 App Router · Supabase (Postgres + Auth) · Resend · Vercel

---

## What was built across sessions 1 & 2

### Session 1 (full summary in prior handoff)
- Supabase + Resend + Vercel wired up, env vars configured
- DB migrations 001 (schema) + 002 (case status enum) + 003 (recovery email verification columns)
- Auth: 8-digit OTP via Gmail SMTP, PKCE callback route, logout, email validation
- Dashboard: empty state + populated items list with colored status chips, greeting, alert banner
- Recovery email: send verification link → confirm via token → verified badge. Blocks using primary email.
- Demo mode: `NEXT_PUBLIC_DEMO_MODE=true` seeds `FN-DEMO` tag + item, banner on dashboard opens finder page
- Finder page: redesigned multi-step flow — intro → 3 options (location / message / contact) → success
- Chat system: finder sends message → case created → owner notified by email → finder waits for reply → owner replies from dashboard → finder sees reply

### Session 2 (this session)

#### Nav badge
`src/app/dashboard/layout.tsx` — server component now fetches `open + in_progress` case count and renders an amber badge on the "Cases" nav link. Auto-updates on every page load.

#### Bidirectional chat (finder can reply back)
- `src/app/api/cases/[caseId]/finder-reply/route.ts` — new public POST route. Verifies case is not resolved/archived, inserts `case_event` with `actor='finder'`, `event_type='finder_message'`.
- `src/app/api/cases/[caseId]/messages/route.ts` — updated to return both `owner_reply` AND `finder_message` events (was owner-only before).
- `FinderForm.tsx` — waiting room now has a reply textarea + Send button. Enter sends, Shift+Enter newlines.

#### SSE real-time (replaces polling on both sides)
- `src/app/api/cases/[caseId]/stream/route.ts` — new SSE endpoint. Server polls DB every 2 s using `created_at` as cursor (passed via `?since=` query param). Pushes new chat events as `data: {...}\n\n`. Heartbeat every 25 s. Cleans up on disconnect.
- **FinderForm.tsx** — replaced `setInterval` polling with `EventSource`. Initial messages fetched once on mount, then SSE takes over. Deduplicates by event ID.
- **MessageThread.tsx** (new) — client component used in the owner's case detail page. Renders server-fetched initial events immediately (zero flicker), then opens `EventSource` and appends new events as they arrive. Includes the owner reply input inline. Owner no longer needs to refresh to see finder's second message.
- **`/dashboard/cases/[id]/page.tsx`** — replaced static messages section + `OwnerReply.tsx` with `<MessageThread initialEvents={chatEvents} />`. `OwnerReply.tsx` is now unused (can be deleted).

#### Finder page animation polish
All defined in `STYLES` constant at the top of `FinderForm.tsx` (injected once per mount, not on every re-render):
- `slideUp` — every screen transition (opacity + translateY)
- `bubblePop` — new chat bubbles pop in (scale + fade)
- `dotBounce` — waiting indicator dots actually animate now (staggered bounce, was static before)
- `successPop` — success checkmark springs in with overshoot
- Options cards stagger in with 60 ms delay per card

---

### Session 3 (this session)

#### Manual code entry for testing (stand-in for QR/NFC scan)
`src/components/DemoBanner.tsx` — added an "Or enter a code" input. Type any serial (auto-prepends `FN-`) → opens `/found/<serial>` in a new tab. Lets you run the finder workflow for any active tag without scanning. Demo-mode only.

#### Status changes now logged + thinking mode (no spam)
- `src/app/api/cases/[caseId]/status/route.ts` — **NEW**. Verifies ownership, advances status one allowed step (`open→in_progress→resolved→archived`), sets `resolved_at`, and **inserts a `status_changed` case_event** (`payload {from,to}`). Guards stale/duplicate clicks (only advances from the expected state).
- `CaseStatusForm.tsx` — rewritten. No longer does a direct Supabase update (that never logged an event!). Now POSTs to the status route, then `useTransition` + `router.refresh()`. Button shows a spinner + "Marking…/Archiving…" and stays **disabled until both the request AND the refresh re-render finish** — can't be spammed.

#### Real-time timeline
- `stream/route.ts` — broadened: streams **all** event types now, not just chat. Chat events still sent as `type:'message'` (back-compat); everything else as `type:'event'`.
- `Timeline.tsx` — **NEW** client component. Hydrates from server events, subscribes to SSE, appends new non-chat events live (status changes, notes…) with a pop animation. Replaced the static inline `<ol>` timeline in `cases/[id]/page.tsx`.

#### Archived chat close animation + dashboard tidy
- `MessageThread.tsx` — takes `caseStatus`. When `archived`: closes the SSE stream and renders a folded-away "Conversation archived · N messages · read-only" card (fold-in animation) with a View/Hide toggle for the read-only transcript. Reply box hidden.
- `cases/page.tsx` — restyled to the design system, split into **Active / Resolved / Archived**. Archived rows are compact + muted ("packed away") at the bottom.

#### Hydration fix (timestamps)
`src/components/LocalTime.tsx` — **NEW**. Renders locale-formatted timestamps client-side only (empty on server + first render → matches, fills in after mount). Fixes a hydration mismatch caused by `toLocaleString()` differing between server TZ/locale and the browser. Used in `Timeline.tsx` and `MessageThread.tsx` (Bubble). Note: client components that are SSR'd must not format dates with locale/TZ during render.

#### Finder hub flow + chat accept handshake + location map
- **Chat consent model (no DB migration — derived from `case_events`):** `src/lib/chat.ts` — `deriveChatState(events, fallback)` → `none | pending | active | declined`. New event types `chat_accepted` / `chat_declined`. The finder's **first** message is a *request*; the owner must accept before a back-and-forth.
- `src/app/api/cases/[caseId]/chat-accept/route.ts` — **NEW**. Owner-auth Accept/Decline; logs the event; accepting also moves `open → in_progress` (+ status_changed event). Idempotent.
- `finder-reply/route.ts` — now **gated**: follow-up finder messages 409 until a `chat_accepted` event exists. The first message still goes via `/api/cases/submit`. This is the anti-spam gate.
- `messages/route.ts` — also returns `chat_accepted`/`chat_declined` so the finder can derive acceptance on first load.
- **`/api/cases/submit` is now idempotent**: one active case per tag. First call creates + emails owner **once**; later calls merge fields / log messages into the same case and **never re-notify**. (Owner is no longer spammed when the finder shares location, then contact, then a message.)
- `FinderForm.tsx` — **rebuilt around a hub**. intro → **hub** → (location / chat / contact), each returning to the hub (no dead-ends — after sharing location you can still chat or add contact). Hub shows a ✓ checklist + chat status chip. Chat: compose first message (= request) → **chatroom** showing "waiting for {owner} to accept…" then live two-way once accepted (reply box appears via SSE `chat_accepted`). Declined → polite banner, no reply box.
- `ChatRequest.tsx` — **NEW** owner Accept/Decline buttons with thinking state (disabled until request + refresh complete).
- `cases/[id]/page.tsx` — chat section now branches on `deriveChatState`: pending → "The finder wants to chat" prompt + message preview + `<ChatRequest>`; active → `<MessageThread>`; declined → note. Live thread is gated on acceptance.
- `LocationMap.tsx` — **NEW**. OpenStreetMap embed (no API key) + "Open in maps" link. Shown on the finder side after capturing location and on the owner case page ("Where it was found").

#### Flow QA refinements
- **Manual location:** `FinderForm.tsx` location screen now offers GPS *or* a typed address/landmark (`finder_location_label`). Captured-GPS view has "This spot looks wrong — enter an address instead". `/api/cases/submit` accepts `locationLabel` (create + merge). Owner page shows the map for coords, label text otherwise.
- **Contact validation:** `validateContact()` in `FinderForm.tsx` — email regex, phone must be digits-only (+ separators, 7–15 digits, rejects letters), name ≥2 chars, ≥1 method required. Per-field inline errors (`<FieldError>`), cleared on edit.
- **Archive away:** `CaseStatusForm.tsx` — the Archive action now plays a full-screen `ArchiveOverlay` (card drops into a closing archive box → check → "Case archived") then `router.push('/dashboard')`. Other transitions still use the in-place thinking-mode + refresh.
- **Accept → in progress (attributed):** `chat-accept` now records the status move *on* the `chat_accepted` event payload (`{from,to}`) instead of a separate status_changed row; `Timeline.tsx` renders "Chat accepted — case moved to in progress" (and "Chat declined by owner").

> **Note:** pre-existing `tsc --noEmit` errors exist in `auth/callback/route.ts`, `lib/supabase/server.ts`, `middleware.ts`, `types/database.ts` (cookies API typing + `display_name`). Unrelated to session 3 changes; not introduced here.

---

## Current file map (things touched in session 2)

```
src/
  app/
    dashboard/
      layout.tsx                          ← nav badge
      cases/
        [id]/
          page.tsx                        ← uses MessageThread, removed OwnerReply
          MessageThread.tsx               ← NEW: live SSE client component
          OwnerReply.tsx                  ← UNUSED (superseded by MessageThread)
    api/
      cases/
        [caseId]/
          stream/route.ts                 ← NEW: SSE endpoint
          finder-reply/route.ts           ← NEW: finder back-reply
          messages/route.ts               ← updated: includes finder_message events
    found/
      [serial]/
        FinderForm.tsx                    ← SSE, bidirectional chat, animation polish
```

---

## Pending / not yet built

| Area | Notes |
|---|---|
| **Resend domain** | Free tier → can only send to nikolsburgj@gmail.com. Buy/verify domain to unblock all notification emails. |
| **Profile editing** | Name + email deferred. Email change needs its own verification flow. |
| **RTL pass** | Hebrew is primary locale. No mirror pass done — all layouts are LTR. |
| `/dashboard/items` | Basic CRUD exists, needs polish. |
| `/dashboard/tags` | Tag list, deactivate, reassign — not built. |
| **Settings** | Notification toggle + profile edit pending. Recovery email section is done. |
| **Account deletion** | UI stub ("coming soon"). No backend. |
| **Admin tag provisioning** | No tool to insert serial + activation_token for physical tags yet. |
| **Supabase webhook** | `/api/cases/notify` exists but webhook not configured. Direct Resend call in submit route covers it for now. |

---

## Known gotchas for next session

- **`OwnerReply.tsx`** can be deleted — it's dead code since `MessageThread` has the reply input built in.
- **SSE and Vercel** — Vercel's default function timeout is 10 s (Hobby) or 15 s (Pro). The SSE stream will be cut at that limit. For production, either upgrade plan or switch to Supabase Realtime (browser-side subscription). The current SSE works fine locally and for demo.
- **Demo + auth** — when the authenticated owner scans `FN-DEMO` themselves, they are both owner and finder. RLS blocks the case INSERT for authenticated users → service role in `/api/cases/submit` handles this correctly.
- **Resend 403** — `{ statusCode: 403, name: 'validation_error' }` means trying to send to a non-registered email on the free tier. Not a bug.
- **`createServiceClient()`** is the RLS bypass — any public-facing write that would fail RLS goes through this. Never expose service role key client-side.
- **Case status enum** — `open → in_progress → resolved → archived`. NOT "closed". New Postgres enum values require a separate committed query before use (error 55P04).

---

## Environment variables

In `.env.local` (never committed):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_ID
SUPABASE_WEBHOOK_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL          # "Foundly <onboarding@resend.dev>" until domain verified
NEXT_PUBLIC_APP_URL        # http://localhost:3000 locally, Vercel URL in prod
NEXT_PUBLIC_DEMO_MODE      # "true" locally, "false" in prod
```

---

## How to run locally

```bash
cd "C:\Users\Johnathan\Claude\Projects\Foundly"
npm run dev
```

Open `http://localhost:3000`. Log in with nikolsburgj@gmail.com → check email for 8-digit OTP.

To test the full demo flow: Dashboard → click "Try the demo" banner → new tab opens the finder page for FN-DEMO → go through intro → Send a message → switch to dashboard → open Cases → reply → finder tab updates in real time.
