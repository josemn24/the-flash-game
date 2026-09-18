SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.validate_flash_question_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(jsonb_build_object(
    'challenge', jsonb_build_object(
      'slug', 'question-library-validation',
      'title', 'Question library validation',
      'subtitle', '',
      'description', '',
      'mode', 'flash',
      'configSchemaVersion', 1,
      'modeConfig', '{}'::jsonb
    ),
    'questions', jsonb_build_array(
      document || jsonb_build_object('points', 50),
      document || jsonb_build_object(
        'slug', (document->>'slug') || '-validation-copy',
        'points', 50
      )
    )
  ));
end;
$function$;
