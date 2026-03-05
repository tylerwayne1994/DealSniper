-- ============================================================================
-- Agent System — Database Migration
-- Creates 4 tables:  agent_configs, agent_runs, agent_deals, agent_notifications
-- Run against your Supabase PostgreSQL via the SQL Editor.
-- ============================================================================

-- 1. Agent Configs — one per user, stores buy-box + encrypted credentials
CREATE TABLE IF NOT EXISTS agent_configs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         TEXT NOT NULL,
    platform_credentials  JSONB DEFAULT '[]'::jsonb,
    buy_box         JSONB DEFAULT '{}'::jsonb,
    runs_per_week   INTEGER DEFAULT 1 CHECK (runs_per_week BETWEEN 1 AND 7),
    status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    last_run_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_agent_configs_user_id ON agent_configs(user_id);


-- 2. Agent Runs — one row per execution
CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_config_id UUID REFERENCES agent_configs(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,
    status          TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'queued')),
    started_at      TIMESTAMPTZ DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    deals_found     INTEGER DEFAULT 0,
    error           TEXT,
    log             JSONB DEFAULT '[]'::jsonb,
    triggered_by    TEXT DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_config ON agent_runs(agent_config_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user   ON agent_runs(user_id);


-- 3. Agent Deals — deals found by the agent
CREATE TABLE IF NOT EXISTS agent_deals (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_run_id    UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    user_id         TEXT NOT NULL,
    platform        TEXT DEFAULT '',
    address         TEXT DEFAULT '',
    price           NUMERIC,
    cap_rate        NUMERIC,
    property_type   TEXT DEFAULT '',
    units           INTEGER,
    sqft            INTEGER,
    occupancy       NUMERIC,
    listing_url     TEXT DEFAULT '',
    om_file_path    TEXT,
    raw_data        JSONB DEFAULT '{}'::jsonb,
    pipeline_deal_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_deals_user ON agent_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_deals_run  ON agent_deals(agent_run_id);


-- 4. Agent Notifications — alerts for the user
CREATE TABLE IF NOT EXISTS agent_notifications (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         TEXT NOT NULL,
    message         TEXT NOT NULL,
    agent_run_id    UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_deal_id   UUID REFERENCES agent_deals(id) ON DELETE SET NULL,
    read            BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_notifications_user ON agent_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_notifications_unread ON agent_notifications(user_id, read) WHERE read = FALSE;


-- ============================================================================
-- Row Level Security (RLS) — users can only access their own data
-- ============================================================================

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;

-- Policies: service_role (backend) bypasses RLS automatically.
-- These policies allow authenticated users to read their own rows directly
-- if you ever want to query Supabase from the client side.

CREATE POLICY "Users can manage own agent configs"
    ON agent_configs FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own agent runs"
    ON agent_runs FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own agent deals"
    ON agent_deals FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own agent notifications"
    ON agent_notifications FOR ALL
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);
