-- ============================================================
-- MIGRATION 009: Add image column to saved_recipes
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.saved_recipes
  ADD COLUMN IF NOT EXISTS image text;
