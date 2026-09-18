alter table private.media_assets enable row level security;
revoke all on table private.media_assets from public, anon, authenticated, service_role;
grant select on table private.media_assets to service_role;

alter function private.prepare_avatar_upload_command(jsonb) owner to postgres;
alter function private.read_avatar_upload_asset(jsonb) owner to postgres;
alter function private.confirm_avatar_upload_command(jsonb) owner to postgres;
alter function private.abort_avatar_upload_command(jsonb) owner to postgres;
revoke all on function private.prepare_avatar_upload_command(jsonb),
  private.read_avatar_upload_asset(jsonb), private.confirm_avatar_upload_command(jsonb),
  private.abort_avatar_upload_command(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.prepare_avatar_upload_command(jsonb),
  private.read_avatar_upload_asset(jsonb), private.confirm_avatar_upload_command(jsonb),
  private.abort_avatar_upload_command(jsonb) to service_role;
