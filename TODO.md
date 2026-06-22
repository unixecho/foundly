# Foundly — TODO

My proposal list — ideas I want done. Once we commit to one for a session, the agreed
scope lives in `HANDOFF.md` (the execution plan). This file stays the raw wishlist.

---

## In progress / next up

> Scheduled this round (see HANDOFF.md → Session 4).

- [ ] **Live case updates for the Owner (no refresh) + toast notification**
   - Owner's case views update via SSE without a manual refresh.
   - Add a tasteful notification that slides in at the top of the screen and auto-dismisses
     when a new event arrives (new finder message, etc.).
   - Note: depends on the SSE Vercel-timeout decision (Supabase Realtime vs plan upgrade).

---

## Done

- [x] **Phone validation on finder contact-share** — Israeli (+972) numbering plan,
      normalized to E.164, inline error. _(commit 2879430)_
- [x] **Hebrew font** — grew into full trilingual i18n (he/en/ar). Phase 1 (fonts) shipped:
      Hebrew→Heebo, Arabic→Noto Sans Arabic, verified in-browser. Remaining i18n phases
      tracked in HANDOFF.md → Session 4. _(commit 7945746)_
