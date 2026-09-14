-- Explicit object ACLs remove Supabase default grants, including TRUNCATE and REFERENCES.
-- No direct domain DML for clients or service_role: mutations use private commands.
-- RLS is also enabled on private tables as defense if exposure configuration changes.
alter table public.players enable row level security;
revoke all on table public.players from public, anon, authenticated, service_role;
grant select on table public.players to service_role;

alter table public.rooms enable row level security;
revoke all on table public.rooms from public, anon, authenticated, service_role;
grant select on table public.rooms to service_role;

alter table public.room_memberships enable row level security;
revoke all on table public.room_memberships from public, anon, authenticated, service_role;
grant select on table public.room_memberships to service_role;

alter table public.seasons enable row level security;
revoke all on table public.seasons from public, anon, authenticated, service_role;
grant select on table public.seasons to service_role;

alter table public.scheduled_challenges enable row level security;
revoke all on table public.scheduled_challenges from public, anon, authenticated, service_role;
grant select on table public.scheduled_challenges to service_role;

alter table public.attempts enable row level security;
revoke all on table public.attempts from public, anon, authenticated, service_role;
grant select on table public.attempts to service_role;

alter table private.platform_role_assignments enable row level security;
revoke all on table private.platform_role_assignments from public, anon, authenticated, service_role;
grant select on table private.platform_role_assignments to service_role;

alter table private.room_invitations enable row level security;
revoke all on table private.room_invitations from public, anon, authenticated, service_role;
grant select on table private.room_invitations to service_role;

alter table private.question_definitions enable row level security;
revoke all on table private.question_definitions from public, anon, authenticated, service_role;
grant select on table private.question_definitions to service_role;

alter table private.question_versions enable row level security;
revoke all on table private.question_versions from public, anon, authenticated, service_role;
grant select on table private.question_versions to service_role;

alter table private.question_version_solutions enable row level security;
revoke all on table private.question_version_solutions from public, anon, authenticated, service_role;
grant select on table private.question_version_solutions to service_role;

alter table private.challenge_definitions enable row level security;
revoke all on table private.challenge_definitions from public, anon, authenticated, service_role;
grant select on table private.challenge_definitions to service_role;

alter table private.challenge_versions enable row level security;
revoke all on table private.challenge_versions from public, anon, authenticated, service_role;
grant select on table private.challenge_versions to service_role;

alter table private.challenge_items enable row level security;
revoke all on table private.challenge_items from public, anon, authenticated, service_role;
grant select on table private.challenge_items to service_role;

alter table private.attempt_sessions enable row level security;
revoke all on table private.attempt_sessions from public, anon, authenticated, service_role;
grant select on table private.attempt_sessions to service_role;

alter table private.attempt_answers enable row level security;
revoke all on table private.attempt_answers from public, anon, authenticated, service_role;
grant select on table private.attempt_answers to service_role;

alter table private.flash_point_entries enable row level security;
revoke all on table private.flash_point_entries from public, anon, authenticated, service_role;
grant select on table private.flash_point_entries to service_role;

alter table private.audit_log enable row level security;
revoke all on table private.audit_log from public, anon, authenticated, service_role;
grant select on table private.audit_log to service_role;

-- Auth IDs, checkpoints, technical timestamps and terminal reasons have no client SELECT grant.
grant usage on schema public to authenticated, service_role;
grant select (id, display_name, avatar_path, status) on public.players to authenticated;
grant update (display_name) on public.players to authenticated;
grant select on public.rooms, public.room_memberships, public.seasons, public.scheduled_challenges to authenticated;
grant select (id, player_id, scheduled_challenge_id, status, started_at, deadline_at, completed_at, score)
  on public.attempts to authenticated;

create policy players_select on public.players for select to authenticated
  using (private.can_read_profile(id));
create policy players_update_name on public.players for update to authenticated
  using (id = (select private.current_player_id()) and status = 'active')
  with check (id = (select private.current_player_id()) and status = 'active');
create policy rooms_select on public.rooms for select to authenticated
  using (private.is_room_member(id));
create policy memberships_select on public.room_memberships for select to authenticated
  using (status = 'active' and private.is_room_member(room_id));
create policy seasons_select on public.seasons for select to authenticated
  using (status <> 'draft' and private.is_room_member(room_id));
create policy publications_select on public.scheduled_challenges for select to authenticated
  using (exists (select 1 from public.seasons s where s.id = season_id));
create policy attempts_select_own on public.attempts for select to authenticated
  using (kind = 'competitive' and status <> 'invalidated'
    and private.can_read_own_attempt(scheduled_challenge_id, player_id));

-- No policy grants superadmin global access from the browser. Administrative inspection
-- requires a server command that resolves platform_role_assignments and records its audit.
-- service_role bypasses RLS but still obeys its object ACLs, constraints and triggers.

-- Helpers are executable for policies, not public RPC endpoints; trigger functions are not callable.
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.current_player_id(), private.is_room_member(uuid),
  private.can_read_profile(uuid), private.can_read_own_attempt(uuid, uuid) to authenticated;
