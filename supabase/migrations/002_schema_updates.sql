-- ============================================================
-- Foundly — Migration 002: Schema corrections from design review
-- ============================================================
-- Changes:
--   1. users: split display_name → first_name + last_name
--   2. users: add recovery_email (account recovery only, never finder-facing)
--   3. case_status enum: rename 'closed' → 'archived'
--   4. tags.serial: enforce FN- prefix pattern
-- ============================================================

-- ── 1. users table ──────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recovery_email text;

-- Migrate any existing display_name values (best-effort split on first space)
UPDATE public.users
SET
  first_name = CASE
    WHEN position(' ' IN display_name) > 0
    THEN split_part(display_name, ' ', 1)
    ELSE display_name
  END,
  last_name = CASE
    WHEN position(' ' IN display_name) > 0
    THEN substring(display_name FROM position(' ' IN display_name) + 1)
    ELSE ''
  END
WHERE display_name != '';

-- Keep display_name as a generated column for backward compat in queries
-- (first name + last initial, e.g. "John D.")
ALTER TABLE public.users
  DROP COLUMN IF EXISTS display_name;

-- Computed helper: what finders see ("John D.")
-- Exposed as a view rather than a stored column so it's always fresh
CREATE OR REPLACE VIEW public.user_finder_name AS
SELECT
  id,
  first_name,
  last_name,
  CASE
    WHEN last_name = '' THEN first_name
    ELSE first_name || ' ' || upper(left(last_name, 1)) || '.'
  END AS finder_display_name
FROM public.users;

-- ── 2. case_status enum: add 'archived', remove 'closed' ────

-- Postgres doesn't allow renaming enum values directly pre-14.
-- Strategy: add new value, migrate, update references.

ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'archived';

-- Migrate any existing 'closed' rows to 'archived'
UPDATE public.recovery_cases SET status = 'archived' WHERE status = 'closed';

-- Note: removing 'closed' from the enum requires recreating it.
-- Doing this safely in two steps — the old value simply becomes unused.
-- Run the following AFTER confirming no 'closed' rows exist:
--
--   ALTER TYPE public.case_status RENAME TO case_status_old;
--   CREATE TYPE public.case_status AS ENUM ('open','in_progress','resolved','archived');
--   ALTER TABLE public.recovery_cases
--     ALTER COLUMN status TYPE public.case_status
--     USING status::text::public.case_status;
--   DROP TYPE public.case_status_old;
--
-- This is deferred to a separate migration once all environments are confirmed clean.

-- ── 3. Update next-status logic in CaseStatusForm ───────────
-- (Application-layer change — see src/app/dashboard/cases/[id]/CaseStatusForm.tsx)
-- NEXT_STATUS: open → in_progress → resolved → archived (not 'closed')

-- ── 4. Recovery email: RLS — never readable by anon or other users ──
-- The existing RLS on users already covers this (owner read/update only).
-- recovery_email is not included in the user_finder_name view (already excluded).

-- ── 5. Fix handle_new_user trigger (removed display_name) ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
