-- Internal view only. Independent aggregates prevent answer x ledger join multiplication.
-- Eligibility is historical: later membership termination does not erase earned points.
create view private.effective_results with (security_invoker = true) as
select a.id as attempt_id, a.player_id, a.scheduled_challenge_id, sc.season_id,
  s.room_id, a.started_at, points.flash_points, duration.duration_ms
from public.attempts a
join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
join public.seasons s on s.id = sc.season_id
join lateral (
  select sum(e.amount)::bigint as flash_points
  from private.flash_point_entries e where e.attempt_id = a.id
  having bool_or(e.entry_type = 'accreditation')
) points on true
cross join lateral (
  select coalesce(sum(aa.time_used_ms), 0)::bigint as duration_ms
  from private.attempt_answers aa where aa.attempt_id = a.id
) duration
where a.kind = 'competitive' and a.status = 'completed' and sc.status <> 'cancelled';

revoke all on private.effective_results from public, anon, authenticated, service_role;
grant select on private.effective_results to service_role;

-- The only exposed definer functions return minimal rankings, never raw attempts/answers.
-- Nonexistent and inaccessible scopes both produce an empty set.
create function public.get_challenge_ranking(target_publication_id uuid)
returns table (player_id uuid, display_name text, avatar_path text,
  flash_points bigint, duration_ms bigint, "position" bigint)
language sql stable security definer set search_path = '' as $$
  select e.player_id, p.display_name, p.avatar_path, e.flash_points, e.duration_ms,
    rank() over (order by e.flash_points desc, e.duration_ms, e.started_at) as "position"
  from private.effective_results e join public.players p on p.id = e.player_id
  where e.scheduled_challenge_id = target_publication_id and private.is_room_member(e.room_id)
  order by "position", e.player_id
$$;

create function public.get_season_ranking(target_season_id uuid)
returns table (player_id uuid, display_name text, avatar_path text,
  flash_points bigint, is_former_member boolean, "position" bigint)
language sql stable security definer set search_path = '' as $$
  with allowed_season as (
    select s.id, s.room_id from public.seasons s
    where s.id = target_season_id and s.status <> 'draft' and private.is_room_member(s.room_id)
  ), totals as (
    select e.player_id, sum(e.flash_points)::bigint as flash_points
    from private.effective_results e join allowed_season s on s.id = e.season_id
    group by e.player_id
  ), candidates as (
    select m.player_id from public.room_memberships m join allowed_season s on s.room_id = m.room_id
    join public.players p on p.id = m.player_id
    where m.status = 'active' and m.role in ('owner', 'admin', 'member') and p.status = 'active'
      and not exists (select 1 from private.platform_role_assignments x where x.player_id = m.player_id)
    union
    select t.player_id from totals t where t.flash_points > 0
  )
  select c.player_id, p.display_name, p.avatar_path, coalesce(t.flash_points, 0),
    not exists (select 1 from public.room_memberships m join allowed_season s on s.room_id = m.room_id
      where m.player_id = c.player_id and m.status = 'active'),
    rank() over (order by coalesce(t.flash_points, 0) desc) as "position"
  from candidates c join public.players p on p.id = c.player_id
  left join totals t on t.player_id = c.player_id
  order by "position", c.player_id
$$;

alter function public.get_challenge_ranking(uuid) owner to postgres;
alter function public.get_season_ranking(uuid) owner to postgres;
revoke all on function public.get_challenge_ranking(uuid), public.get_season_ranking(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_challenge_ranking(uuid), public.get_season_ranking(uuid)
  to authenticated;
