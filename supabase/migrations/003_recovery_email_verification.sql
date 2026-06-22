-- ============================================================
-- Foundly — Migration 003: Recovery email verification
-- ============================================================
-- Adds verification state to the recovery/emergency email so
-- owners must prove they own the backup address before it's
-- stored as trusted. A one-time token is emailed; clicking it
-- flips verified = true and nulls the token.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS recovery_email_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recovery_email_token     text,
  ADD COLUMN IF NOT EXISTS recovery_email_token_exp timestamptz;

-- Index for fast token lookups on the verify page
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_recovery_token
  ON public.users (recovery_email_token)
  WHERE recovery_email_token IS NOT NULL;
