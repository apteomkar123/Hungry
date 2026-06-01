-- ============================================================
-- MIGRATION 007: Add cuisine column to saved_recipes
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.saved_recipes
  ADD COLUMN IF NOT EXISTS cuisine text;
