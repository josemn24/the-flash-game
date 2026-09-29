-- The application now uses the common room history projections directly.
-- Keep earlier migrations immutable and remove the obsolete compatibility RPCs
-- from databases that already applied them.
drop function if exists public.get_flash_history(text, uuid);
drop function if exists public.get_flash_member_review(text, uuid, uuid);
