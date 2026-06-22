# Foundly — TODO

My proposal list — ideas I want done. Once we commit to one for a session, the agreed
scope lives in `HANDOFF.md` (the execution plan). This file stays the raw wishlist.

---

## In progress / next up

> Scheduled this round (see HANDOFF.md → Session 4): items **1**, **2**, **3 (font half)**.

- [ ] **Phone validation on finder contact-share** — when a finder shares contact info,
      validate the phone number alongside the email (currently only email is properly checked).
  - Scope: valid **Israeli numbering plan only** — country code **+972**.
    - Mobile: `05X` (050/052/053/054/055/058…)
    - Landline: `02 03 04 08 09`
    - Other valid prefixes: `07X` (VoIP/managed), `077` etc.
  - Accept common input shapes and normalize: `0XX-XXXXXXX`, `+972XXXXXXXXX`, `972XXXXXXXXX`,
    with/without spaces or dashes.
  - Store canonical **E.164** (`+972…`, drop leading `0`).
  - Numbers outside the +972 plan simply don't validate (e.g. a different country code is out of scope while we're Israel-only).
  - Inline per-field error like the email check. File: `src/app/found/[serial]/FinderForm.tsx` (`validateContact()`).

## Backlog

1. [ ] **Better Hebrew font** — current Hebrew typography looks bad. Pick/ship a proper
       Hebrew webfont (e.g. Heebo / Assistant / Rubik / Noto Sans Hebrew) and wire it so
       Hebrew text uses it while Latin keeps Plus Jakarta Sans.

2. [ ] **Live case updates for the Owner (no refresh) + toast notification**
   - Owner's case views update via SSE without a manual refresh.
   - Add a tasteful notification that slides in at the top of the screen and auto-dismisses
     when a new event arrives (new finder message, etc.).

---

## Done

_(nothing yet — move items here as we finish them)_
