-- ============================================================
-- Foundly — Initial Schema Migration
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS (public profile mirroring auth.users)
-- ============================================================

CREATE TABLE public.users (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  notify_email  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ITEMS
-- ============================================================

CREATE TABLE public.items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  photo_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TAGS
-- ============================================================

CREATE TYPE public.tag_status AS ENUM ('unactivated', 'active', 'deactivated');

CREATE TABLE public.tags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial           text NOT NULL UNIQUE,
  item_id          uuid REFERENCES public.items(id) ON DELETE SET NULL,
  owner_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status           public.tag_status NOT NULL DEFAULT 'unactivated',
  activation_token text UNIQUE,
  activated_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tags_serial ON public.tags(serial);

-- ============================================================
-- RECOVERY CASES
-- ============================================================

CREATE TYPE public.case_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

CREATE TABLE public.recovery_cases (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id                uuid NOT NULL REFERENCES public.tags(id),
  owner_id              uuid NOT NULL REFERENCES public.users(id),
  status                public.case_status NOT NULL DEFAULT 'open',
  finder_name           text,
  finder_email          text,
  finder_phone          text,
  finder_message        text,
  finder_location_lat   numeric(9,6),
  finder_location_lng   numeric(9,6),
  finder_location_label text,
  opened_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER recovery_cases_updated_at
  BEFORE UPDATE ON public.recovery_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-set resolved_at when status becomes 'resolved'
CREATE OR REPLACE FUNCTION public.handle_case_resolved()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recovery_cases_resolved_at
  BEFORE UPDATE ON public.recovery_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_case_resolved();

CREATE INDEX idx_recovery_cases_owner_id ON public.recovery_cases(owner_id);
CREATE INDEX idx_recovery_cases_tag_id   ON public.recovery_cases(tag_id);
CREATE INDEX idx_recovery_cases_owner_status ON public.recovery_cases(owner_id, status);

-- Only one active case per tag at a time
CREATE UNIQUE INDEX idx_one_active_case_per_tag
  ON public.recovery_cases(tag_id)
  WHERE status IN ('open', 'in_progress');

-- ============================================================
-- CASE EVENTS
-- ============================================================

CREATE TYPE public.case_actor AS ENUM ('system', 'owner', 'finder');

CREATE TABLE public.case_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES public.recovery_cases(id) ON DELETE CASCADE,
  actor      public.case_actor NOT NULL,
  event_type text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_events_case_id ON public.case_events(case_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events    ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "users: owner read/update"
  ON public.users FOR ALL
  USING (auth.uid() = id);

-- ITEMS
CREATE POLICY "items: owner full access"
  ON public.items FOR ALL
  USING (auth.uid() = owner_id);

-- TAGS: public read for active tags (finder scan page needs tag + owner info)
CREATE POLICY "tags: public read active"
  ON public.tags FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "tags: owner read all own"
  ON public.tags FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "tags: owner update own"
  ON public.tags FOR UPDATE
  USING (auth.uid() = owner_id);

-- RECOVERY CASES: anon can insert (finder submits), owner can read/update own
CREATE POLICY "recovery_cases: anon insert"
  ON public.recovery_cases FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "recovery_cases: owner read own"
  ON public.recovery_cases FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "recovery_cases: owner update own"
  ON public.recovery_cases FOR UPDATE
  USING (auth.uid() = owner_id);

-- CASE EVENTS: owner read; service role inserts via triggers/functions
CREATE POLICY "case_events: owner read own"
  ON public.case_events FOR SELECT
  USING (
    auth.uid() = (
      SELECT owner_id FROM public.recovery_cases WHERE id = case_id
    )
  );
