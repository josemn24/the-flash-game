-- S12 — Apply the effective-clock reads and attempt admission guard to migrated databases.
-- The source schemas are included after replacing only the affected function objects.

drop function public.get_my_room_cards();
drop function public.get_room_detail(text);
drop function public.get_room_introduction(text, uuid);
\ir ../schemas/55_room_reads.sql

drop function public.get_my_flash_challenge(text, uuid);
drop function public.get_my_flash_result(uuid);
\ir ../schemas/56_flash_reads.sql

\ir ../schemas/61_s12_effective_attempt_guard.sql
