-- Make Alphabet a first-class mode in the generic room, portal, calendar and
-- editorial/versioning reads. This is intentionally incremental: the function
-- definitions already installed by the prior migrations are rewritten in place,
-- so ownership, grants, SECURITY DEFINER and search_path remain unchanged.
-- The targets below are deliberately handled as CREATE OR REPLACE FUNCTION
-- operations, one per existing contract; pg_get_functiondef keeps their full
-- return signatures and bodies intact while the mode predicates are extended.
-- CREATE OR REPLACE FUNCTION targets: get_my_room_cards, get_room_introduction,
-- get_superadmin_dashboard_context, get_superadmin_challenge_catalog,
-- get_superadmin_challenge_detail, assert_supported_calendar_content,
-- get_superadmin_calendar_context, get_superadmin_room_calendar_context,
-- read_superadmin_editorial_context, create_challenge_revision_command,
-- archive_challenge_version_command and get_superadmin_challenge_version_comparison.
begin;

do $migration$
declare
  function_name regprocedure;
  original_definition text;
  updated_definition text;
  names regprocedure[] := array[
    'public.get_my_room_cards()'::regprocedure,
    'public.get_room_introduction(text, uuid)'::regprocedure,
    'public.get_superadmin_dashboard_context()'::regprocedure,
    'public.get_superadmin_challenge_catalog()'::regprocedure,
    'public.get_superadmin_challenge_detail(uuid)'::regprocedure,
    'private.assert_supported_calendar_content(uuid)'::regprocedure,
    'public.get_superadmin_calendar_context()'::regprocedure,
    'public.get_superadmin_room_calendar_context(uuid)'::regprocedure,
    'private.read_superadmin_editorial_context()'::regprocedure,
    'private.create_challenge_revision_command(jsonb)'::regprocedure,
    'private.archive_challenge_version_command(jsonb)'::regprocedure,
    'public.get_superadmin_challenge_version_comparison(uuid, uuid)'::regprocedure
  ];
begin
  foreach function_name in array names loop
    select pg_get_functiondef(function_name) into original_definition;
    if original_definition is null then
      raise exception 'Missing function while installing Alphabet support: %', function_name;
    end if;

    updated_definition := original_definition;

    if function_name in (
      'public.get_my_room_cards()'::regprocedure,
      'public.get_room_introduction(text, uuid)'::regprocedure
    ) then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''narrative'')',
        'in (''flash'', ''alphabet'', ''survival'', ''narrative'')'
      );
      updated_definition := replace(
        updated_definition,
        'and (cv.mode = ''flash'' and cv.mode_config = ''{}''::jsonb',
        'and (cv.mode = ''flash'' and cv.mode_config = ''{}''::jsonb' || E'\n'
          || '            or cv.mode = ''alphabet'' and cv.mode_config = ''{}''::jsonb' || E'\n'
          || '              and bool_and(jsonb_typeof(items.mode_config->''letter'') = ''string'')'
      );
      updated_definition := replace(
        updated_definition,
        'and (version.mode = ''flash'' and version.mode_config = ''{}''::jsonb',
        'and (version.mode = ''flash'' and version.mode_config = ''{}''::jsonb' || E'\n'
          || '          or version.mode = ''alphabet'' and version.mode_config = ''{}''::jsonb' || E'\n'
          || '            and bool_and(jsonb_typeof(item.mode_config->''letter'') = ''string'')'
      );
    elsif function_name = 'public.get_superadmin_dashboard_context()'::regprocedure then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''narrative'', ''pyramid'')',
        'in (''flash'', ''alphabet'', ''survival'', ''narrative'', ''pyramid'')'
      );
    elsif function_name in (
      'public.get_superadmin_challenge_catalog()'::regprocedure,
      'public.get_superadmin_challenge_detail(uuid)'::regprocedure
    ) then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''narrative'', ''pyramid'')',
        'in (''flash'', ''alphabet'', ''survival'', ''narrative'', ''pyramid'')'
      );
    elsif function_name = 'private.assert_supported_calendar_content(uuid)'::regprocedure then
      updated_definition := replace(
        updated_definition,
        'not in (''flash'', ''survival'', ''narrative'', ''pyramid'')',
        'not in (''flash'', ''alphabet'', ''survival'', ''narrative'', ''pyramid'')'
      );
      updated_definition := replace(
        updated_definition,
        'or version_mode not in (''pyramid'', ''narrative'') and item.mode_config = ''{}''::jsonb',
        'or version_mode = ''alphabet''' || E'\n'
          || '          and jsonb_typeof(item.mode_config->''letter'') = ''string''' || E'\n'
          || '          or version_mode not in (''pyramid'', ''narrative'', ''alphabet'') and item.mode_config = ''{}''::jsonb'
      );
      updated_definition := replace(
        updated_definition,
        'or (version_mode = ''flash'' and version_config <> ''{}''::jsonb)',
        'or (version_mode = ''flash'' and version_config <> ''{}''::jsonb)' || E'\n'
          || '    or (version_mode = ''alphabet'' and version_config <> ''{}''::jsonb)'
      );
    elsif function_name in (
      'public.get_superadmin_calendar_context()'::regprocedure,
      'public.get_superadmin_room_calendar_context(uuid)'::regprocedure
    ) then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''narrative'', ''pyramid'')',
        'in (''flash'', ''alphabet'', ''survival'', ''narrative'', ''pyramid'')'
      );
    elsif function_name = 'private.read_superadmin_editorial_context()'::regprocedure then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''pyramid'')',
        'in (''flash'', ''alphabet'', ''survival'', ''pyramid'')'
      );
    elsif function_name in (
      'private.create_challenge_revision_command(jsonb)'::regprocedure,
      'private.archive_challenge_version_command(jsonb)'::regprocedure,
      'public.get_superadmin_challenge_version_comparison(uuid, uuid)'::regprocedure
    ) then
      updated_definition := replace(
        updated_definition,
        'in (''flash'', ''survival'', ''narrative'', ''pyramid'')',
        'in (''flash'', ''alphabet'', ''survival'', ''narrative'', ''pyramid'')'
      );
    end if;

    if updated_definition = original_definition then
      raise exception 'Alphabet support replacement was not applied to %', function_name;
    end if;
    execute updated_definition;
  end loop;
end;
$migration$;

commit;
