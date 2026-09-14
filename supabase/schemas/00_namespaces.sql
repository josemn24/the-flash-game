-- Initial proposal, PostgreSQL 17 / Supabase. No application data or role provisioning.
-- private must NEVER be added to the Data API exposed schemas.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
-- authenticated only needs USAGE to evaluate narrowly granted RLS helpers.
revoke create on schema public from public, anon, authenticated;

