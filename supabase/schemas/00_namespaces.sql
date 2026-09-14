-- Initial proposal, PostgreSQL 17 / Supabase. No application data or role provisioning.
-- private must NEVER be added to the Data API exposed schemas.
create schema if not exists private;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
-- authenticated only needs USAGE to evaluate narrowly granted RLS helpers.
revoke create on schema public from public, anon, authenticated, service_role;


-- Applies to future objects made by the deployment owner, not existing objects.
-- Global PUBLIC EXECUTE must be revoked globally, not only IN SCHEMA public.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke all on functions from public, anon, authenticated, service_role;
