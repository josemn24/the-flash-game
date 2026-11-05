-- Internal command helpers; no direct execution by API roles.
set local check_function_bodies = off;

create function private.handle_invitation_command(
  input jsonb,
  safe_input jsonb,
  actor uuid,
  cached_result jsonb
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  target uuid;
  invitation private.room_invitations%rowtype;
  member public.room_memberships%rowtype;
  result jsonb;
begin
    -- Room before invitation/membership is the shared lock order for membership writers.
    select room_id into target from private.room_invitations where token_hash = safe_input->>'invitationToken';
    perform 1 from public.rooms where id = target and status = 'active' for update;
    if not found then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    select * into invitation from private.room_invitations where token_hash = safe_input->>'invitationToken' for update;
    select * into member from public.room_memberships where room_id = target and player_id = actor for update;
    if member.status = 'banned' then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    if cached_result is not null then
      return jsonb_build_object(
        'result', cached_result,
        'entityType', 'invitation',
        'entityId', invitation.id,
        'beforePayload', null,
        'replayed', true
      );
    end if;
    if invitation.revoked_at is not null or invitation.expires_at <= clock_timestamp()
      or (invitation.max_uses is not null and invitation.use_count >= invitation.max_uses) then
      raise exception 'invitation_unavailable' using errcode = '42501';
    end if;
    if member.status = 'active' then
      result := jsonb_build_object('membershipId', member.id, 'joined', false);
    else
      insert into public.room_memberships(room_id, player_id, role) values(target, actor, invitation.role)
      on conflict (room_id, player_id) do update set status = 'active', ended_at = null,
        joined_at = clock_timestamp(), role = excluded.role returning * into member;
      update private.room_invitations set use_count = use_count + 1 where id = invitation.id;
      result := jsonb_build_object('membershipId', member.id, 'joined', true);
    end if;
    target := invitation.id;
  return jsonb_build_object(
    'result', result,
    'entityType', 'invitation',
    'entityId', target,
    'beforePayload', null,
    'replayed', false
  );
end;
$$;
alter function private.handle_invitation_command(jsonb, jsonb, uuid, jsonb) owner to postgres;
revoke all on function private.handle_invitation_command(jsonb, jsonb, uuid, jsonb) from public, anon, authenticated, service_role;
