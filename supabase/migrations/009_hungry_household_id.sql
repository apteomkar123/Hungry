-- Add hungry_household_id to profiles
-- When set, Pantry uses this household instead of active_household_id
-- When NULL (default), Pantry shares the active_household_id with HomeBase
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hungry_household_id uuid
  REFERENCES public.households(id) ON DELETE SET NULL;
