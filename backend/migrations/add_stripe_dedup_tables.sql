-- Stripe duplicate-subscription hardening
--
-- 1. stripe_webhook_events: every processed Stripe event id is recorded here
--    so webhook retries (Stripe retries for up to 3 days) are ignored instead
--    of re-granting tokens / re-activating subscriptions.
--
-- 2. checkout_attempts: at most ONE 'pending' checkout may exist per user (or
--    email) per price, enforced by a partial unique index. Concurrent or
--    repeated checkout requests reuse the pending session instead of creating
--    a new one — this is the DB-level race guard.
--
-- Run this in the Supabase SQL editor (service-role tables; no client access).

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    event_id    TEXT PRIMARY KEY,
    event_type  TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkout_attempts (
    id           BIGSERIAL PRIMARY KEY,
    customer_key TEXT NOT NULL,                    -- Supabase user id when known, else lowercased email
    price_id     TEXT NOT NULL,
    session_id   TEXT,                             -- Stripe checkout session id, set right after creation
    url          TEXT,                             -- Stripe checkout URL, reused on repeat requests
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending | completed | expired
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- The race guard: only one pending checkout per user per price.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_checkout_per_user_price
    ON checkout_attempts (customer_key, price_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_checkout_attempts_session_id
    ON checkout_attempts (session_id);

-- Backend accesses these with the service-role key only; block anon/authenticated.
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_attempts ENABLE ROW LEVEL SECURITY;
