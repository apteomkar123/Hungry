-- Add hungry_household_id to profiles
-- When set, Hungry uses this household instead of active_household_id
-- When NULL (default), Hungry shares the active_household_id with Roomies
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hungry_household_id uuid
  REFERENCES public.households(id) ON DELETE SET NULL;
