# Foundly Database Schema

## Overview

```
users ──< items ──< tags
                      │
                      └──< recovery_cases ──< case_events
```

---

## Tables

### `users`
Managed by Supabase Auth (`auth.users`). We maintain a public profile table that mirrors the auth user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | References `auth.users.id` |
| `display_name` | `text` | Shown to finders as "John D." (first name + last initial) |
| `email` | `text` | Copied from auth; used for notifications |
| `notify_email` | `boolean` | Default true — opt out of email notifications |
| `created_at` | `timestamptz` | Default `now()` |

**RLS:** Users can only read/update their own row.

---

### `items`
Represents a physical object the user wants to protect (e.g. "My Backpack").

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `owner_id` | `uuid` FK → `users.id` | |
| `name` | `text` | e.g. "Blue Backpack" |
| `description` | `text` nullable | Optional private note for owner |
| `photo_url` | `text` nullable | Supabase Storage URL |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**RLS:** Owner can CRUD. No public read.

---

### `tags`
A physical NFC tag. One tag belongs to one item. A tag goes through a lifecycle: `unactivated → active → deactivated`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `serial` | `text` UNIQUE | Printed on the tag / encoded in NFC payload. URL-safe. |
| `item_id` | `uuid` FK → `items.id` nullable | Null until activated |
| `owner_id` | `uuid` FK → `users.id` nullable | Denormalized for RLS simplicity |
| `status` | `text` | `'unactivated' \| 'active' \| 'deactivated'` |
| `activation_token` | `text` UNIQUE nullable | One-time token on QR code. Cleared after use. |
| `activated_at` | `timestamptz` nullable | |
| `created_at` | `timestamptz` | |

**RLS:**
- Public: can read `serial`, `status`, `item_id`, `owner_id` for active tags (needed for finder scan page)
- Owner: can read all columns for their own tags; can update `status` to `deactivated`
- Service role only: can set `activation_token`, update `item_id` on activation

---

### `recovery_cases`
Created when a finder submits a report for an active tag.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `tag_id` | `uuid` FK → `tags.id` | |
| `owner_id` | `uuid` FK → `users.id` | Denormalized from tag |
| `status` | `text` | `'open' \| 'in_progress' \| 'resolved' \| 'closed'` |
| `finder_name` | `text` nullable | Voluntarily provided by finder |
| `finder_email` | `text` nullable | Voluntarily provided by finder |
| `finder_phone` | `text` nullable` | Voluntarily provided by finder |
| `finder_message` | `text` nullable | Free text from finder |
| `finder_location_lat` | `numeric(9,6)` nullable | Voluntarily provided |
| `finder_location_lng` | `numeric(9,6)` nullable | Voluntarily provided |
| `finder_location_label` | `text` nullable | Human-readable location (reverse geocoded) |
| `opened_at` | `timestamptz` | Default `now()` |
| `resolved_at` | `timestamptz` nullable | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**RLS:**
- Public (anon): INSERT only — finder can submit, never read
- Owner: full read on their own cases; can update `status`
- No finder read-back (privacy: finder can't look up their own submission)

---

### `case_events`
Immutable audit log of actions on a recovery case.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `case_id` | `uuid` FK → `recovery_cases.id` | |
| `actor` | `text` | `'system' \| 'owner' \| 'finder'` |
| `event_type` | `text` | See event types below |
| `payload` | `jsonb` nullable | Event-specific data |
| `created_at` | `timestamptz` | Default `now()` |

**Event types:**
- `case_opened` — finder submitted a report
- `status_changed` — owner changed case status (payload: `{from, to}`)
- `owner_notified` — email sent to owner
- `note_added` — owner added a private note (payload: `{note}`)

**RLS:** Owner can read their own case events. Append-only (no UPDATE/DELETE).

---

## Indexes

```sql
-- Fast tag lookup by serial (NFC scan)
CREATE INDEX idx_tags_serial ON tags(serial);

-- Fast case lookup by owner
CREATE INDEX idx_recovery_cases_owner_id ON recovery_cases(owner_id);

-- Fast case lookup by tag
CREATE INDEX idx_recovery_cases_tag_id ON recovery_cases(tag_id);

-- Open cases for owner dashboard
CREATE INDEX idx_recovery_cases_owner_status ON recovery_cases(owner_id, status);

-- Case events by case
CREATE INDEX idx_case_events_case_id ON case_events(case_id);
```

---

## Key Constraints

- A tag can only have one `open` or `in_progress` case at a time (enforced via partial unique index or application logic)
- `activation_token` is cleared (set to NULL) immediately after use
- `finder_email` and `finder_phone` are never exposed to public reads — only to the authenticated owner

---

## Generated Types

After running migrations, regenerate TypeScript types with:

```bash
npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
```
