-- MIGRATION 008: Add event_date, event_time, venue to potluck_events
-- Run in Supabase Dashboard → SQL Editor if upgrading from a schema
-- that was created before migration 005.

ALTER TABLE public.potluck_events
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS event_time time,
  ADD COLUMN IF NOT EXISTS venue      text;
