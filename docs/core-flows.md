# Foundly — Core User Flows

---

## Flow 1: Tag Activation

**Actor:** Owner (new user scanning a freshly unboxed tag)

```
Physical tag has a QR code printed on it:
  https://foundly.app/activate/<activation_token>

1. Owner scans QR with phone camera
2. Browser opens /activate/[token]
   → Server reads tag by activation_token WHERE status = 'unactivated'
   → If invalid/used → show error page
   → If valid → render ActivatePage

3. Owner sees: "What is this tag for?"
   → Types item name (e.g. "Blue Backpack")

4. ActivateForm checks if user is logged in
   → Not logged in → store token in sessionStorage → redirect to /login?next=/activate/[token]
   → Already logged in → continue

5. POST /api/tags/activate
   → Creates item row
   → Updates tag: status='active', item_id, owner_id, activation_token=NULL
   
6. Redirect to /dashboard?activated=1
   → Dashboard shows success banner
```

**Key constraint:** `activation_token` is consumed (set to NULL) in a single atomic update. Re-use of the token returns 409.

---

## Flow 2: Finder Scan (NFC)

**Actor:** Stranger who finds a lost item

```
NFC tag encodes URL:
  https://foundly.app/found/<serial>

1. Finder taps tag with phone
2. Browser opens /found/[serial]
   → Server fetches tag WHERE serial = ? AND status = 'active'
   → If not found / inactive → 404

3. Finder sees:
   "You found Blue Backpack — this belongs to John D."
   + Optional fields: name, email, phone, message
   + "Share my location" button (geolocation API)

4. Finder clicks "Notify owner"
   → INSERT into recovery_cases (tag_id, owner_id, finder_*)
   → Unique partial index prevents duplicate open cases per tag
   
5. On success → "Thanks! Owner has been notified."

6. Supabase webhook fires → POST /api/cases/notify
   → Sends email to owner
   → Logs case_event: 'owner_notified'
```

**Privacy notes:**
- Finder sees only: owner's first name + last initial, item name
- Finder cannot read their own submission back (anon INSERT only)
- Owner's email/phone never shown to finder

---

## Flow 3: Owner Dashboard — Managing a Case

**Actor:** Owner who received the "someone found your item" email

```
1. Owner clicks email link → /dashboard/cases/[id]
   → Middleware checks auth → redirect to /login if not authed
   → After login, middleware redirects back to original URL

2. CaseDetailPage shows:
   - Item name + tag serial
   - Finder info: name, email, phone, message, location
   - Current status badge
   - Timeline of events
   - Action button to advance status

3. Owner advances status:
   open → in_progress   ("Mark in progress")
   in_progress → resolved ("Mark resolved")
   resolved → closed    ("Close case")

4. Status update → Supabase UPDATE on recovery_cases
   → resolved_at auto-set by DB trigger
   → router.refresh() updates the page

5. Dashboard home shows open case count
   → Goes to 0 once all cases resolved/closed
```

---

## Route Map

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | Public | Landing page |
| `/login` | Public | OTP email auth |
| `/activate/[token]` | Public (login prompted) | Tag activation |
| `/found/[serial]` | Public (anon) | Finder scan page |
| `/dashboard` | Auth required | Overview stats |
| `/dashboard/cases` | Auth required | Case list |
| `/dashboard/cases/[id]` | Auth required | Case detail |
| `/dashboard/items` | Auth required | Item management |
| `/dashboard/tags` | Auth required | Tag management |
| `/dashboard/settings` | Auth required | Account settings |
| `/api/tags/activate` | Auth required | Activation API |
| `/api/cases/notify` | Webhook secret | Email notification |

---

## What's Not Built Yet (Next Up)

- `/dashboard/items` — CRUD for items (list, add, edit, delete)
- `/dashboard/tags` — list owner's tags, deactivate, reassign to item
- `/dashboard/settings` — update display_name, notification prefs
- Supabase webhook setup for case notifications
- Email template (currently inline HTML in route handler)
- NFC payload encoding (needs to be `https://foundly.app/found/<serial>`)
- Admin tooling to provision tags (insert rows with serial + activation_token)
