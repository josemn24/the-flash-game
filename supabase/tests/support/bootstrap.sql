-- Only for the disposable test database, never the application database.
create schema auth;
create schema extensions;
create extension pgtap with schema extensions;
-- Minimal Storage catalog for declarative ACL tests. The real local Supabase
-- stack supplies these objects through its Storage service migrations.
create schema storage;
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb,
  unique (bucket_id, name)
);
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''))::jsonb
$$;
grant usage on schema auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth, extensions to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;
-- Deliberately simulate legacy Supabase defaults. The proposal must neutralize them.
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;
