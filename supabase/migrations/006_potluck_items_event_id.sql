-- ============================================================
-- MIGRATION 006: Add event_id to potluck_items if not present
-- Run in Supabase Dashboard → SQL Editor
--
-- If potluck_items already existed before Migration 005,
-- CREATE TABLE IF NOT EXISTS skipped it, leaving the old schema
-- without event_id. This migration adds that column and the FK.
-- ============================================================

-- 1. Add event_id if it doesn't exist
ALTER TABLE public.potluck_items
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.potluck_events(id) ON DELETE CASCADE;

-- 2. Add claimed_by_name if it doesn't exist (also from 005)
ALTER TABLE public.potluck_items
  ADD COLUMN IF NOT EXISTS claimed_by_name text;

-- 3. Add claimed_by_id FK if it doesn't exist
ALTER TABLE public.potluck_items
  ADD COLUMN IF NOT EXISTS claimed_by_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Make sure RLS policies exist (idempotent)
ALTER TABLE public.potluck_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pi2: authenticated manages" ON public.potluck_items;
CREATE POLICY "pi2: authenticated manages"
  ON public.potluck_items FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
