-- Disposable Auth/Player provisioning tests; never application seed data.
begin;
set local search_path = public, extensions;
select no_plan();

create function pg_temp.test_id(label text) returns uuid language sql immutable
as $$ select md5('flash-player-provisioning:' || label)::uuid $$;
grant execute on function pg_temp.test_id(text) to authenticated;

insert into auth.users (id) values
  (pg_temp.test_id('auth-first')),
  (pg_temp.test_id('auth-second'));

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', pg_temp.test_id('auth-first'),
    'role', 'authenticated',
    'is_anonymous', false,
    'user_metadata', jsonb_build_object('display_name', 'Primera cuenta')
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select * from public.provision_player()$$,
  'Authenticated Auth claim provisions a Player'
);
select is((select count(*) from public.players), 1::bigint, 'First provisioning creates one Player');
select is((select display_name from public.players), 'Primera cuenta', 'Metadata supplies the initial name');
select is(
  private.current_player_id(),
  (select id from public.players),
  'Player is resolved from the Auth identity'
);
select throws_ok(
  'select auth_user_id from public.players',
  '42501', null,
  'Auth identity is not exposed through profile columns'
);

reset role;
create function pg_temp.reject_player_insert() returns trigger language plpgsql as $$
begin
  raise exception 'Existing players must be read without attempting an insert';
end;
$$;
create trigger reject_player_insert before insert on public.players
  for each statement execute function pg_temp.reject_player_insert();
set local role authenticated;

select results_eq(
  $$select * from public.provision_player()$$,
  $$select id, display_name, avatar_path, status from public.players$$,
  'Repeated provisioning returns the existing Player without writing'
);
select is((select count(*) from public.players), 1::bigint, 'Repeated provisioning creates no duplicate Player');

reset role;
drop trigger reject_player_insert on public.players;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', pg_temp.test_id('auth-second'),
    'role', 'authenticated',
    'is_anonymous', false,
    'user_metadata', jsonb_build_object('display_name', 'Segunda cuenta')
  )::text,
  true
);
select lives_ok(
  $$select * from public.provision_player()$$,
  'A second Auth identity provisions independently'
);
reset role;
select is((select count(*) from public.players), 2::bigint, 'Accounts receive distinct Players');
select is(
  (select count(distinct auth_user_id) from public.players),
  2::bigint,
  'Player/Auth relation remains unique'
);
set local role authenticated;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', pg_temp.test_id('auth-first'),
    'role', 'authenticated',
    'is_anonymous', true
  )::text,
  true
);
select throws_ok(
  $$select * from public.provision_player()$$,
  '42501', null,
  'Anonymous claims cannot provision a competitive Player'
);

reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok(
  'select * from public.provision_player()',
  '42501', null,
  'Anonymous API role cannot call provisioning'
);
reset role;
select * from finish();
rollback;
