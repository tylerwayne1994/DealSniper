-- Migration: Persist Deal Builder sessions and chat messages
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.deal_builder_sessions (
  session_id TEXT PRIMARY KEY,
  profile_id UUID NOT NULL,
  deal_data JSONB,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  generated_deal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deal_builder_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.deal_builder_sessions(session_id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  deal_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_sessions_profile_id ON public.deal_builder_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_db_sessions_generated_deal_id ON public.deal_builder_sessions(generated_deal_id);
CREATE INDEX IF NOT EXISTS idx_db_messages_profile_session ON public.deal_builder_messages(profile_id, session_id);
CREATE INDEX IF NOT EXISTS idx_db_messages_deal_id ON public.deal_builder_messages(deal_id);
CREATE INDEX IF NOT EXISTS idx_db_messages_created_at ON public.deal_builder_messages(created_at DESC);

ALTER TABLE public.deal_builder_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_builder_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS db_sessions_select_own ON public.deal_builder_sessions;
DROP POLICY IF EXISTS db_sessions_insert_own ON public.deal_builder_sessions;
DROP POLICY IF EXISTS db_sessions_update_own ON public.deal_builder_sessions;
DROP POLICY IF EXISTS db_sessions_delete_own ON public.deal_builder_sessions;

CREATE POLICY db_sessions_select_own ON public.deal_builder_sessions
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY db_sessions_insert_own ON public.deal_builder_sessions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY db_sessions_update_own ON public.deal_builder_sessions
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY db_sessions_delete_own ON public.deal_builder_sessions
  FOR DELETE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS db_messages_select_own ON public.deal_builder_messages;
DROP POLICY IF EXISTS db_messages_insert_own ON public.deal_builder_messages;
DROP POLICY IF EXISTS db_messages_update_own ON public.deal_builder_messages;
DROP POLICY IF EXISTS db_messages_delete_own ON public.deal_builder_messages;

CREATE POLICY db_messages_select_own ON public.deal_builder_messages
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY db_messages_insert_own ON public.deal_builder_messages
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY db_messages_update_own ON public.deal_builder_messages
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY db_messages_delete_own ON public.deal_builder_messages
  FOR DELETE USING (profile_id = auth.uid());