# ADR-001: Tech Stack

**Date:** 2026-06-19  
**Status:** Accepted

---

## Context

Foundly is a privacy-first NFC-powered lost item recovery platform. Core requirements that drive stack choices:

- Mobile-first web experience (finders scan an NFC tag on their phone — no app install)
- Server-rendered public pages for fast load on mobile networks
- OTP email auth only (no passwords, no social login)
- Row-level security: owners can only see their own data; finder submissions are write-only
- Real-time updates (owner dashboard updates when a finder submits)
- Tag activation via one-time QR code
- Minimal infrastructure to maintain as a small team

---

## Decision

**Frontend:** Next.js 14 (App Router)  
**Backend / Database:** Supabase (Postgres + Auth + Realtime + Storage)  
**Hosting:** Vercel (frontend) + Supabase Cloud (backend)  
**Language:** TypeScript throughout  
**Styling:** Tailwind CSS  
**Email:** Resend (transactional — OTP codes, recovery notifications)

---

## Rationale

### Next.js (App Router)
- Server Components handle the public finder page with zero JS by default — fast on mobile
- API Routes / Route Handlers cover webhook endpoints and server-side logic
- Built-in image optimization, metadata, and OG tags for link previews
- Vercel deployment is zero-config

### Supabase
- Postgres gives us full relational power (foreign keys, RLS policies, triggers)
- Built-in Auth with magic link / OTP email — matches our no-password requirement exactly
- Row-Level Security enforces data isolation at the DB layer, not just the API layer
- Realtime subscriptions power live dashboard updates without a separate WebSocket service
- Storage for any future photo attachments (item photos, finder-submitted photos)
- Self-hostable if we ever need to move off Supabase Cloud

### Resend
- Simple API, excellent deliverability, React Email templates
- Used for: OTP codes, "someone found your item" notifications, case update emails

### TypeScript
- End-to-end type safety from DB schema (via `supabase gen types`) through to UI components
- Catches shape mismatches early — especially important for the finder submission form which writes to a table the owner reads

---

## Consequences

**Good:**
- Very low ops burden — no servers to manage
- RLS means a bug in application code can't leak another user's data
- `supabase gen types typescript` keeps DB types in sync automatically
- Full-stack in one repo

**Trade-offs:**
- Supabase free tier has connection limits — need to use Supabase's connection pooler (Supavisor) from day one
- Vercel cold starts on infrequently-visited routes (acceptable for MVP)
- Vendor lock-in on Supabase Auth — mitigated by the fact that the auth logic is thin and isolated

---

## Rejected Alternatives

| Option | Reason rejected |
|--------|-----------------|
| Firebase | No real SQL, RLS is more complex to model, Firestore pricing unpredictable at scale |
| PlanetScale + separate auth | More moving parts, need to manage auth ourselves |
| Remix | Strong contender, but Vercel/Next.js ecosystem fit is better for this team |
| Custom Node API | More to build and maintain; Supabase covers 80% of what we'd write |

---

## Key Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never exposed to client
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=             # e.g. https://foundly.app
```
