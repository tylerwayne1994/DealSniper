-- Cleanup migration: enforce per-member deals and remove global rows
-- 1) Purge any unowned rows in pipeline and rapidfire
DELETE FROM public.deals
WHERE pipeline_status IN ('pipeline','rapidfire')
  AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM public.profiles));

-- 2) Enforce that all deals rows must have a user_id
ALTER TABLE public.deals ALTER COLUMN user_id SET NOT NULL;

-- 3) Enable strict RLS: only owner can SELECT/INSERT/UPDATE/DELETE
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Drop any permissive policies
DROP POLICY IF EXISTS deals_select_all ON public.deals;
DROP POLICY IF EXISTS deals_insert_all ON public.deals;
DROP POLICY IF EXISTS deals_update_all ON public.deals;
DROP POLICY IF EXISTS deals_delete_all ON public.deals;

-- Own-row policies
DROP POLICY IF EXISTS deals_select_own ON public.deals;
DROP POLICY IF EXISTS deals_insert_own ON public.deals;
DROP POLICY IF EXISTS deals_update_own ON public.deals;
DROP POLICY IF EXISTS deals_delete_own ON public.deals;

CREATE POLICY deals_select_own ON public.deals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY deals_insert_own ON public.deals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY deals_update_own ON public.deals
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY deals_delete_own ON public.deals
FOR DELETE
USING (auth.uid() = user_id);

-- 4) Optional validation queries (run manually)
-- SELECT pipeline_status, COUNT(*) FROM public.deals GROUP BY pipeline_status;
-- SELECT COUNT(*) FROM public.deals WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM public.deals WHERE user_id NOT IN (SELECT id FROM public.profiles);