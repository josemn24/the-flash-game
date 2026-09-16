-- Private beta portal read boundary. A superadmin is a platform assignment,
-- not a room membership and not a client-editable Auth claim.
create function public.get_superadmin_portal_context()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := (select private.current_player_id());
  operator_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'playerId', player.id,
    'displayName', player.display_name
  )
  into operator_payload
  from public.players player
  where player.id = actor and player.status = 'active';

  if operator_payload is null then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'operator', operator_payload,
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'status', room.status
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb)
  );
end;
$$;

alter function public.get_superadmin_portal_context() owner to postgres;
revoke all on function public.get_superadmin_portal_context() from public, anon, service_role;
grant execute on function public.get_superadmin_portal_context() to authenticated;
