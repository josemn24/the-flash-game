SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE SCHEMA "private";

CREATE EXTENSION "btree_gist" SCHEMA "extensions";

CREATE TABLE "private"."answer_receipts" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"             uuid                     NOT NULL,
  "challenge_item_id"      uuid                     NOT NULL,
  "challenge_version_id"   uuid                     NOT NULL,
  "answer"                 jsonb,
  "received_at"            timestamp with time zone NOT NULL,
  "presented_at"           timestamp with time zone NOT NULL,
  "effective_submitted_at" timestamp with time zone NOT NULL,
  "time_used_ms"           bigint                   NOT NULL,
  "timed_out"              boolean                  NOT NULL,
  "client_time_used_ms"    bigint,
  CONSTRAINT "answer_receipts_attempt_id_challenge_item_id_key" UNIQUE (attempt_id, challenge_item_id),
  CONSTRAINT "answer_receipts_check1" CHECK ((received_at >= effective_submitted_at)),
  CONSTRAINT "answer_receipts_check" CHECK ((effective_submitted_at >= presented_at)),
  CONSTRAINT "answer_receipts_client_time_used_ms_check" CHECK ((client_time_used_ms >= 0)),
  CONSTRAINT "answer_receipts_id_attempt_id_challenge_item_id_challenge_v_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "answer_receipts_pkey" PRIMARY KEY (id),
  CONSTRAINT "answer_receipts_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."answer_receipts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."attempt_answers" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "status"               text                     NOT NULL,
  "answer"               jsonb,
  "result_details"       jsonb,
  "points"               integer                  NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "submitted_at"         timestamp with time zone,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "receipt_id"           uuid                     NOT NULL,
  CONSTRAINT "attempt_answers_attempt_id_challenge_item_id_key" UNIQUE (attempt_id, challenge_item_id),
  CONSTRAINT "attempt_answers_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "attempt_answers_check" CHECK (((submitted_at IS NULL) OR (submitted_at >= presented_at))),
  CONSTRAINT "attempt_answers_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "attempt_answers_pkey" PRIMARY KEY (id),
  CONSTRAINT "attempt_answers_points_check" CHECK (((points >= 0) AND (points <= 100))),
  CONSTRAINT "attempt_answers_status_check" CHECK ((status = ANY (ARRAY['correct'::text, 'partial'::text, 'incorrect'::text, 'unanswered'::text, 'timeout'::text]))),
  CONSTRAINT "attempt_answers_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."attempt_answers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."attempt_sessions" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"         uuid                     NOT NULL,
  "session_token_hash" text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"         timestamp with time zone,
  "revoked_at"         timestamp with time zone,
  CONSTRAINT "attempt_sessions_check1" CHECK ((last_seen_at >= created_at)),
  CONSTRAINT "attempt_sessions_check2" CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
  CONSTRAINT "attempt_sessions_check" CHECK ((expires_at > created_at)),
  CONSTRAINT "attempt_sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "attempt_sessions_session_token_hash_check" CHECK ((btrim(session_token_hash) <> ''::text)),
  CONSTRAINT "attempt_sessions_session_token_hash_key" UNIQUE (session_token_hash)
);

ALTER TABLE "private"."attempt_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."attempt_timing_units" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "scope"                text                     NOT NULL,
  "started_at"           timestamp with time zone NOT NULL,
  "deadline_at"          timestamp with time zone NOT NULL,
  CONSTRAINT "attempt_timing_units_attempt_id_challenge_item_id_key" UNIQUE (attempt_id, challenge_item_id),
  CONSTRAINT "attempt_timing_units_check" CHECK ((deadline_at > started_at)),
  CONSTRAINT "attempt_timing_units_id_attempt_id_challenge_item_id_key" UNIQUE (id, attempt_id, challenge_item_id),
  CONSTRAINT "attempt_timing_units_pkey" PRIMARY KEY (id),
  CONSTRAINT "attempt_timing_units_scope_check" CHECK ((scope = ANY (ARRAY['question'::text, 'level'::text, 'attempt'::text])))
);

ALTER TABLE "private"."attempt_timing_units"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."audit_log" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "actor_player_id" uuid,
  "action"          text                     NOT NULL,
  "entity_type"     text                     NOT NULL,
  "entity_id"       uuid,
  "reason"          text,
  "request_id"      text,
  "before_payload"  jsonb,
  "after_payload"   jsonb,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_action_check" CHECK ((btrim(action) <> ''::text)),
  CONSTRAINT "audit_log_entity_type_check" CHECK ((btrim(entity_type) <> ''::text)),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."challenge_definitions" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"                 text                     NOT NULL,
  "created_by_player_id" uuid                     NOT NULL,
  "archived_at"          timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_definitions_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenge_definitions_slug_check" CHECK ((btrim(slug) <> ''::text)),
  CONSTRAINT "challenge_definitions_slug_key" UNIQUE (slug)
);

ALTER TABLE "private"."challenge_definitions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."challenge_items" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "challenge_version_id"  uuid                     NOT NULL,
  "question_version_id"   uuid                     NOT NULL,
  "position"              integer                  NOT NULL,
  "points"                integer                  NOT NULL,
  "config_schema_version" integer                  NOT NULL DEFAULT 1,
  "mode_config"           jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_items_challenge_version_id_position_key" UNIQUE (challenge_version_id, "position"),
  CONSTRAINT "challenge_items_config_schema_version_check" CHECK ((config_schema_version > 0)),
  CONSTRAINT "challenge_items_id_challenge_version_id_key" UNIQUE (id, challenge_version_id),
  CONSTRAINT "challenge_items_mode_config_check" CHECK ((jsonb_typeof(mode_config) = 'object'::text)),
  CONSTRAINT "challenge_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenge_items_points_check" CHECK (((points >= 0) AND (points <= 100))),
  CONSTRAINT "challenge_items_position_check" CHECK (("position" > 0))
);

ALTER TABLE "private"."challenge_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."challenge_versions" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "challenge_definition_id" uuid                     NOT NULL,
  "version_number"          integer                  NOT NULL,
  "config_schema_version"   integer                  NOT NULL DEFAULT 1,
  "status"                  text                     NOT NULL DEFAULT 'draft'::text,
  "mode"                    text                     NOT NULL,
  "title"                   text                     NOT NULL,
  "subtitle"                text                     NOT NULL DEFAULT ''::text,
  "description"             text                     NOT NULL DEFAULT ''::text,
  "global_time_limit_ms"    integer,
  "max_score"               integer                  NOT NULL DEFAULT 100,
  "mode_config"             jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_by_player_id"    uuid                     NOT NULL,
  "published_at"            timestamp with time zone,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_versions_challenge_definition_id_version_number_key" UNIQUE (challenge_definition_id, version_number),
  CONSTRAINT "challenge_versions_check1" CHECK (((status = 'draft'::text) = (published_at IS NULL))),
  CONSTRAINT "challenge_versions_check" CHECK (((status = 'draft'::text) OR ((mode = 'alphabet'::text) = (global_time_limit_ms IS NOT NULL)))),
  CONSTRAINT "challenge_versions_config_schema_version_check" CHECK ((config_schema_version > 0)),
  CONSTRAINT "challenge_versions_global_time_limit_ms_check" CHECK ((global_time_limit_ms > 0)),
  CONSTRAINT "challenge_versions_max_score_check" CHECK ((max_score = 100)),
  CONSTRAINT "challenge_versions_mode_check" CHECK ((mode = ANY (ARRAY['flash'::text, 'alphabet'::text, 'survival'::text, 'narrative'::text, 'pyramid'::text]))),
  CONSTRAINT "challenge_versions_mode_config_check" CHECK ((jsonb_typeof(mode_config) = 'object'::text)),
  CONSTRAINT "challenge_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenge_versions_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
  CONSTRAINT "challenge_versions_title_check" CHECK ((btrim(title) <> ''::text)),
  CONSTRAINT "challenge_versions_version_number_check" CHECK ((version_number > 0))
);

ALTER TABLE "private"."challenge_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."command_requests" (
  "actor_id"        uuid                     NOT NULL,
  "idempotency_key" text                     NOT NULL,
  "operation"       text                     NOT NULL,
  "input"           jsonb                    NOT NULL,
  "result"          jsonb                    NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT "command_requests_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "command_requests_pkey" PRIMARY KEY (actor_id, idempotency_key)
);

ALTER TABLE "private"."command_requests"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."flash_point_entries" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "season_id"              uuid                     NOT NULL,
  "player_id"              uuid                     NOT NULL,
  "scheduled_challenge_id" uuid                     NOT NULL,
  "attempt_id"             uuid                     NOT NULL,
  "entry_type"             text                     NOT NULL,
  "amount"                 integer                  NOT NULL,
  "reason"                 text,
  "created_by_player_id"   uuid,
  "idempotency_key"        text                     NOT NULL,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "flash_point_entries_amount_check" CHECK (((amount >= '-100'::integer) AND (amount <= 100))),
  CONSTRAINT "flash_point_entries_check1" CHECK (((entry_type <> 'reversal'::text) OR (amount <= 0))),
  CONSTRAINT "flash_point_entries_check"
    CHECK ((((entry_type = 'accreditation'::text) AND (amount >= 0)) OR ((entry_type = ANY (ARRAY['adjustment'::text, 'reversal'::text])) AND (reason IS
    NOT NULL) AND (btrim(reason) <> ''::text) AND (created_by_player_id IS NOT NULL)))),
  CONSTRAINT "flash_point_entries_entry_type_check" CHECK ((entry_type = ANY (ARRAY['accreditation'::text, 'adjustment'::text, 'reversal'::text]))),
  CONSTRAINT "flash_point_entries_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "flash_point_entries_idempotency_key_key" UNIQUE (idempotency_key),
  CONSTRAINT "flash_point_entries_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."flash_point_entries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."interaction_intervals" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"        uuid                     NOT NULL,
  "challenge_item_id" uuid                     NOT NULL,
  "timing_unit_id"    uuid                     NOT NULL,
  "started_at"        timestamp with time zone NOT NULL,
  "ended_at"          timestamp with time zone,
  "end_reason"        text,
  CONSTRAINT "interaction_intervals_check1" CHECK (((ended_at IS NULL) OR (ended_at >= started_at))),
  CONSTRAINT "interaction_intervals_check" CHECK (((ended_at IS NULL) = (end_reason IS NULL))),
  CONSTRAINT "interaction_intervals_end_reason_check"
    CHECK ((end_reason = ANY (ARRAY['answer'::text, 'pass'::text, 'timeout'::text, 'abandon'::text, 'recovery_interrupted'::text]))),
  CONSTRAINT "interaction_intervals_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."interaction_intervals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."logic_code_attempt_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             integer                  NOT NULL,
  "code"                 text                     NOT NULL,
  "correct"              boolean                  NOT NULL,
  "penalty_applied"      boolean                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "logic_code_attempt_events_attempt_id_challenge_item_id_code_key" UNIQUE (attempt_id, challenge_item_id, code),
  CONSTRAINT "logic_code_attempt_events_attempt_id_challenge_item_id_sequ_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "logic_code_attempt_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "logic_code_attempt_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "logic_code_attempt_events_code_check" CHECK (((code <> ''::text) AND (code ~ '^[0-9]+$'::text))),
  CONSTRAINT "logic_code_attempt_events_id_attempt_id_challenge_item_id_c_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "logic_code_attempt_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "logic_code_attempt_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "logic_code_attempt_events_sequence_check" CHECK ((sequence > 0)),
  CONSTRAINT "logic_code_attempt_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."logic_code_attempt_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."matching_pair_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             integer                  NOT NULL,
  "left_item_id"         text                     NOT NULL,
  "right_item_id"        text                     NOT NULL,
  "correct"              boolean                  NOT NULL,
  "penalty_points"       integer                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "matching_pair_events_attempt_id_challenge_item_id_left_item_key" UNIQUE (attempt_id, challenge_item_id, left_item_id, right_item_id),
  CONSTRAINT "matching_pair_events_attempt_id_challenge_item_id_sequence_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "matching_pair_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "matching_pair_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "matching_pair_events_id_attempt_id_challenge_item_id_challe_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "matching_pair_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "matching_pair_events_left_item_id_check" CHECK (((btrim(left_item_id) <> ''::text) AND (char_length(left_item_id) <= 120))),
  CONSTRAINT "matching_pair_events_penalty_points_check" CHECK ((penalty_points >= 0)),
  CONSTRAINT "matching_pair_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "matching_pair_events_right_item_id_check" CHECK (((btrim(right_item_id) <> ''::text) AND (char_length(right_item_id) <= 120))),
  CONSTRAINT "matching_pair_events_sequence_check" CHECK ((sequence > 0)),
  CONSTRAINT "matching_pair_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."matching_pair_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."media_assets" (
  "id"                   uuid                     NOT NULL,
  "bucket_id"            text                     NOT NULL,
  "object_path"          text                     NOT NULL,
  "kind"                 text                     NOT NULL,
  "status"               text                     NOT NULL DEFAULT 'pending'::text,
  "owner_player_id"      uuid,
  "created_by_player_id" uuid                     NOT NULL,
  "mime_type"            text,
  "byte_size"            bigint,
  "width"                integer,
  "height"               integer,
  "sha256"               text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "archived_at"          timestamp with time zone,
  "deleted_at"           timestamp with time zone,
  CONSTRAINT "media_assets_bucket_id_check" CHECK ((bucket_id = ANY (ARRAY['avatars'::text, 'question-assets'::text]))),
  CONSTRAINT "media_assets_byte_size_check" CHECK (((byte_size IS NULL) OR (byte_size > 0))),
  CONSTRAINT "media_assets_check1" CHECK (((status <> 'ready'::text) OR ((mime_type IS NOT NULL) AND (byte_size IS NOT NULL) AND (width IS NOT NULL) AND (height IS
    NOT NULL) AND (sha256 IS NOT NULL)))),
  CONSTRAINT "media_assets_check2" CHECK (((status = 'archived'::text) = (archived_at IS NOT NULL))),
  CONSTRAINT "media_assets_check3" CHECK (((status = 'deleted'::text) = (deleted_at IS NOT NULL))),
  CONSTRAINT "media_assets_check" CHECK ((((kind = 'avatar'::text) AND (bucket_id = 'avatars'::text) AND (owner_player_id IS
    NOT NULL) AND (object_path ~ '^avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'::text)) OR
    ((kind = 'question-asset'::text) AND (bucket_id = 'question-assets'::text) AND (object_path ~~ 'question-assets/%'::text)))),
  CONSTRAINT "media_assets_height_check" CHECK (((height IS NULL) OR (height > 0))),
  CONSTRAINT "media_assets_kind_check" CHECK ((kind = ANY (ARRAY['avatar'::text, 'question-asset'::text]))),
  CONSTRAINT "media_assets_mime_type_check" CHECK (((mime_type IS NULL) OR (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))),
  CONSTRAINT "media_assets_object_path_key" UNIQUE (object_path),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_assets_sha256_check" CHECK (((sha256 IS NULL) OR (sha256 ~ '^[0-9a-f]{64}$'::text))),
  CONSTRAINT "media_assets_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'archived'::text, 'deleted'::text]))),
  CONSTRAINT "media_assets_width_check" CHECK (((width IS NULL) OR (width > 0)))
);

ALTER TABLE "private"."media_assets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."mini_wordle_dictionary_words" (
  "dictionary_id" text     NOT NULL,
  "word_length"   smallint NOT NULL,
  "word"          text     NOT NULL,
  CONSTRAINT "mini_wordle_dictionary_words_check1" CHECK ((char_length(word) = word_length)),
  CONSTRAINT "mini_wordle_dictionary_words_check"
    CHECK ((((dictionary_id = 'es-general-4.v1'::text) AND (word_length = 4)) OR ((dictionary_id = 'es-general-5.v1'::text) AND (word_length = 5)))),
  CONSTRAINT "mini_wordle_dictionary_words_dictionary_id_check" CHECK ((dictionary_id = ANY (ARRAY['es-general-4.v1'::text, 'es-general-5.v1'::text]))),
  CONSTRAINT "mini_wordle_dictionary_words_pkey" PRIMARY KEY (dictionary_id, word),
  CONSTRAINT "mini_wordle_dictionary_words_word_check" CHECK (((word = upper(word)) AND (word ~ '^[A-ZÑ]+$'::text))),
  CONSTRAINT "mini_wordle_dictionary_words_word_length_check" CHECK ((word_length = ANY (ARRAY[4, 5])))
);

ALTER TABLE "private"."mini_wordle_dictionary_words"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."mini_wordle_guess_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             smallint                 NOT NULL,
  "guess"                text                     NOT NULL,
  "feedback"             jsonb                    NOT NULL,
  "solved"               boolean                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "mini_wordle_guess_events_attempt_id_challenge_item_id_guess_key" UNIQUE (attempt_id, challenge_item_id, guess),
  CONSTRAINT "mini_wordle_guess_events_attempt_id_challenge_item_id_seque_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "mini_wordle_guess_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "mini_wordle_guess_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "mini_wordle_guess_events_feedback_check" CHECK ((jsonb_typeof(feedback) = 'array'::text)),
  CONSTRAINT "mini_wordle_guess_events_guess_check" CHECK (((guess = upper(guess)) AND (guess ~ '^[A-ZÑ]+$'::text))),
  CONSTRAINT "mini_wordle_guess_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "mini_wordle_guess_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "mini_wordle_guess_events_sequence_check" CHECK (((sequence > 0) AND (sequence <= 10))),
  CONSTRAINT "mini_wordle_guess_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."mini_wordle_guess_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."platform_role_assignments" (
  "player_id"  uuid                     NOT NULL,
  "role"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY (player_id),
  CONSTRAINT "platform_role_assignments_role_check" CHECK ((role = 'superadmin'::text))
);

ALTER TABLE "private"."platform_role_assignments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."progressive_clue_reveal_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "clue_index"           integer                  NOT NULL,
  "penalty_points"       integer                  NOT NULL,
  "available_points"     integer                  NOT NULL,
  "revealed_at"          timestamp with time zone NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "progressive_clue_reveal_event_attempt_id_challenge_item_id__key" UNIQUE (attempt_id, challenge_item_id, clue_index),
  CONSTRAINT "progressive_clue_reveal_event_id_attempt_id_challenge_item__key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "progressive_clue_reveal_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "progressive_clue_reveal_events_available_points_check" CHECK ((available_points >= 0)),
  CONSTRAINT "progressive_clue_reveal_events_clue_index_check" CHECK ((clue_index > 0)),
  CONSTRAINT "progressive_clue_reveal_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "progressive_clue_reveal_events_penalty_points_check" CHECK ((penalty_points >= 0)),
  CONSTRAINT "progressive_clue_reveal_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."progressive_clue_reveal_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."queens_placement_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             integer                  NOT NULL,
  "cell"                 integer                  NOT NULL,
  "action"               text                     NOT NULL,
  "conflicting"          boolean                  NOT NULL,
  "penalty_applied"      boolean                  NOT NULL,
  "penalty_points"       integer                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "queens_placement_events_action_check" CHECK ((action = ANY (ARRAY['place'::text, 'remove'::text]))),
  CONSTRAINT "queens_placement_events_attempt_id_challenge_item_id_sequen_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "queens_placement_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "queens_placement_events_cell_check" CHECK (((cell >= 0) AND (cell <= 24))),
  CONSTRAINT "queens_placement_events_check1" CHECK (((NOT penalty_applied) OR ((action = 'place'::text) AND conflicting AND (penalty_points > 0)))),
  CONSTRAINT "queens_placement_events_check2" CHECK ((penalty_applied OR (penalty_points = 0))),
  CONSTRAINT "queens_placement_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "queens_placement_events_id_attempt_id_challenge_item_id_cha_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "queens_placement_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "queens_placement_events_penalty_points_check" CHECK ((penalty_points >= 0)),
  CONSTRAINT "queens_placement_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "queens_placement_events_sequence_check" CHECK ((sequence > 0)),
  CONSTRAINT "queens_placement_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."queens_placement_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."question_definitions" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"                 text                     NOT NULL,
  "created_by_player_id" uuid                     NOT NULL,
  "archived_at"          timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_definitions_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_definitions_slug_check" CHECK ((btrim(slug) <> ''::text)),
  CONSTRAINT "question_definitions_slug_key" UNIQUE (slug)
);

ALTER TABLE "private"."question_definitions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."question_version_solutions" (
  "question_version_id" uuid                     NOT NULL,
  "solution_payload"    jsonb                    NOT NULL,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_version_solutions_pkey" PRIMARY KEY (question_version_id),
  CONSTRAINT "question_version_solutions_solution_payload_check" CHECK ((jsonb_typeof(solution_payload) = 'object'::text))
);

ALTER TABLE "private"."question_version_solutions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."question_versions" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "question_definition_id" uuid                     NOT NULL,
  "version_number"         integer                  NOT NULL,
  "payload_schema_version" integer                  NOT NULL DEFAULT 1,
  "status"                 text                     NOT NULL DEFAULT 'draft'::text,
  "type"                   text                     NOT NULL,
  "time_limit_ms"          integer                  NOT NULL,
  "public_payload"         jsonb                    NOT NULL,
  "created_by_player_id"   uuid                     NOT NULL,
  "published_at"           timestamp with time zone,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "question_versions_check" CHECK (((status = 'draft'::text) = (published_at IS NULL))),
  CONSTRAINT "question_versions_payload_schema_version_check" CHECK ((payload_schema_version > 0)),
  CONSTRAINT "question_versions_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_versions_public_payload_check" CHECK ((jsonb_typeof(public_payload) = 'object'::text)),
  CONSTRAINT "question_versions_question_definition_id_version_number_key" UNIQUE (question_definition_id, version_number),
  CONSTRAINT "question_versions_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
  CONSTRAINT "question_versions_time_limit_ms_check" CHECK ((time_limit_ms > 0)),
  CONSTRAINT "question_versions_type_check" CHECK ((btrim(type) <> ''::text)),
  CONSTRAINT "question_versions_version_number_check" CHECK ((version_number > 0))
);

ALTER TABLE "private"."question_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."room_invitations" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"              uuid                     NOT NULL,
  "created_by_player_id" uuid                     NOT NULL,
  "role"                 text                     NOT NULL,
  "token_hash"           text                     NOT NULL,
  "expires_at"           timestamp with time zone NOT NULL,
  "revoked_at"           timestamp with time zone,
  "max_uses"             integer,
  "use_count"            integer                  NOT NULL DEFAULT 0,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "room_invitations_check1" CHECK (((max_uses IS NULL) OR (use_count <= max_uses))),
  CONSTRAINT "room_invitations_check2" CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
  CONSTRAINT "room_invitations_check" CHECK ((expires_at > created_at)),
  CONSTRAINT "room_invitations_max_uses_check" CHECK ((max_uses > 0)),
  CONSTRAINT "room_invitations_pkey" PRIMARY KEY (id),
  CONSTRAINT "room_invitations_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text, 'spectator'::text]))),
  CONSTRAINT "room_invitations_token_hash_check" CHECK ((btrim(token_hash) <> ''::text)),
  CONSTRAINT "room_invitations_token_hash_key" UNIQUE (token_hash),
  CONSTRAINT "room_invitations_use_count_check" CHECK ((use_count >= 0))
);

ALTER TABLE "private"."room_invitations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "private"."word_search_selection_events" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "attempt_id"           uuid                     NOT NULL,
  "challenge_item_id"    uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "sequence"             integer                  NOT NULL,
  "start_cell"           integer                  NOT NULL,
  "end_cell"             integer                  NOT NULL,
  "matched_target_id"    text,
  "correct"              boolean                  NOT NULL,
  "received_at"          timestamp with time zone NOT NULL,
  "presented_at"         timestamp with time zone NOT NULL,
  "time_used_ms"         bigint                   NOT NULL,
  "idempotency_key"      text                     NOT NULL,
  CONSTRAINT "word_search_selection_events_attempt_id_challenge_item_id_s_key" UNIQUE (attempt_id, challenge_item_id, SEQUENCE),
  CONSTRAINT "word_search_selection_events_attempt_id_idempotency_key_key" UNIQUE (attempt_id, idempotency_key),
  CONSTRAINT "word_search_selection_events_check1" CHECK ((start_cell <> end_cell)),
  CONSTRAINT "word_search_selection_events_check" CHECK ((received_at >= presented_at)),
  CONSTRAINT "word_search_selection_events_end_cell_check" CHECK ((end_cell >= 0)),
  CONSTRAINT "word_search_selection_events_id_attempt_id_challenge_item_i_key" UNIQUE (id, attempt_id, challenge_item_id, challenge_version_id),
  CONSTRAINT "word_search_selection_events_idempotency_key_check" CHECK ((btrim(idempotency_key) <> ''::text)),
  CONSTRAINT "word_search_selection_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "word_search_selection_events_sequence_check" CHECK ((sequence > 0)),
  CONSTRAINT "word_search_selection_events_start_cell_check" CHECK ((start_cell >= 0)),
  CONSTRAINT "word_search_selection_events_time_used_ms_check" CHECK ((time_used_ms >= 0))
);

ALTER TABLE "private"."word_search_selection_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."attempts" (
  "id"                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "player_id"                   uuid                     NOT NULL,
  "scheduled_challenge_id"      uuid                     NOT NULL,
  "challenge_version_id"        uuid                     NOT NULL,
  "attempt_number"              integer                  NOT NULL DEFAULT 1,
  "kind"                        text                     NOT NULL,
  "status"                      text                     NOT NULL DEFAULT 'in_progress'::text,
  "outcome"                     text,
  "started_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "deadline_at"                 timestamp with time zone,
  "completed_at"                timestamp with time zone,
  "score"                       integer,
  "client_state_schema_version" integer                  NOT NULL,
  "lock_version"                bigint                   NOT NULL DEFAULT 1,
  "progress_payload"            jsonb,
  "last_activity_at"            timestamp with time zone,
  "terminal_reason"             text,
  "created_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attempts_attempt_number_check" CHECK ((attempt_number > 0)),
  CONSTRAINT "attempts_check1" CHECK ((deadline_at > started_at)),
  CONSTRAINT "attempts_check2" CHECK (((completed_at IS NULL) OR (completed_at >= started_at))),
  CONSTRAINT "attempts_check3" CHECK ((((status = 'in_progress'::text) AND (completed_at IS NULL) AND (score IS NULL)) OR ((status = 'completed'::text) AND (completed_at IS
    NOT NULL) AND (score IS NOT NULL)) OR ((status = 'abandoned'::text) AND (completed_at IS NOT NULL) AND (score IS NULL)) OR ((status = 'invalidated'::text) AND (completed_at IS
    NOT NULL)))),
  CONSTRAINT "attempts_check4" CHECK (((status = 'in_progress'::text) OR (progress_payload IS NULL))),
  CONSTRAINT "attempts_check" CHECK (((kind <> 'competitive'::text) OR (attempt_number = 1))),
  CONSTRAINT "attempts_client_state_schema_version_check" CHECK ((client_state_schema_version > 0)),
  CONSTRAINT "attempts_id_challenge_version_id_key" UNIQUE (id, challenge_version_id),
  CONSTRAINT "attempts_id_player_id_scheduled_challenge_id_key" UNIQUE (id, player_id, scheduled_challenge_id),
  CONSTRAINT "attempts_kind_check" CHECK ((kind = ANY (ARRAY['competitive'::text, 'test'::text]))),
  CONSTRAINT "attempts_lock_version_check" CHECK ((lock_version > 0)),
  CONSTRAINT "attempts_pkey" PRIMARY KEY (id),
  CONSTRAINT "attempts_player_id_scheduled_challenge_id_kind_attempt_numb_key" UNIQUE (player_id, scheduled_challenge_id, kind, attempt_number),
  CONSTRAINT "attempts_progress_payload_check" CHECK ((jsonb_typeof(progress_payload) = 'object'::text)),
  CONSTRAINT "attempts_score_check" CHECK (((score >= 0) AND (score <= 100))),
  CONSTRAINT "attempts_status_check" CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text, 'invalidated'::text])))
);

ALTER TABLE "public"."attempts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."players" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auth_user_id"  uuid,
  "display_name"  text                     NOT NULL,
  "avatar_path"   text,
  "status"        text                     NOT NULL DEFAULT 'active'::text,
  "anonymized_at" timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "players_auth_user_id_key" UNIQUE (auth_user_id),
  CONSTRAINT "players_check1" CHECK (((status <> 'anonymized'::text) OR ((auth_user_id IS NULL) AND (avatar_path IS NULL)))),
  CONSTRAINT "players_check" CHECK (((status = 'anonymized'::text) = (anonymized_at IS NOT NULL))),
  CONSTRAINT "players_display_name_check" CHECK ((btrim(display_name) <> ''::text)),
  CONSTRAINT "players_pkey" PRIMARY KEY (id),
  CONSTRAINT "players_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'anonymized'::text])))
);

ALTER TABLE "public"."players"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."room_memberships" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"    uuid                     NOT NULL,
  "player_id"  uuid                     NOT NULL,
  "role"       text                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'active'::text,
  "joined_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at"   timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "room_memberships_check1" CHECK (((ended_at IS NULL) OR (ended_at >= joined_at))),
  CONSTRAINT "room_memberships_check2" CHECK (((role <> 'owner'::text) OR (status = 'active'::text))),
  CONSTRAINT "room_memberships_check" CHECK (((status = 'active'::text) = (ended_at IS NULL))),
  CONSTRAINT "room_memberships_pkey" PRIMARY KEY (id),
  CONSTRAINT "room_memberships_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'spectator'::text]))),
  CONSTRAINT "room_memberships_room_id_player_id_key" UNIQUE (room_id, player_id),
  CONSTRAINT "room_memberships_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'left'::text, 'removed'::text, 'banned'::text])))
);

ALTER TABLE "public"."room_memberships"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."rooms" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"        text                     NOT NULL,
  "title"       text                     NOT NULL,
  "description" text                     NOT NULL DEFAULT ''::text,
  "time_zone"   text                     NOT NULL DEFAULT 'Europe/Madrid'::text,
  "status"      text                     NOT NULL DEFAULT 'active'::text,
  "deleted_at"  timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rooms_check" CHECK (((status = 'deleted'::text) = (deleted_at IS NOT NULL))),
  CONSTRAINT "rooms_pkey" PRIMARY KEY (id),
  CONSTRAINT "rooms_slug_check" CHECK ((btrim(slug) <> ''::text)),
  CONSTRAINT "rooms_slug_key" UNIQUE (slug),
  CONSTRAINT "rooms_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'deleted'::text]))),
  CONSTRAINT "rooms_title_check" CHECK ((btrim(title) <> ''::text))
);

ALTER TABLE "public"."rooms"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."scheduled_challenges" (
  "id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "season_id"            uuid                     NOT NULL,
  "challenge_version_id" uuid                     NOT NULL,
  "number"               integer                  NOT NULL,
  "status"               text                     NOT NULL DEFAULT 'scheduled'::text,
  "opens_at"             timestamp with time zone NOT NULL,
  "closes_at"            timestamp with time zone NOT NULL,
  "cancelled_at"         timestamp with time zone,
  "results_locked_at"    timestamp with time zone,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "scheduled_challenges_check1" CHECK (((status = 'cancelled'::text) = (cancelled_at IS NOT NULL))),
  CONSTRAINT "scheduled_challenges_check" CHECK ((opens_at < closes_at)),
  CONSTRAINT "scheduled_challenges_id_challenge_version_id_key" UNIQUE (id, challenge_version_id),
  CONSTRAINT "scheduled_challenges_id_season_id_key" UNIQUE (id, season_id),
  CONSTRAINT "scheduled_challenges_number_check" CHECK ((number > 0)),
  CONSTRAINT "scheduled_challenges_pkey" PRIMARY KEY (id),
  CONSTRAINT "scheduled_challenges_season_id_number_key" UNIQUE (season_id, number),
  CONSTRAINT "scheduled_challenges_status_check" CHECK ((status = ANY (ARRAY['scheduled'::text, 'open'::text, 'closed'::text, 'cancelled'::text])))
);

ALTER TABLE "public"."scheduled_challenges"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."seasons" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "room_id"    uuid                     NOT NULL,
  "title"      text                     NOT NULL,
  "status"     text                     NOT NULL DEFAULT 'draft'::text,
  "starts_at"  timestamp with time zone NOT NULL,
  "ends_at"    timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "seasons_check" CHECK ((starts_at < ends_at)),
  CONSTRAINT "seasons_pkey" PRIMARY KEY (id),
  CONSTRAINT "seasons_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'active'::text, 'finished'::text, 'cancelled'::text]))),
  CONSTRAINT "seasons_title_check" CHECK ((btrim(title) <> ''::text))
);

ALTER TABLE "public"."seasons"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.abandon_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('abandon', input)
$function$;

CREATE OR REPLACE FUNCTION private.abort_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  asset uuid := (input->>'assetId')::uuid;
  row_value private.media_assets%rowtype;
begin
  select * into row_value from private.media_assets
  where id = asset and owner_player_id = actor for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if row_value.status = 'pending' then
    update private.media_assets set status = 'deleted', deleted_at = statement_timestamp()
    where id = asset;
    row_value.status := 'deleted';
  end if;
  return jsonb_build_object('assetId', row_value.id, 'objectPath', row_value.object_path, 'status', row_value.status);
exception when invalid_text_representation then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.abort_question_asset_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); row_value private.media_assets%rowtype;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into row_value from private.media_assets asset where asset.id = (input->>'assetId')::uuid and asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if row_value.status = 'pending' then
    update private.media_assets set status = 'deleted', deleted_at = statement_timestamp() where id = row_value.id;
    row_value.status := 'deleted';
  end if;
  return jsonb_build_object('assetId',row_value.id,'objectPath',row_value.object_path,'status',row_value.status);
exception when invalid_text_representation then raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.accept_invitation (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('accept_invitation', input)
$function$;

CREATE OR REPLACE FUNCTION private.activate_season_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  reason_value text;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  room_status text;
  safe_input jsonb;
  before_payload jsonb;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;
  begin
    season_id_value := (input->>'seasonId')::uuid;
  exception when others then
    raise exception 'invalid_season' using errcode = '22023';
  end;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'activate_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.*
  into season_row
  from public.seasons season
  join public.rooms room on room.id = season.room_id
  where season.id = season_id_value
  for update of season, room;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  select room.status into room_status from public.rooms room where room.id = season_row.room_id;
  if room_status <> 'active' then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if season_row.status = 'active' then
    raise exception 'season_already_active' using errcode = '55000';
  end if;
  if season_row.status <> 'draft' then
    raise exception 'season_not_draft' using errcode = '55000';
  end if;
  if season_row.ends_at <= clock_timestamp() then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;
  if exists (
    select 1 from public.seasons other
    where other.room_id = season_row.room_id and other.status = 'active'
  ) then
    raise exception 'active_season_exists' using errcode = '23505';
  end if;

  before_payload := jsonb_build_object(
    'seasonId', season_row.id,
    'roomId', season_row.room_id,
    'title', season_row.title,
    'status', season_row.status,
    'startsAt', season_row.starts_at,
    'endsAt', season_row.ends_at
  );
  update public.seasons
  set status = 'active'
  where id = season_id_value
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'activate_season', 'season', season_id_value, reason_value, key,
    before_payload, result
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'activate_season', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.add_superadmin_room_member_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text;
  target_room_id uuid;
  target_player_id uuid;
  role_value text;
  reason_value text;
  room_row public.rooms%rowtype;
  target_player public.players%rowtype;
  target_membership public.room_memberships%rowtype;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  before_payload jsonb;
  result jsonb;
  reactivated boolean := false;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomId','targetPlayerId','role','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomId','targetPlayerId','role','reason']))
    or jsonb_typeof(input->'idempotencyKey') is distinct from 'string'
    or jsonb_typeof(input->'roomId') is distinct from 'string'
    or jsonb_typeof(input->'targetPlayerId') is distinct from 'string'
    or jsonb_typeof(input->'role') is distinct from 'string'
    or jsonb_typeof(input->'reason') is distinct from 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  role_value := input->>'role';
  reason_value := btrim(input->>'reason');
  if input->>'roomId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or input->>'targetPlayerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  target_room_id := (input->>'roomId')::uuid;
  target_player_id := (input->>'targetPlayerId')::uuid;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if role_value not in ('admin','member','spectator') then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomId', target_room_id,
    'targetPlayerId', target_player_id,
    'role', role_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-room-member-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'add_superadmin_room_member' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into room_row from public.rooms room
  where room.id = target_room_id and room.status = 'active' for update;
  if not found then raise exception 'room_not_found' using errcode = '42501'; end if;
  select * into target_player from public.players player
  where player.id = target_player_id and player.status = 'active'
    and player.auth_user_id is not null for share;
  if not found then raise exception 'player_not_found' using errcode = '42501'; end if;

  select * into target_membership from public.room_memberships membership
  where membership.room_id = target_room_id and membership.player_id = target_player_id for update;
  if found then
    if target_membership.status = 'active' then
      raise exception 'member_already_active' using errcode = '22023';
    end if;
    if target_membership.status = 'banned' then
      raise exception 'member_banned' using errcode = '42501';
    end if;
    before_payload := jsonb_build_object(
      'playerId', target_player_id, 'role', target_membership.role,
      'status', target_membership.status, 'joinedAt', target_membership.joined_at
    );
    update public.room_memberships
    set role = role_value, status = 'active', joined_at = clock_timestamp(), ended_at = null
    where id = target_membership.id
    returning * into target_membership;
    reactivated := true;
  else
    insert into public.room_memberships (room_id, player_id, role)
    values (target_room_id, target_player_id, role_value)
    returning * into target_membership;
    before_payload := null;
  end if;

  result := jsonb_build_object(
    'roomId', target_room_id,
    'playerId', target_player_id,
    'role', role_value,
    'status', 'active',
    'reactivated', reactivated
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'add_superadmin_room_member', 'room_membership', target_membership.id, reason_value, key,
    before_payload,
    jsonb_build_object('roomId', target_room_id, 'playerId', target_player_id,
      'role', role_value, 'status', 'active', 'reactivated', reactivated)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'add_superadmin_room_member', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.adjust_result (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  attempt_status text;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) = 'object'
    and input->>'attemptId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select attempt.status into attempt_status
    from public.attempts attempt
    where attempt.id = (input->>'attemptId')::uuid;
    if attempt_status is not null and attempt_status not in ('completed', 'abandoned') then
      raise exception 'attempt_not_terminal' using errcode = '55000';
    end if;
  end if;
  return private.execute_command('adjust', input);
end;
$function$;

CREATE OR REPLACE FUNCTION private.archive_question_asset_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := btrim(input->>'idempotencyKey');
  reason text := btrim(input->>'reason');
  target_asset uuid := (input->>'assetId')::uuid;
  asset_row private.media_assets%rowtype;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','reason']))
    or key is null or char_length(key) not between 8 and 160
    or reason is null or char_length(reason) not between 1 and 500 then
    raise exception 'invalid_question_asset_archive' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'assetId', target_asset, 'reason', reason);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-archive:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_question_asset' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into asset_row from private.media_assets asset where asset.id = target_asset and asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status not in ('ready', 'archived') then raise exception 'media_asset_not_archivable' using errcode = '55000'; end if;
  update private.media_assets set status = 'archived', archived_at = statement_timestamp() where id = target_asset;
  result := jsonb_build_object('assetId', target_asset, 'objectPath', asset_row.object_path, 'status', 'archived');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, reason, after_payload)
  values (actor, 'archive_question_asset', 'media_asset', target_asset, key, reason, jsonb_build_object('status','archived'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_question_asset', safe_input, result);
  return result;
exception when invalid_text_representation then
  raise exception 'invalid_question_asset_archive' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.archive_question_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  result jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object' or
    not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'reason'] then raise exception 'invalid_command' using errcode = '22023'; end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id, 'expectedUpdatedAt', expected_updated_at, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'archive_question' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status <> 'published' then raise exception 'content_not_published' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  update private.question_versions set status = 'archived' where id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'archive_question', 'question_version', version_id, reason_value, key,
    jsonb_build_object('status', 'published'), jsonb_build_object('status', 'archived'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'archive_question', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.assert_supported_calendar_content (
  version_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  version_status text;
  version_mode text;
  version_schema integer;
  version_score integer;
  version_config jsonb;
  item_count integer;
  compatible_item_count integer;
  solution_count integer;
  points_total integer;
begin
  select version.status, version.mode, version.config_schema_version, version.max_score, version.mode_config
    into version_status, version_mode, version_schema, version_score, version_config
  from private.challenge_versions version
  where version.id = version_id;

  if not found then
    raise exception 'content_not_found' using errcode = '22023';
  end if;
  if version_status <> 'published' then
    raise exception 'content_not_published' using errcode = '55000';
  end if;
  if version_mode not in ('flash', 'survival', 'pyramid') then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;

  select count(*)::integer,
    count(*) filter (
      where item.position between 1 and 20
        and item.points > 0
        and item.config_schema_version = 1
        and (version_mode = 'pyramid'
          and private.is_valid_pyramid_level_config(item.mode_config)
          or version_mode <> 'pyramid' and item.mode_config = '{}'::jsonb)
        and private.is_supported_flash_question(question.id)
    )::integer,
    coalesce(sum(item.points), 0)::integer
  into item_count, compatible_item_count, points_total
  from private.challenge_items item
  left join private.question_versions question on question.id = item.question_version_id
  where item.challenge_version_id = version_id;

  select count(*)::integer into solution_count
  from private.challenge_items item
  join private.question_version_solutions solution
    on solution.question_version_id = item.question_version_id
  where item.challenge_version_id = version_id;

  if version_schema <> 1 or version_score <> 100
    or (version_mode = 'flash' and version_config <> '{}'::jsonb)
    or (version_mode = 'survival' and (
      (select count(*) from jsonb_object_keys(version_config)) <> 1
      or jsonb_typeof(version_config->'lives') is distinct from 'number'
      or (version_config->>'lives')::numeric <> trunc((version_config->>'lives')::numeric)
      or (version_config->>'lives')::integer not between 1 and item_count
    ))
    or (version_mode = 'pyramid' and (
      version_config <> '{}'::jsonb or item_count <> 7
      or (select count(distinct item.mode_config->>'levelId')
        from private.challenge_items item where item.challenge_version_id = version_id) <> 7
      or exists (select 1 from private.challenge_items item
        where item.challenge_version_id = version_id and item.position not between 1 and 7)
    ))
    or (version_mode <> 'pyramid' and item_count not between 2 and 20)
    or compatible_item_count <> item_count
    or solution_count <> item_count
    or points_total <> 100 then
    raise exception 'unsupported_content' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.can_read_own_attempt (
  target_publication_id uuid,
  target_player_id      uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select target_player_id = (select private.current_player_id()) and exists (
    select 1 from public.scheduled_challenges sc
    join public.seasons s on s.id = sc.season_id
    where sc.id = target_publication_id and private.is_room_member(s.room_id)
  )
$function$;

CREATE OR REPLACE FUNCTION private.can_read_profile (
  target_player_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select target_player_id = (select private.current_player_id()) or exists (
    select 1 from public.room_memberships mine
    join public.room_memberships peer on peer.room_id = mine.room_id
    join public.rooms r on r.id = mine.room_id
    where mine.player_id = (select private.current_player_id()) and mine.status = 'active'
      and peer.player_id = target_player_id and peer.status = 'active' and r.status = 'active'
  )
$function$;

CREATE OR REPLACE FUNCTION private.command_actor()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.current_player_id();
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return actor;
end;
$function$;

CREATE OR REPLACE FUNCTION private.complete_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('complete', input)
$function$;

CREATE OR REPLACE FUNCTION private.confirm_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  asset uuid;
  asset_row private.media_assets%rowtype;
  old_path text;
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  width_value integer := (input->>'width')::integer;
  height_value integer := (input->>'height')::integer;
  hash_value text := lower(btrim(input->>'sha256'));
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  player_row public.players%rowtype;
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']))
    or not input ?& array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']
    or key is null or char_length(key) not between 8 and 160
    or input->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or mime_value not in ('image/jpeg', 'image/png', 'image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 5242880
    or width_value is null or width_value <= 0 or width_value > 2048
    or height_value is null or height_value <= 0 or height_value > 2048
    or hash_value !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_avatar_upload' using errcode = '22023';
  end if;
  asset := (input->>'assetId')::uuid;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'assetId', asset, 'mimeType', mime_value,
    'byteSize', bytes_value, 'width', width_value, 'height', height_value, 'sha256', hash_value
  );

  perform pg_advisory_xact_lock(hashtextextended('avatar-confirm:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'confirm_avatar_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into asset_row from private.media_assets
  where id = asset and owner_player_id = actor for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status <> 'pending' then
    raise exception 'media_asset_not_pending' using errcode = '55000';
  end if;

  select * into player_row from public.players where id = actor and status = 'active' for update;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  old_path := player_row.avatar_path;
  update private.media_assets
  set status = 'ready', mime_type = mime_value, byte_size = bytes_value,
      width = width_value, height = height_value, sha256 = hash_value
  where id = asset;
  update public.players set avatar_path = asset_row.object_path where id = actor;
  update private.media_assets
  set status = 'archived', archived_at = statement_timestamp()
  where owner_player_id = actor and object_path = old_path and id <> asset and status = 'ready';

  result := jsonb_build_object(
    'assetId', asset, 'objectPath', asset_row.object_path, 'oldObjectPath', old_path,
    'profile', jsonb_build_object('playerId', player_row.id, 'name', player_row.display_name,
      'avatarPath', asset_row.object_path)
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
  values (actor, 'confirm_avatar_upload', 'media_asset', asset, key,
    jsonb_build_object('avatarPath', old_path),
    jsonb_build_object('avatarPath', asset_row.object_path, 'byteSize', bytes_value,
      'width', width_value, 'height', height_value, 'mimeType', mime_value));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'confirm_avatar_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.confirm_question_asset_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor(); key text := btrim(input->>'idempotencyKey');
  target_asset uuid := (input->>'assetId')::uuid; asset_row private.media_assets%rowtype;
  mime_value text := input->>'mimeType'; bytes_value bigint := (input->>'byteSize')::bigint;
  width_value integer := (input->>'width')::integer; height_value integer := (input->>'height')::integer;
  hash_value text := lower(btrim(input->>'sha256')); cached private.command_requests%rowtype;
  safe_input jsonb; result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','mimeType','byteSize','width','height','sha256']))
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg','image/png','image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 52428800
    or width_value is null or width_value not between 1 and 8192
    or height_value is null or height_value not between 1 and 8192
    or hash_value !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_question_asset_upload' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey',key,'assetId',target_asset,'mimeType',mime_value,'byteSize',bytes_value,
    'width',width_value,'height',height_value,'sha256',hash_value);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-confirm:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'confirm_question_asset_upload' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into asset_row from private.media_assets row_asset where row_asset.id = target_asset and row_asset.kind = 'question-asset' for update;
  if not found then raise exception 'media_asset_not_found' using errcode = '22023'; end if;
  if asset_row.status <> 'pending' then raise exception 'media_asset_not_pending' using errcode = '55000'; end if;
  update private.media_assets set status = 'ready', mime_type = mime_value, byte_size = bytes_value,
    width = width_value, height = height_value, sha256 = hash_value where id = target_asset;
  result := jsonb_build_object('assetId',target_asset,'objectPath',asset_row.object_path,'status','ready');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'confirm_question_asset_upload', 'media_asset', target_asset, key,
    jsonb_build_object('status','ready','mimeType',mime_value,'byteSize',bytes_value,'width',width_value,'height',height_value));
  insert into private.command_requests(actor_id,idempotency_key,operation,input,result)
  values (actor,key,'confirm_question_asset_upload',safe_input,result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_flash_draft_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  document_hash text;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_definition_id uuid := gen_random_uuid();
  challenge_version_id uuid := gen_random_uuid();
  question_definition_id uuid;
  question_version_id uuid;
  item_id uuid;
  question jsonb;
  question_index integer;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'document', 'reason']))
    or input->'idempotencyKey' is null or input->'document' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(document_value);
  document_hash := encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex');
  safe_input := jsonb_build_object('idempotencyKey', key, 'documentHash', document_hash, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_flash_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  begin
    insert into private.challenge_definitions(id, slug, created_by_player_id)
    values (challenge_definition_id, document_value->'challenge'->>'slug', actor);
    insert into private.challenge_versions(
      id, challenge_definition_id, version_number, config_schema_version, status, mode,
      title, subtitle, description, max_score, global_time_limit_ms, mode_config, created_by_player_id
    ) values (
      challenge_version_id, challenge_definition_id, 1, 1, 'draft', document_value->'challenge'->>'mode',
      document_value->'challenge'->>'title', document_value->'challenge'->>'subtitle',
      document_value->'challenge'->>'description', 100,
      (document_value->'challenge'->>'globalTimeLimitMs')::integer,
      document_value->'challenge'->'modeConfig', actor
    );
    for question, question_index in
      select value, ordinality::integer
      from jsonb_array_elements(document_value->'questions') with ordinality
    loop
      item_id := gen_random_uuid();
      if question->>'source' = 'library' then
        question_version_id := (question->>'questionVersionId')::uuid;
        if not exists (
          select 1 from private.question_versions version
          where version.id = question_version_id and version.status = 'published'
        ) then
          raise exception 'question_not_published' using errcode = '55000';
        end if;
      else
        question_definition_id := gen_random_uuid();
        question_version_id := gen_random_uuid();
        insert into private.question_definitions(id, slug, created_by_player_id)
        values (question_definition_id, question->>'slug', actor);
        insert into private.question_versions(
          id, question_definition_id, version_number, payload_schema_version, status, type,
          time_limit_ms, public_payload, created_by_player_id
        ) values (
          question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
          (question->>'timeLimitMs')::integer, question->'publicPayload', actor
        );
        insert into private.question_version_solutions(question_version_id, solution_payload)
        values (question_version_id, question->'solutionPayload');
      end if;
      insert into private.challenge_items(
        id, challenge_version_id, question_version_id, position, points,
        config_schema_version, mode_config
      ) values (item_id, challenge_version_id, question_version_id, question_index,
        (question->>'points')::integer, 1, coalesce(question->'modeConfig', '{}'::jsonb));
    end loop;
  exception when unique_violation then
    raise exception 'content_slug_conflict' using errcode = '23505';
  end;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = challenge_version_id;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
    ) values (
      actor, 'create_flash_draft', 'challenge_version', challenge_version_id, reason_value, key, null,
    jsonb_build_object(
      'documentHash', document_hash,
      'status', 'draft',
      'questionCount', jsonb_array_length(document_value->'questions'),
      'maxScore', (select coalesce(sum((value->>'points')::integer), 0)
        from jsonb_array_elements(document_value->'questions') value)
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_flash_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_question_draft_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  definition_id uuid;
  version_id uuid := gen_random_uuid();
  next_version integer;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey', 'questionDefinitionId', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'questionDefinitionId', input->'questionDefinitionId',
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'),
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  if input ? 'questionDefinitionId' and input->>'questionDefinitionId' is not null then
    definition_id := (input->>'questionDefinitionId')::uuid;
    perform 1 from private.question_definitions where id = definition_id for update;
    if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
    if (select slug from private.question_definitions where id = definition_id) <> document_value->>'slug' then
      raise exception 'content_slug_conflict' using errcode = '23505';
    end if;
    select coalesce(max(version_number), 0) + 1 into next_version
    from private.question_versions where question_definition_id = definition_id;
  else
    definition_id := gen_random_uuid();
    next_version := 1;
    insert into private.question_definitions(id, slug, created_by_player_id)
    values (definition_id, document_value->>'slug', actor);
  end if;

  insert into private.question_versions(
    id, question_definition_id, version_number, payload_schema_version, status,
    type, time_limit_ms, public_payload, created_by_player_id
  ) values (
    version_id, definition_id, next_version, document_value->>'payloadSchemaVersion', 'draft',
    document_value->>'type', (document_value->>'timeLimitMs')::integer,
    document_value->'publicPayload', actor
  );
  insert into private.question_version_solutions(question_version_id, solution_payload)
  values (version_id, document_value->'solutionPayload');
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    after_payload) values (actor, 'create_question_draft', 'question_version', version_id, reason_value, key, result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_question_draft', safe_input, result);
  return result;
exception when unique_violation then
  raise exception 'content_slug_conflict' using errcode = '23505';
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_room_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  title_value text := btrim(input->>'title');
  description_value text := btrim(input->>'description');
  time_zone_value text := btrim(input->>'timeZone');
  owner_email_value text := lower(btrim(input->>'ownerEmail'));
  reason_value text := btrim(input->>'reason');
  member jsonb;
  normalized_members jsonb;
  normalized_member jsonb;
  normalized_email text;
  owner_id uuid;
  owner_name text;
  member_id uuid;
  member_name text;
  member_ids uuid[] := '{}'::uuid[];
  member_roles text[] := '{}'::text[];
  member_count integer := 0;
  member_index integer;
  audit_members jsonb := '[]'::jsonb;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  audit_payload jsonb;
  slug_base text;
  slug_value text;
  slug_suffix integer := 1;
begin
  if not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','title','description','timeZone','ownerEmail','initialMembers','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','title','description','timeZone','ownerEmail','initialMembers','reason'])
    )
    or input->'idempotencyKey' = 'null'::jsonb
    or input->'title' = 'null'::jsonb
    or input->'description' = 'null'::jsonb
    or input->'timeZone' = 'null'::jsonb
    or input->'ownerEmail' = 'null'::jsonb
    or input->'initialMembers' = 'null'::jsonb
    or input->'reason' = 'null'::jsonb
    or jsonb_typeof(input->'initialMembers') is distinct from 'array' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  if key is null or char_length(key) < 8 or char_length(key) > 160 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(title_value) not between 3 and 80
    or char_length(description_value) > 280
    or char_length(reason_value) = 0 or char_length(reason_value) > 500
    or char_length(owner_email_value) = 0 or char_length(owner_email_value) > 320
    or position('@' in owner_email_value) < 2 then
    raise exception 'invalid_room' using errcode = '22023';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = time_zone_value
  ) then
    raise exception 'invalid_room_timezone' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where jsonb_typeof(member_item) is distinct from 'object'
      or not member_item ?& array['email','role']
      or exists (select 1 from jsonb_object_keys(member_item) key_name
        where key_name <> all(array['email','role']))
      or member_item->'email' = 'null'::jsonb
      or member_item->'role' = 'null'::jsonb
  ) then
    raise exception 'invalid_member' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where member_item->>'role' not in ('admin','member','spectator')
  ) then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;
  if exists (
    select 1
    from (
      select lower(btrim(member_item->>'email')) as email, count(*) as uses
      from jsonb_array_elements(input->'initialMembers') member_item
      group by lower(btrim(member_item->>'email'))
    ) duplicates
    where duplicates.email = '' or duplicates.uses > 1
  ) then
    raise exception 'duplicate_member' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(input->'initialMembers') member_item
    where lower(btrim(member_item->>'email')) = owner_email_value
  ) then
    raise exception 'owner_in_members' using errcode = '22023';
  end if;

  normalized_members := coalesce((
    select jsonb_agg(
      jsonb_build_object('email', lower(btrim(member_item->>'email')), 'role', member_item->>'role')
      order by ordinal
    )
    from jsonb_array_elements(input->'initialMembers') with ordinality members(member_item, ordinal)
  ), '[]'::jsonb);
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'title', title_value,
    'description', description_value,
    'timeZone', time_zone_value,
    'ownerEmail', owner_email_value,
    'initialMembers', normalized_members,
    'reason', reason_value
  );

  perform pg_advisory_xact_lock(hashtextextended('superadmin-room-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_room' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select p.id, p.display_name into owner_id, owner_name
  from auth.users auth_user
  join public.players p on p.auth_user_id = auth_user.id
  where lower(auth_user.email) = owner_email_value and p.status = 'active';
  if not found then
    raise exception 'owner_not_found' using errcode = '22023';
  end if;

  for member in select value from jsonb_array_elements(normalized_members) loop
    normalized_email := member->>'email';
    select p.id, p.display_name into member_id, member_name
    from auth.users auth_user
    join public.players p on p.auth_user_id = auth_user.id
    where lower(auth_user.email) = normalized_email and p.status = 'active';
    if not found then
      raise exception 'member_not_found' using errcode = '22023';
    end if;
    member_ids := array_append(member_ids, member_id);
    member_roles := array_append(member_roles, member->>'role');
    member_count := member_count + 1;
    audit_members := audit_members || jsonb_build_array(
      jsonb_build_object('playerId', member_id, 'role', member->>'role')
    );
  end loop;

  -- A single low-volume namespace lock makes generated slugs deterministic even
  -- when two operators submit the same title concurrently.
  perform pg_advisory_xact_lock(hashtextextended('room-slug-namespace', 0));
  slug_base := coalesce(nullif(private.room_slug_base(title_value), ''), 'sala');
  loop
    slug_value := case when slug_suffix = 1 then slug_base else left(slug_base, 64 - char_length(slug_suffix::text) - 1) || '-' || slug_suffix::text end;
    exit when not exists (select 1 from public.rooms room where room.slug = slug_value);
    slug_suffix := slug_suffix + 1;
  end loop;

  insert into public.rooms (slug, title, description, time_zone, status)
  values (slug_value, title_value, description_value, time_zone_value, 'active')
  returning id into member_id;

  insert into public.room_memberships (room_id, player_id, role)
  values (member_id, owner_id, 'owner');
  if member_count > 0 then
    for member_index in 1..array_length(member_ids, 1) loop
      insert into public.room_memberships (room_id, player_id, role)
      values (member_id, member_ids[member_index], member_roles[member_index]);
    end loop;
  end if;

  result := jsonb_build_object(
    'roomId', member_id,
    'slug', slug_value,
    'title', title_value,
    'timeZone', time_zone_value,
    'owner', jsonb_build_object('playerId', owner_id, 'displayName', owner_name),
    'memberCount', 1 + coalesce(array_length(member_ids, 1), 0)
  );
  audit_payload := jsonb_build_object(
    'roomId', member_id,
    'slug', slug_value,
    'title', title_value,
    'timeZone', time_zone_value,
    'ownerPlayerId', owner_id,
    'initialMembers', audit_members
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_room', 'room', member_id, reason_value, key, null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_room', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_scheduled_challenge_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  challenge_version_id_value uuid;
  number_value integer;
  opens_at_value timestamptz;
  closes_at_value timestamptz;
  reason_value text;
  now_value timestamptz;
  room_id_value uuid;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  result jsonb;
  safe_input jsonb;
  audit_payload jsonb;
  schedule_id uuid;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','challengeVersionId','number','opensAt','closesAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if jsonb_typeof(input->'number') is distinct from 'number'
    or (input->>'number') !~ '^[0-9]+$'
    or char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  begin
    season_id_value := (input->>'seasonId')::uuid;
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    number_value := (input->>'number')::integer;
    opens_at_value := (input->>'opensAt')::timestamptz;
    closes_at_value := (input->>'closesAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if number_value <= 0 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'challengeVersionId', challenge_version_id_value,
    'number', number_value,
    'opensAt', opens_at_value,
    'closesAt', closes_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_scheduled_challenge' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.room_id into room_id_value
  from public.seasons season where season.id = season_id_value;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  perform 1 from public.rooms room where room.id = room_id_value for update;
  if not found then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  select season.* into season_row from public.seasons season
  where season.id = season_id_value for update;
  if season_row.status <> 'active' then
    raise exception 'season_not_active' using errcode = '55000';
  end if;
  if not exists (select 1 from public.rooms room where room.id = room_id_value and room.status = 'active') then
    raise exception 'room_not_found' using errcode = '22023';
  end if;

  now_value := clock_timestamp();
  if opens_at_value >= closes_at_value
    or season_row.starts_at > opens_at_value
    or closes_at_value > season_row.ends_at
    or closes_at_value <= now_value then
    raise exception 'invalid_schedule_dates' using errcode = '22007';
  end if;
  perform private.assert_supported_calendar_content(challenge_version_id_value);

  begin
    insert into public.scheduled_challenges(
      season_id, challenge_version_id, number, status, opens_at, closes_at
    ) values (
      season_id_value, challenge_version_id_value, number_value, 'scheduled', opens_at_value, closes_at_value
    ) returning id into schedule_id;
  exception
    when unique_violation then
      raise exception 'schedule_number_conflict' using errcode = '23505';
    when exclusion_violation then
      raise exception 'schedule_overlap' using errcode = '23P01';
  end;

  select jsonb_build_object(
    'scheduledChallengeId', schedule.id,
    'roomId', season.room_id,
    'seasonId', schedule.season_id,
    'challengeVersionId', schedule.challenge_version_id,
    'number', schedule.number,
    'status', schedule.status,
    'opensAt', schedule.opens_at,
    'closesAt', schedule.closes_at,
    'updatedAt', schedule.updated_at
  ) into result
  from public.scheduled_challenges schedule
  join public.seasons season on season.id = schedule.season_id
  where schedule.id = schedule_id;

  audit_payload := jsonb_build_object(
    'status', 'scheduled', 'number', number_value,
    'opensAt', opens_at_value, 'closesAt', closes_at_value
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_scheduled_challenge', 'scheduled_challenge', schedule_id, reason_value, key,
    null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_scheduled_challenge', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_season_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  room_id_value uuid;
  title_value text;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  reason_value text;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
  audit_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomId','title','startsAt','endsAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomId','title','startsAt','endsAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','roomId','title','startsAt','endsAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  title_value := btrim(input->>'title');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(title_value) not between 3 and 80
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;

  begin
    room_id_value := (input->>'roomId')::uuid;
    starts_at_value := (input->>'startsAt')::timestamptz;
    ends_at_value := (input->>'endsAt')::timestamptz;
  exception when others then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end;
  if starts_at_value >= ends_at_value then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomId', room_id_value,
    'title', title_value,
    'startsAt', starts_at_value,
    'endsAt', ends_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  perform 1 from public.rooms room where room.id = room_id_value and room.status = 'active' for update;
  if not found then
    raise exception 'room_not_found' using errcode = '22023';
  end if;

  insert into public.seasons(room_id, title, status, starts_at, ends_at)
  values (room_id_value, title_value, 'draft', starts_at_value, ends_at_value)
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  audit_payload := result;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'create_season', 'season', (result->>'seasonId')::uuid, reason_value, key,
    null, audit_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_season', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.create_superadmin_player_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text;
  target_auth_user_id uuid;
  display_name_value text;
  reason_value text;
  player_id uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','authUserId','displayName','reason']
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','authUserId','displayName','reason']))
    or jsonb_typeof(input->'idempotencyKey') is distinct from 'string'
    or jsonb_typeof(input->'authUserId') is distinct from 'string'
    or jsonb_typeof(input->'displayName') is distinct from 'string'
    or jsonb_typeof(input->'reason') is distinct from 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  display_name_value := btrim(input->>'displayName');
  reason_value := btrim(input->>'reason');
  if input->>'authUserId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_player' using errcode = '22023';
  end if;
  target_auth_user_id := (input->>'authUserId')::uuid;
  if char_length(key) not between 8 and 160
    or char_length(display_name_value) not between 2 and 24
    or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_player' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = target_auth_user_id) then
    raise exception 'player_not_found' using errcode = '22023';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'authUserId', target_auth_user_id,
    'displayName', display_name_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-user-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'create_superadmin_player' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select player.id into player_id
  from public.players player
  where player.auth_user_id = target_auth_user_id and player.status = 'active'
  for update;
  if found then
    if (select player.display_name from public.players player where player.id = player_id)
      is distinct from display_name_value then
      raise exception 'invalid_player' using errcode = '22023';
    end if;
  else
    insert into public.players (auth_user_id, display_name)
    values (target_auth_user_id, display_name_value)
    returning id into player_id;
  end if;

  result := jsonb_build_object('playerId', player_id, 'displayName', display_name_value);
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'create_superadmin_player', 'player', player_id, reason_value, key, null,
    jsonb_build_object('playerId', player_id, 'displayName', display_name_value)
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'create_superadmin_player', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.current_player_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select p.id from public.players p
  where p.auth_user_id = (select auth.uid()) and p.status = 'active'
    and coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') = 'false'
$function$;

CREATE OR REPLACE FUNCTION private.editorial_has_secret_key (
  value jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case
    when value is null then false
    when jsonb_typeof(value) = 'object' then exists (
      select 1
      from jsonb_each(value) as item(key, nested)
      where item.key in (
        'answer', 'correctAnswer', 'explanation', 'solution', 'solutionPayload', 'tolerance',
        'target', 'fullCreditRadius', 'toleranceRadius'
      )
        or private.editorial_has_secret_key(item.nested)
    )
    when jsonb_typeof(value) = 'array' then exists (
      select 1 from jsonb_array_elements(value) as item(nested)
      where private.editorial_has_secret_key(item.nested)
    )
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION private.ensure_progressive_clue_initial (
  target_attempt uuid,
  target_item    uuid,
  target_version uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  instant timestamptz := clock_timestamp();
begin
  select * into item from private.challenge_items where id = target_item and challenge_version_id = target_version;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' then return; end if;

  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  )
  values(
    target_attempt, target_item, target_version, 1, 0, item.points, instant,
    'prepare-progressive-clue:' || target_attempt || ':' || target_item
  )
  on conflict (attempt_id, challenge_item_id, clue_index) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION private.escape_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  grid jsonb := public_payload->'grid';
  blocks jsonb := public_payload->'initialBlocks';
  reference jsonb := solution_payload->'referenceSolution';
  ids text[] := '{}';
  kinds text[] := '{}';
  orientations text[] := '{}';
  rows integer[] := '{}';
  columns integer[] := '{}';
  lengths integer[] := '{}';
  occupied integer[] := '{}';
  target_index integer := null;
  exit_row integer;
  block jsonb;
  move jsonb;
  index integer;
  block_index integer;
  step_offset integer;
  position integer;
  cell integer;
  row_value integer;
  column_value integer;
  length_value integer;
  move_from integer;
  move_to integer;
  current_position integer;
  maximum_position integer;
  candidate_row integer;
  candidate_column integer;
  target_id text;
  kind_value text;
  orientation_value text;
  block_id text;
  collision boolean;
  target_column integer;
  optimal_moves integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'initialBlocks']
    or not solution_payload ?& array['referenceSolution', 'optimalMoves']
    or jsonb_typeof(grid) is distinct from 'object'
    or jsonb_typeof(grid->'rows') is distinct from 'number'
    or jsonb_typeof(grid->'columns') is distinct from 'number'
    or jsonb_typeof(grid->'exit') is distinct from 'object'
    or (grid->>'rows')::numeric <> 6
    or (grid->>'columns')::numeric <> 6
    or grid->'exit'->>'side' <> 'right'
    or jsonb_typeof(grid->'exit'->'row') is distinct from 'number'
    or (grid->'exit'->>'row')::numeric <> trunc((grid->'exit'->>'row')::numeric)
    or jsonb_typeof(blocks) is distinct from 'array'
    or jsonb_array_length(blocks) = 0
    or jsonb_typeof(reference) is distinct from 'array'
    or jsonb_typeof(solution_payload->'optimalMoves') is distinct from 'number'
    or (solution_payload->>'optimalMoves')::numeric <> trunc((solution_payload->>'optimalMoves')::numeric)
    or (solution_payload->>'optimalMoves')::integer <= 0 then
    return false;
  end if;

  exit_row := (grid->'exit'->>'row')::integer;
  if exit_row not between 0 and 5
    or jsonb_array_length(reference) <> (solution_payload->>'optimalMoves')::integer then
    return false;
  end if;
  optimal_moves := (solution_payload->>'optimalMoves')::integer;

  for block, index in
    select value, ordinality::integer from jsonb_array_elements(blocks) with ordinality
  loop
    if jsonb_typeof(block) is distinct from 'object'
      or not block ?& array['id', 'kind', 'orientation', 'row', 'column', 'length']
      or exists (select 1 from jsonb_object_keys(block) key_name where key_name <> all(array[
        'id', 'kind', 'orientation', 'row', 'column', 'length', 'label', 'symbol'
      ]))
      or jsonb_typeof(block->'id') is distinct from 'string'
      or btrim(block->>'id') = ''
      or jsonb_typeof(block->'kind') is distinct from 'string'
      or block->>'kind' not in ('target', 'obstacle')
      or jsonb_typeof(block->'orientation') is distinct from 'string'
      or block->>'orientation' not in ('horizontal', 'vertical')
      or jsonb_typeof(block->'row') is distinct from 'number'
      or (block->>'row')::numeric <> trunc((block->>'row')::numeric)
      or jsonb_typeof(block->'column') is distinct from 'number'
      or (block->>'column')::numeric <> trunc((block->>'column')::numeric)
      or jsonb_typeof(block->'length') is distinct from 'number'
      or (block->>'length')::numeric <> trunc((block->>'length')::numeric)
      or (block->>'length')::integer not in (2, 3)
      or (block ? 'label' and (jsonb_typeof(block->'label') is distinct from 'string'
        or char_length(block->>'label') > 500))
      or (block ? 'symbol' and (jsonb_typeof(block->'symbol') is distinct from 'string'
        or char_length(block->>'symbol') > 32)) then
      return false;
    end if;

    block_id := btrim(block->>'id');
    kind_value := block->>'kind';
    orientation_value := block->>'orientation';
    row_value := (block->>'row')::integer;
    column_value := (block->>'column')::integer;
    length_value := (block->>'length')::integer;
    if block_id = any(ids)
      or row_value < 0
      or column_value < 0
      or row_value + (case when orientation_value = 'vertical' then length_value else 1 end) > 6
      or column_value + (case when orientation_value = 'horizontal' then length_value else 1 end) > 6 then
      return false;
    end if;

    ids := ids || block_id;
    kinds := kinds || kind_value;
    orientations := orientations || orientation_value;
    rows := rows || row_value;
    columns := columns || column_value;
    lengths := lengths || length_value;
    if kind_value = 'target' then
      if target_index is not null then return false; end if;
      target_index := index;
      if orientation_value <> 'horizontal' or row_value <> exit_row then return false; end if;
    end if;

    for step_offset in 0..length_value - 1 loop
      cell := (row_value + case when orientation_value = 'vertical' then step_offset else 0 end) * 6
        + column_value + case when orientation_value = 'horizontal' then step_offset else 0 end;
      if cell = any(occupied) then return false; end if;
      occupied := occupied || cell;
    end loop;
  end loop;

  if target_index is null then return false; end if;
  target_column := columns[target_index];
  if target_column = 6 - lengths[target_index] then return false; end if;

  for move in select value from jsonb_array_elements(reference) loop
    if jsonb_typeof(move) is distinct from 'object'
      or not move ?& array['blockId', 'from', 'to']
      or exists (select 1 from jsonb_object_keys(move) key_name where key_name <> all(array['blockId', 'from', 'to']))
      or jsonb_typeof(move->'blockId') is distinct from 'string'
      or jsonb_typeof(move->'from') is distinct from 'number'
      or jsonb_typeof(move->'to') is distinct from 'number'
      or (move->>'from')::numeric <> trunc((move->>'from')::numeric)
      or (move->>'to')::numeric <> trunc((move->>'to')::numeric) then
      return false;
    end if;

    block_id := move->>'blockId';
    block_index := array_position(ids, block_id);
    if block_index is null then return false; end if;
    move_from := (move->>'from')::integer;
    move_to := (move->>'to')::integer;
    current_position := case when orientations[block_index] = 'horizontal'
      then columns[block_index] else rows[block_index] end;
    maximum_position := 6 - lengths[block_index];
    if move_from <> current_position
      or move_to = move_from
      or move_to not between 0 and maximum_position then
      return false;
    end if;

    collision := false;
    for position in least(move_from, move_to)..greatest(move_from, move_to) + lengths[block_index] - 1 loop
      candidate_row := case when orientations[block_index] = 'horizontal' then rows[block_index] else position end;
      candidate_column := case when orientations[block_index] = 'horizontal' then position else columns[block_index] end;
      for index in 1..coalesce(array_length(ids, 1), 0) loop
        if index <> block_index then
          for step_offset in 0..lengths[index] - 1 loop
            cell := (rows[index] + case when orientations[index] = 'vertical' then step_offset else 0 end) * 6
              + columns[index] + case when orientations[index] = 'horizontal' then step_offset else 0 end;
            if cell = candidate_row * 6 + candidate_column then collision := true; end if;
          end loop;
        end if;
      end loop;
    end loop;
    if collision then return false; end if;
    if orientations[block_index] = 'horizontal' then columns[block_index] := move_to;
    else rows[block_index] := move_to;
    end if;
  end loop;

  return rows[target_index] = exit_row and columns[target_index] = 6 - lengths[target_index];
end;
$function$;

CREATE OR REPLACE FUNCTION private.execute_command (
  op    text,
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  received timestamptz := clock_timestamp();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  outcome jsonb;
  result jsonb;
  allowed text[];
  required text[];
begin
  case op
    when 'start' then
      allowed := array['idempotencyKey','scheduledChallengeId','sessionToken']; required := allowed;
    when 'takeover' then
      allowed := array['idempotencyKey','attemptId','lockVersion','newSessionToken']; required := allowed;
    when 'prepare' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'receive' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','answer'];
      allowed := required || array['clientTimeUsedMs'];
    when 'pass' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']; required := allowed;
    when 'evaluate' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','receiptId','status','points'];
      allowed := required || array['resultDetails'];
    when 'complete' then
      required := array['idempotencyKey','attemptId','lockVersion','sessionToken','score'];
      allowed := required || array['outcome'];
    when 'abandon' then
      allowed := array['idempotencyKey','attemptId','lockVersion','sessionToken']; required := allowed;
    when 'accept_invitation' then
      allowed := array['idempotencyKey','invitationToken']; required := allowed;
    when 'invalidate' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason']; required := allowed;
    when 'adjust' then
      allowed := array['idempotencyKey','attemptId','lockVersion','reason','score']; required := allowed;
    else raise exception 'unknown_command' using errcode = '22023';
  end case;
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& required or exists (select 1 from jsonb_object_keys(input) k where not k = any(allowed))
    or exists (select 1 from unnest(required) k where k <> 'answer' and input->k = 'null'::jsonb) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  -- Never persist reusable secrets, including in idempotency records or audit payloads.
  if input ? 'sessionToken' then safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken'))); end if;
  if input ? 'newSessionToken' then safe_input := jsonb_set(safe_input, '{newSessionToken}', to_jsonb(private.secret_hash(input->>'newSessionToken'))); end if;
  if input ? 'invitationToken' then safe_input := jsonb_set(safe_input, '{invitationToken}', to_jsonb(private.secret_hash(input->>'invitationToken'))); end if;
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> op or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if op = 'accept_invitation' then
    outcome := private.handle_invitation_command(input, safe_input, actor, cached.result);
  else
    outcome := private.handle_attempt_command(op, input, safe_input, actor, cached.result, received);
  end if;
  result := outcome->'result';
  if coalesce((outcome->>'replayed')::boolean, false) then return result; end if;

  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, op, outcome->>'entityType', (outcome->>'entityId')::uuid, input->>'reason', key,
    nullif(outcome->'beforePayload', 'null'::jsonb),
    -- Avoid persisting playable payloads or free-text answers into a second store.
    result - 'publicPayload');
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, op, safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_answer()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare a public.attempts%rowtype; item_points integer; r private.answer_receipts%rowtype;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.status is distinct from 'in_progress' then raise exception 'Attempt is not in progress'; end if;
  select * into r from private.answer_receipts where id = new.receipt_id;
  if not found or (r.attempt_id, r.challenge_item_id, r.challenge_version_id) is distinct from
    (new.attempt_id, new.challenge_item_id, new.challenge_version_id) then
    raise exception 'A final answer requires its immutable receipt';
  end if;
  new.presented_at := r.presented_at;
  new.submitted_at := r.effective_submitted_at;
  new.time_used_ms := r.time_used_ms;
  new.answer := r.answer;
  -- Late timeout finalization uses the previously recorded reception, not evaluation time.
  if new.presented_at < a.started_at or new.presented_at > a.deadline_at
    or (new.submitted_at is not null and new.submitted_at > a.deadline_at) then
    raise exception 'Answer timestamps outside attempt deadline';
  end if;
  if exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
    raise exception 'Publication cancelled';
  end if;
  select points into item_points from private.challenge_items where id = new.challenge_item_id;
  if new.points > item_points then raise exception 'Points exceed item allocation'; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_attempt()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'in_progress' then raise exception 'An attempt must start in progress'; end if;
    new.started_at := clock_timestamp();
    -- Derive the global clock from the exact persisted start, including very short limits.
    -- Other modes have only question/level clocks; never accept a caller's global deadline.
    select case when cv.mode = 'alphabet' then
      new.started_at + cv.global_time_limit_ms * interval '1 millisecond' else null end
      into new.deadline_at from private.challenge_versions cv where cv.id = new.challenge_version_id;
    if new.kind = 'competitive' then
      if exists (select 1 from private.platform_role_assignments where player_id = new.player_id) then
        raise exception 'Superadministrators only create test attempts';
      end if;
      perform 1 from public.scheduled_challenges sc
        join public.seasons s on s.id = sc.season_id
        join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id and m.player_id = new.player_id
        join public.players p on p.id = m.player_id
        where sc.id = new.scheduled_challenge_id
          and private.publication_is_effectively_open(
            sc.status, s.status, s.starts_at, s.ends_at,
            sc.opens_at, sc.closes_at, new.started_at
          )
          and r.status = 'active'
          and m.status = 'active' and m.role in ('owner', 'admin', 'member')
          and p.status = 'active' and p.auth_user_id is not null
        for share of sc, s, r, m, p;
      if not found then raise exception 'No competitive access or publication unavailable'; end if;
    else
      if not exists (select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
        where x.player_id = new.player_id and p.status = 'active' and p.auth_user_id is not null) then
        raise exception 'Test attempts require a superadministrator';
      end if;
    end if;
    return new;
  end if;
  if (new.id, new.player_id, new.scheduled_challenge_id, new.challenge_version_id, new.kind,
      new.attempt_number, new.started_at, new.deadline_at) is distinct from
     (old.id, old.player_id, old.scheduled_challenge_id, old.challenge_version_id, old.kind,
      old.attempt_number, old.started_at, old.deadline_at) then
    raise exception 'Attempt context is immutable';
  end if;
  if new.lock_version <> old.lock_version + 1 then raise exception 'Expected next lock_version'; end if;
  if old.status <> 'in_progress' then
    if new.status = old.status and (to_jsonb(new) - 'lock_version' - 'updated_at') =
      (to_jsonb(old) - 'lock_version' - 'updated_at') then return new; end if;
    if old.status not in ('completed', 'abandoned') or new.status <> 'invalidated'
      or (to_jsonb(new) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') <>
         (to_jsonb(old) - 'status' - 'terminal_reason' - 'lock_version' - 'updated_at') then
      raise exception 'Terminal attempts cannot be replayed or overwritten';
    end if;
  elsif new.status = 'invalidated' then
    raise exception 'Complete or abandon before administrative invalidation';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_content_child()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare parent_id uuid; parent_status text;
begin
  if tg_table_name = 'challenge_items' then
    parent_id := coalesce(new.challenge_version_id, old.challenge_version_id);
    if tg_op = 'UPDATE' and (new.id, new.challenge_version_id) is distinct from (old.id, old.challenge_version_id) then
      raise exception 'Item identity and parent are immutable';
    end if;
    select status into parent_status from private.challenge_versions where id = parent_id for update;
  else
    parent_id := coalesce(new.question_version_id, old.question_version_id);
    if tg_op = 'UPDATE' and new.question_version_id <> old.question_version_id then
      raise exception 'Solution parent is immutable';
    end if;
    select status into parent_status from private.question_versions where id = parent_id for update;
  end if;
  if parent_status is distinct from 'draft' then raise exception 'Published children are immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_player()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.id <> old.id then raise exception 'Player identity is immutable'; end if;
  if old.status = 'anonymized' and new is distinct from old then
    raise exception 'Anonymized player cannot be restored by an ordinary update';
  end if;
  if (old.auth_user_id is not null and new.auth_user_id is null) or new.status = 'anonymized' then
    new.auth_user_id := null;
    new.display_name := 'Participante anonimizado';
    new.avatar_path := null;
    new.status := 'anonymized';
    new.anonymized_at := coalesce(old.anonymized_at, statement_timestamp());
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_point_entry()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare a public.attempts%rowtype; balance bigint; has_accreditation boolean;
begin
  select * into a from public.attempts where id = new.attempt_id for update;
  if a.kind is distinct from 'competitive' then raise exception 'Only competitive attempts earn points'; end if;
  select coalesce(sum(amount), 0), coalesce(bool_or(entry_type = 'accreditation'), false)
    into balance, has_accreditation from private.flash_point_entries where attempt_id = new.attempt_id;
  if new.entry_type = 'accreditation' then
    if a.status <> 'completed' or new.amount <> a.score or has_accreditation
      or exists (select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled') then
      raise exception 'Invalid initial accreditation';
    end if;
  else
    if not has_accreditation or not exists (
      select 1 from private.platform_role_assignments x join public.players p on p.id = x.player_id
      where x.player_id = new.created_by_player_id and p.status = 'active' and p.auth_user_id is not null
    ) then raise exception 'A correction requires accreditation and an active superadministrator'; end if;
    if new.entry_type = 'adjustment' and (a.status <> 'completed' or exists (
      select 1 from public.scheduled_challenges where id = a.scheduled_challenge_id and status = 'cancelled'
    )) then raise exception 'Only eligible results may be adjusted'; end if;
  end if;
  if balance + new.amount not between 0 and 100 then raise exception 'Effective points must stay between 0 and 100'; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_publication()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.season_id) is distinct from (old.id, old.season_id) then
      raise exception 'Publication identity and season are immutable';
    end if;
    if old.status <> 'scheduled' or statement_timestamp() >= old.opens_at then
      if (to_jsonb(new) - 'status' - 'cancelled_at' - 'results_locked_at' - 'updated_at') <>
        (to_jsonb(old) - 'status' - 'cancelled_at' - 'results_locked_at' - 'updated_at') then
        raise exception 'Only future scheduled publications may be reprogrammed';
      end if;
    end if;
    if old.status in ('closed', 'cancelled') and new.status not in (old.status, 'cancelled') then
      raise exception 'A terminal publication cannot reopen';
    end if;
    if old.status = 'open' and new.status not in ('open', 'closed', 'cancelled') then
      raise exception 'An open publication cannot return to scheduled';
    end if;
  end if;
  if tg_op = 'INSERT' or new.challenge_version_id is distinct from old.challenge_version_id then
    perform 1 from private.challenge_versions where id = new.challenge_version_id and status = 'published' for share;
    if not found then raise exception 'A publication requires a published challenge version'; end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_room()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'UPDATE' and new.id <> old.id then raise exception 'Room identity is immutable'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown time zone';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_season()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if (new.id, new.room_id) is distinct from (old.id, old.room_id) then
    raise exception 'Season identity and room are immutable';
  end if;
  if old.status in ('finished', 'cancelled') and new is distinct from old then
    raise exception 'Terminal seasons are immutable; corrections require a dedicated audited operation';
  end if;
  if old.status <> 'draft' and (new.title, new.starts_at, new.ends_at) is distinct from
    (old.title, old.starts_at, old.ends_at) then
    raise exception 'Only draft seasons may change their configuration';
  end if;
  if old.status = 'active' and new.status not in ('active', 'finished', 'cancelled') then
    raise exception 'An active season cannot return to preparation';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.guard_version()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then raise exception 'Create a draft before publishing'; end if;
    return new;
  end if;
  if old.status <> 'draft' then
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'archived'
      and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      return new;
    end if;
    raise exception 'Published content is immutable; create another version';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.id <> old.id then raise exception 'Version identity is immutable'; end if;
  if new.status = 'archived' then raise exception 'Publish before archiving a version'; end if;
  if new.status = 'published' then
    if tg_table_name = 'question_versions' then
      if not exists (select 1 from private.question_version_solutions where question_version_id = new.id) then
        raise exception 'A published question requires a solution';
      end if;
    else
      perform 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id for share of q;
      if (select coalesce(sum(points), 0) from private.challenge_items where challenge_version_id = new.id) <> 100 then
        raise exception 'Challenge items must sum to 100 points';
      end if;
      if exists (select 1 from private.challenge_items i join private.question_versions q on q.id = i.question_version_id
        where i.challenge_version_id = new.id and q.status <> 'published') then
        raise exception 'Publish every question before its challenge';
      end if;
    end if;
    new.published_at := statement_timestamp();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_admin_command (
  op              text,
  input           jsonb,
  actor           uuid,
  target_attempt  public.attempts,
  target_schedule public.scheduled_challenges,
  instant         timestamp with time zone,
  key             text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  a public.attempts%rowtype := target_attempt;
  sc public.scheduled_challenges%rowtype := target_schedule;
  balance integer;
  points integer;
  result jsonb;
begin
        if nullif(btrim(input->>'reason'), '') is null then raise exception 'reason_required' using errcode = '22023'; end if;
        if a.kind <> 'competitive' then raise exception 'not_competitive' using errcode = '55000'; end if;
        select coalesce(sum(amount),0)::integer into balance from private.flash_point_entries where attempt_id = a.id;
        if op = 'invalidate' then
          if a.status not in ('completed','abandoned') then raise exception 'attempt_not_terminal' using errcode = '55000'; end if;
          update public.attempts set status = 'invalidated', terminal_reason = input->>'reason', lock_version = lock_version + 1
            where id = a.id returning * into a;
          update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
          if exists (select 1 from private.flash_point_entries where attempt_id = a.id and entry_type = 'accreditation') then
            insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
              amount, reason, created_by_player_id, idempotency_key)
            values(sc.season_id, a.player_id, sc.id, a.id, 'reversal', -balance, input->>'reason', actor, 'invalidate:' || a.id);
          end if;
          result := jsonb_build_object('status', a.status, 'effectiveScore', 0);
        else
          if a.status not in ('completed','abandoned') then
            raise exception 'attempt_not_terminal' using errcode = '55000';
          end if;
          points := (input->>'score')::integer;
          if points not between 0 and 100 then raise exception 'invalid_score' using errcode = '22023'; end if;
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
            amount, reason, created_by_player_id, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'adjustment', points - balance, input->>'reason', actor, 'adjust:' || actor || ':' || key);
          update public.attempts set lock_version = lock_version + 1 where id = a.id returning * into a;
          -- Corrections preserve the immutable original score/status.
          result := jsonb_build_object('status', a.status, 'effectiveScore', points);
        end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_attempt_command (
  op            text,
  input         jsonb,
  safe_input    jsonb,
  actor         uuid,
  cached_result jsonb,
  received_at   timestamp with time zone
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  instant timestamptz;
  received timestamptz := received_at;
  key text := input->>'idempotencyKey';
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  unit private.attempt_timing_units%rowtype;
  segment private.interaction_intervals%rowtype;
  receipt private.answer_receipts%rowtype;
  session_row private.attempt_sessions%rowtype;
  item private.challenge_items%rowtype;
  result jsonb;
  previous jsonb;
  target uuid;
  expected bigint;
  points integer;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  resumed boolean := false;
  control_required boolean := false;
  is_admin boolean;
  clear_progress boolean := false;
  target_status text;
  completion_outcome text;
  survival_lives integer;
  survival_mistakes integer;
  survival_resolved integer;
  survival_total integer;
  pyramid_resolved integer;
  pyramid_total integer;
begin
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if op = 'start' then
    target := (input->>'scheduledChallengeId')::uuid;
    perform pg_advisory_xact_lock(hashtextextended('flash-start:' || actor || ':' || target, 0));
    if is_admin then raise exception 'competitive_access_denied' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = target for share;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    if not exists (select 1 from public.seasons s join public.rooms r on r.id = s.room_id
      join public.room_memberships m on m.room_id = r.id
      where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
        and m.status = 'active' and m.role in ('owner','admin','member')) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    select * into a from public.attempts where player_id = actor and scheduled_challenge_id = target and kind = 'competitive' for update;
    if cached_result is not null then return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    if found then
      if a.status <> 'in_progress' then raise exception 'attempt_terminal' using errcode = '55000'; end if;
      resumed := true;
      select * into session_row from private.attempt_sessions where attempt_id = a.id and revoked_at is null;
      control_required := session_row.session_token_hash is distinct from safe_input->>'sessionToken';
    else
      insert into public.attempts(player_id, scheduled_challenge_id, challenge_version_id, kind, client_state_schema_version)
      values(actor, target, sc.challenge_version_id, 'competitive', 1)
      returning * into a;
      insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
        values(a.id, safe_input->>'sessionToken', a.deadline_at) returning * into session_row;
    end if;
    target := a.id;
    result := jsonb_build_object('attemptId', a.id, 'sessionId', session_row.id, 'resumed', resumed,
      'controlRequired', control_required, 'deadlineAt', a.deadline_at, 'lockVersion', a.lock_version);
  else
    target := (input->>'attemptId')::uuid;
    select * into a from public.attempts where id = target for update;
    if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
    select * into sc from public.scheduled_challenges where id = a.scheduled_challenge_id for share;
    select * into cv from private.challenge_versions where id = a.challenge_version_id;
    if op not in ('invalidate','adjust') then
      if a.player_id <> actor or a.kind <> 'competitive' or is_admin or not exists (
        select 1 from public.seasons s join public.rooms r on r.id = s.room_id
        join public.room_memberships m on m.room_id = r.id
        where s.id = sc.season_id and r.status = 'active' and m.player_id = actor
          and m.status = 'active' and m.role in ('owner','admin','member')
      ) then raise exception 'not_authorized' using errcode = '42501'; end if;
      if op <> 'takeover' then
        select * into session_row from private.attempt_sessions where attempt_id = a.id
          and session_token_hash = safe_input->>'sessionToken';
        if not found or (session_row.revoked_at is not null and not (
          op in ('complete','abandon') and cached_result is not null and a.status in ('completed','abandoned')
        )) then raise exception 'session_revoked' using errcode = '42501'; end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached_result is not null then return jsonb_build_object(
        'result', cached_result,
        'entityType', 'attempt',
        'entityId', a.id,
        'beforePayload', null,
        'replayed', true
      ); end if;
    expected := (input->>'lockVersion')::bigint;
    if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
    if op not in ('invalidate','adjust') and a.status <> 'in_progress' then
      raise exception 'attempt_terminal' using errcode = '55000';
    end if;
    if op not in ('invalidate','adjust','abandon') and sc.status = 'cancelled' then
      raise exception 'publication_cancelled' using errcode = '55000';
    end if;
    previous := jsonb_build_object('status', a.status, 'lockVersion', a.lock_version, 'score', a.score);
    instant := clock_timestamp();
    case op
      when 'takeover' then
        if a.deadline_at is not null and instant >= a.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        insert into private.attempt_sessions(attempt_id, session_token_hash, expires_at)
          values(a.id, safe_input->>'newSessionToken', a.deadline_at) returning * into session_row;
        result := jsonb_build_object('sessionId', session_row.id, 'deadlineAt', a.deadline_at);
      when 'prepare' then
        if cv.mode = 'pyramid' and exists (
          select 1 from private.attempt_answers answer
          where answer.attempt_id = a.id and answer.status <> 'correct'
        ) then
          raise exception 'pyramid_level_failed' using errcode = '55000';
        end if;
        if exists (select 1 from private.answer_receipts r where r.attempt_id = a.id and not exists (
          select 1 from private.attempt_answers aa where aa.receipt_id = r.id
        )) then raise exception 'evaluation_pending' using errcode = '55000'; end if;
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if found then
          select * into item from private.challenge_items where id = segment.challenge_item_id;
          select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        else
          select * into item from private.challenge_items where id = private.next_attempt_item(a.id);
          if not found then raise exception 'no_pending_item' using errcode = '55000'; end if;
          select * into unit from private.attempt_timing_units where attempt_id = a.id and challenge_item_id = item.id;
          if not found then
            insert into private.attempt_timing_units(attempt_id, challenge_version_id, challenge_item_id, scope, started_at, deadline_at)
            select a.id, a.challenge_version_id, item.id,
              case cv.mode when 'alphabet' then 'attempt' when 'pyramid' then 'level' else 'question' end,
              case when cv.mode = 'alphabet' then a.started_at else instant end,
              case when cv.mode = 'alphabet' then a.deadline_at else instant + q.time_limit_ms * interval '1 millisecond' end
            from private.question_versions q where q.id = item.question_version_id returning * into unit;
          end if;
          insert into private.interaction_intervals(attempt_id, challenge_item_id, timing_unit_id, started_at)
            values(a.id, item.id, unit.id, least(instant, unit.deadline_at)) returning * into segment;
        end if;
        perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
        select jsonb_build_object('challengeItemId', item.id, 'questionType', q.type,
          'payloadSchemaVersion', q.payload_schema_version,
          'publicPayload', case
            when instant >= unit.deadline_at then null
            when q.type = 'progressive-clues' then private.progressive_clues_public_payload(item.id)
            when q.type = 'matching' then private.matching_public_payload(item.id)
            else q.public_payload
          end,
          'presentedAt', segment.started_at, 'deadlineAt', unit.deadline_at, 'timedOut', instant >= unit.deadline_at,
          'progress', case
            when q.type = 'mini-wordle' then private.mini_wordle_progress(a.id, item.id)
            when q.type = 'logic-code' then private.logic_code_progress(a.id, item.id)
            when q.type = 'progressive-clues' then private.progressive_clues_progress(a.id, item.id)
            when q.type = 'matching' then private.matching_progress(a.id, item.id)
            when q.type = 'queens' then private.queens_progress(a.id, item.id)
            when q.type = 'word-search' then private.word_search_progress(a.id, item.id)
            when q.type = 'word-hashtag' then private.word_hashtag_progress(a.id, item.id) - 'solved'
            when q.type = 'short-text' and cv.mode = 'alphabet' then (
              select jsonb_build_object(
                'kind', 'alphabet',
                'round', greatest(1, 1 + floor((
                  (select count(*) from private.interaction_intervals interval_row
                    where interval_row.attempt_id = a.id)::numeric /
                  nullif((select count(*) from private.challenge_items round_item
                    where round_item.challenge_version_id = a.challenge_version_id)::numeric, 0)
                ))::integer),
                'currentIndex', item.position - 1,
                'playedCount', (select count(distinct interval_row.challenge_item_id)::integer
                  from private.interaction_intervals interval_row
                  where interval_row.attempt_id = a.id),
                'correctAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'incorrectAnswers', (select count(*)::integer from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'incorrect'),
                'elapsedTimeMs', coalesce((select sum(floor(extract(epoch from
                  (interval_row.ended_at - interval_row.started_at)) * 1000))::bigint
                  from private.interaction_intervals interval_row where interval_row.attempt_id = a.id), 0)::bigint,
                'deadlineAt', a.deadline_at,
                'lastCorrectAt', (select max(answer_row.submitted_at) from private.attempt_answers answer_row
                  where answer_row.attempt_id = a.id and answer_row.status = 'correct'),
                'letters', coalesce((select jsonb_agg(jsonb_build_object(
                  'letter', all_item.mode_config->>'letter',
                  'challengeItemId', all_item.id,
                  'status', case
                    when answer_row.status is not null then answer_row.status
                    when exists (select 1 from private.interaction_intervals open_interval
                      where open_interval.attempt_id = a.id and open_interval.challenge_item_id = all_item.id
                        and open_interval.ended_at is null) then 'active'
                    when exists (select 1 from private.interaction_intervals visited
                      where visited.attempt_id = a.id and visited.challenge_item_id = all_item.id) then 'passed'
                    else 'unvisited' end,
                  'answer', case when answer_row.answer is null then null
                    else answer_row.answer #>> '{}' end
                ) order by all_item.position)
                  from private.challenge_items all_item
                  left join private.attempt_answers answer_row
                    on answer_row.attempt_id = a.id and answer_row.challenge_item_id = all_item.id
                  where all_item.challenge_version_id = a.challenge_version_id), '[]'::jsonb)
              )
            )
            else null end)
          into result from private.question_versions q where q.id = item.question_version_id;
      when 'receive', 'pass' then
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
          raise exception 'interaction_not_presented' using errcode = '55000';
        end if;
        select * into item from private.challenge_items where id = segment.challenge_item_id;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'mini-wordle'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'mini_wordle_requires_guess_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'logic-code'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'logic_code_requires_attempt_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'queens'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'queens_requires_placement_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'matching'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'matching_requires_pair_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'word-search'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'word_search_requires_selection_command' using errcode = '22023';
        end if;
        if op = 'receive' and exists (
          select 1 from private.question_versions q
          where q.id = item.question_version_id and q.type = 'word-hashtag'
        ) and jsonb_typeof(input->'answer') <> 'null' then
          raise exception 'word_hashtag_requires_swap_command' using errcode = '22023';
        end if;
        select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
        -- Entry time is captured before locks/evaluation. A stale request cannot predate presentation.
        if received < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
        late := received >= unit.deadline_at;
        effective := least(received, unit.deadline_at);
        if op = 'pass' and (cv.mode <> 'alphabet' or late) then raise exception 'pass_unavailable' using errcode = '55000'; end if;
        update private.interaction_intervals set ended_at = effective,
          end_reason = case when op = 'pass' then 'pass' when late then 'timeout' else 'answer' end where id = segment.id;
        if op = 'pass' then result := jsonb_build_object('passed', true);
        else
          select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
            into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
          insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer,
            received_at, presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
          values(a.id, segment.challenge_item_id, a.challenge_version_id,
            case when input->'answer' = 'null'::jsonb and exists (
              select 1 from private.question_versions timeout_question
              where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
            ) then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
            else input->'answer' end,
            received, presented,
            effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
          if input->'answer' = 'null'::jsonb and exists (
            select 1 from private.question_versions timeout_question
            where timeout_question.id = item.question_version_id and timeout_question.type = 'word-hashtag'
          ) then
            clear_progress := true;
          end if;
          result := jsonb_build_object('receiptId', receipt.id, 'timedOut', late, 'timeUsedMs', used_ms,
            'receivedAt', received, 'presentedAt', presented);
        end if;
      when 'evaluate' then
        select * into receipt from private.answer_receipts where id = (input->>'receiptId')::uuid and attempt_id = a.id;
        if not found then raise exception 'receipt_not_found' using errcode = '55000'; end if;
        if exists (select 1 from private.attempt_answers where receipt_id = receipt.id) then
          raise exception 'already_evaluated' using errcode = '55000';
        end if;
        -- Only the trusted evaluator may call this wrapper. No browser route is granted EXECUTE.
        insert into private.attempt_answers(attempt_id, challenge_item_id, challenge_version_id, receipt_id,
          status, answer, result_details, points, presented_at, submitted_at, time_used_ms, idempotency_key)
        values(a.id, receipt.challenge_item_id, receipt.challenge_version_id, receipt.id,
          input->>'status', receipt.answer, input->'resultDetails',
          case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
        result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status',
          'points', case when cv.mode = 'pyramid' and input->>'status' <> 'correct' then 0
            else (input->>'points')::integer end);
      when 'complete', 'abandon' then
        if op = 'complete' then
          if exists (select 1 from private.interaction_intervals where attempt_id = a.id and ended_at is null)
            or exists (select 1 from private.answer_receipts r where r.attempt_id = a.id
              and not exists (select 1 from private.attempt_answers aa where aa.receipt_id = r.id)) then
            raise exception 'unfinished_interaction' using errcode = '55000';
          end if;
          if not exists (select 1 from private.attempt_answers where attempt_id = a.id) then
            raise exception 'no_evaluated_answers' using errcode = '55000';
          end if;
          if cv.mode = 'survival' then
            select count(*)::integer,
              coalesce(sum(case
                when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
                when answer_question.type in ('matching', 'queens')
                  and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
                else 0
              end), 0)::integer
            into survival_resolved, survival_mistakes
            from private.attempt_answers answer
            join private.challenge_items answer_item on answer_item.id = answer.challenge_item_id
            join private.question_versions answer_question on answer_question.id = answer_item.question_version_id
            where answer.attempt_id = a.id;
            select count(*)::integer into survival_total
            from private.challenge_items challenge_item
            where challenge_item.challenge_version_id = a.challenge_version_id;
            survival_lives := greatest((cv.mode_config->>'lives')::integer - survival_mistakes, 0);
            if survival_lives > 0 and survival_resolved < survival_total then
              raise exception 'survival_not_terminal' using errcode = '55000';
            end if;
            completion_outcome := case when survival_lives = 0 then 'eliminated' else 'survived' end;
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
          elsif cv.mode = 'pyramid' then
            select count(*)::integer into pyramid_total
            from private.challenge_items challenge_item
            where challenge_item.challenge_version_id = a.challenge_version_id;
            select count(*)::integer into pyramid_resolved
            from private.attempt_answers answer where answer.attempt_id = a.id;
            if exists (select 1 from private.attempt_answers answer
              where answer.attempt_id = a.id and answer.status <> 'correct') then
              completion_outcome := 'failed';
            elsif pyramid_total = 7 and pyramid_resolved = pyramid_total then
              completion_outcome := 'summit';
            else
              raise exception 'pyramid_not_terminal' using errcode = '55000';
            end if;
            select coalesce(sum(answer.points), 0)::integer into points
            from private.attempt_answers answer where answer.attempt_id = a.id;
          else
            if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
              raise exception 'incomplete_challenge' using errcode = '55000';
            end if;
            points := (input->>'score')::integer;
            completion_outcome := input->>'outcome';
          end if;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        update public.attempts set status = target_status, score = points, completed_at = instant,
          outcome = completion_outcome, progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        if op = 'complete' then
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
        end if;
        result := jsonb_build_object('status', a.status, 'score', a.score,
          'outcome', a.outcome,
          'livesRemaining', case when cv.mode = 'survival' then survival_lives else null end);
      when 'invalidate', 'adjust' then
        result := private.handle_attempt_admin_command(op, input, actor, a, sc, instant, key);
        select * into a from public.attempts where id = a.id;
    end case;
    if op not in ('complete','abandon','invalidate','adjust') then
      update public.attempts
        set lock_version = lock_version + 1,
            last_activity_at = instant,
            progress_payload = case when clear_progress then null else progress_payload end
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  end if;

  return jsonb_build_object(
    'result', result,
    'entityType', 'attempt',
    'entityId', a.id,
    'beforePayload', previous,
    'replayed', false
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.handle_invitation_command (
  input         jsonb,
  safe_input    jsonb,
  actor         uuid,
  cached_result jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION private.invalidate_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('invalidate', input)
$function$;

CREATE OR REPLACE FUNCTION private.is_ready_question_asset (
  target_asset uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from private.media_assets asset
    where asset.id = target_asset
      and asset.bucket_id = 'question-assets'
      and asset.kind = 'question-asset'
      and asset.status = 'ready'
      and asset.mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and asset.byte_size between 1 and 52428800
      and asset.width between 1 and 8192
      and asset.height between 1 and 8192
      and asset.sha256 ~ '^[0-9a-f]{64}$'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_room_member (
  target_room_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1 from public.room_memberships m
    join public.rooms r on r.id = m.room_id
    where m.room_id = target_room_id and m.player_id = (select private.current_player_id())
      and m.status = 'active' and r.status = 'active'
  )
$function$;

CREATE OR REPLACE FUNCTION private.is_supported_competitive_question_extension (
  target_question uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.is_valid_published_competitive_question_format(target_question, 'true-false')
    or private.is_valid_published_competitive_question_format(target_question, 'ordering')
    or private.is_valid_published_competitive_question_format(target_question, 'classification')
    or private.is_valid_published_competitive_question_format(target_question, 'logic-matrix')
    or private.is_valid_published_competitive_question_format(target_question, 'zip')
    or private.is_valid_published_competitive_question_format(target_question, 'escape')
    or private.is_valid_published_competitive_question_format(target_question, 'word-hashtag')
    or private.is_valid_published_competitive_question_format(target_question, 'connect-pairs')
$function$;

CREATE OR REPLACE FUNCTION private.is_supported_flash_question (
  target_question uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  question private.question_versions%rowtype;
  solution jsonb;
  expected_word_length integer;
  max_attempts integer;
  selected_dictionary_id text;
  normalized text;
begin
  select * into question from private.question_versions where id = target_question;
  if not found or question.status <> 'published' then return false; end if;
  select solution_payload into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type = 'progressive-image' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and question.public_payload->'surface'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'surface'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'surface'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'surface'->'height') = 'number'
      and (question.public_payload->'surface'->>'width')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'height')::integer between 1 and 8192
      and jsonb_typeof(question.public_payload->'revealDurationMs') = 'number'
      and (question.public_payload->>'revealDurationMs')::integer between 1 and question.time_limit_ms - 1
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_typeof(solution->'solutionAlt') = 'string'
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where private.mini_wordle_normalize(answer) = private.mini_wordle_normalize(solution->>'correctAnswer'));
  end if;
  if question.type = 'multiple-choice' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and jsonb_typeof(question.public_payload->'media') = 'object'
      and question.public_payload->'media'->>'type' = 'image'
      and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
      and (question.public_payload->'media'->>'width')::integer between 1 and 8192
      and (question.public_payload->'media'->>'height')::integer between 1 and 8192
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  if question.type = 'estimation' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'min') = 'number'
      and jsonb_typeof(question.public_payload->'max') = 'number'
      and jsonb_typeof(question.public_payload->'step') = 'number'
      and jsonb_typeof(question.public_payload->'initialValue') = 'number'
      and (question.public_payload->>'min')::numeric < (question.public_payload->>'max')::numeric
      and (question.public_payload->>'step')::numeric > 0
      and (question.public_payload->>'initialValue')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(question.public_payload->'unit') = 'string'
      and char_length(btrim(question.public_payload->>'unit')) between 1 and 120
      and jsonb_typeof(question.public_payload->'media') in ('null', 'object')
      and (
        jsonb_typeof(question.public_payload->'media') = 'null'
        or (
          question.public_payload->'media'->>'type' = 'image'
          and question.public_payload->'media'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and private.is_usable_question_asset((question.public_payload->'media'->>'assetId')::uuid)
          and jsonb_typeof(question.public_payload->'media'->'alt') = 'string'
          and jsonb_typeof(question.public_payload->'media'->'width') = 'number'
          and jsonb_typeof(question.public_payload->'media'->'height') = 'number'
          and (question.public_payload->'media'->>'width')::integer between 1 and 8192
          and (question.public_payload->'media'->>'height')::integer between 1 and 8192
        )
      )
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'number'
      and (solution->>'correctAnswer')::numeric between
        (question.public_payload->>'min')::numeric and (question.public_payload->>'max')::numeric
      and jsonb_typeof(solution->'tolerance') = 'number'
      and (solution->>'tolerance')::numeric >= 0;
  end if;
  if question.type = 'heat-map' and question.payload_schema_version = 2 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'targetLabel') = 'string'
      and char_length(btrim(question.public_payload->>'targetLabel')) between 1 and 500
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and question.public_payload->'surface'->>'assetId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and private.is_usable_question_asset((question.public_payload->'surface'->>'assetId')::uuid)
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and jsonb_typeof(question.public_payload->'surface'->'width') = 'number'
      and jsonb_typeof(question.public_payload->'surface'->'height') = 'number'
      and (question.public_payload->'surface'->>'width')::integer between 1 and 8192
      and (question.public_payload->'surface'->>'height')::integer between 1 and 8192
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'target') = 'object'
      and jsonb_typeof(solution->'target'->'x') = 'number'
      and (solution->'target'->>'x')::numeric between 0 and 1
      and jsonb_typeof(solution->'target'->'y') = 'number'
      and (solution->'target'->>'y')::numeric between 0 and 1
      and jsonb_typeof(solution->'fullCreditRadius') = 'number'
      and (solution->>'fullCreditRadius')::numeric >= 0
      and jsonb_typeof(solution->'toleranceRadius') = 'number'
      and (solution->>'toleranceRadius')::numeric > (solution->>'fullCreditRadius')::numeric;
  end if;
  if question.type = 'queens' and question.payload_schema_version = 1 then
    return private.queens_content_valid(question.public_payload, solution);
  end if;
  if question.type = 'word-search' and question.payload_schema_version = 1 then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'grid') = 'object'
      and (question.public_payload->'grid'->>'rows')::integer between 6 and 10
      and (question.public_payload->'grid'->>'columns')::integer between 6 and 10
      and jsonb_typeof(question.public_payload->'letters') = 'array'
      and jsonb_array_length(question.public_payload->'letters') =
        (question.public_payload->'grid'->>'rows')::integer * (question.public_payload->'grid'->>'columns')::integer
      and jsonb_typeof(question.public_payload->'targets') = 'array'
      and jsonb_array_length(question.public_payload->'targets') between 2 and 8
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'positionsByTargetId') = 'object';
  end if;
  if question.type in (
    'true-false', 'ordering', 'classification', 'logic-matrix',
    'zip', 'escape', 'word-hashtag'
  ) then
    return private.is_supported_competitive_question_extension(target_question);
  end if;
  if question.payload_schema_version <> 1 then return false; end if;
  if question.type = 'multiple-choice' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'options') = 'array'
      and jsonb_array_length(question.public_payload->'options') >= 2
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and exists (select 1 from jsonb_array_elements_text(question.public_payload->'options') value
        where value = solution->>'correctAnswer');
  end if;
  if question.type = 'short-text' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and (not question.public_payload ? 'answerPlaceholder'
        or jsonb_typeof(question.public_payload->'answerPlaceholder') in ('null', 'string'))
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
  end if;
  if question.type = 'logic-code' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'clues') = 'array'
      and jsonb_array_length(question.public_payload->'clues') between 1 and 20
      and (question.public_payload->>'codeLength')::integer between 1 and 12
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'clues') clue
        where jsonb_typeof(clue->'code') is distinct from 'string'
          or jsonb_typeof(clue->'hint') is distinct from 'string'
          or char_length(clue->>'code') <> (question.public_payload->>'codeLength')::integer
          or clue->>'code' !~ '^[0-9]+$'
          or char_length(btrim(clue->>'hint')) not between 1 and 500)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and char_length(solution->>'correctAnswer') = (question.public_payload->>'codeLength')::integer
      and solution->>'correctAnswer' ~ '^[0-9]+$';
  end if;
  if question.type = 'progressive-clues' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'clues') = 'array'
      and jsonb_array_length(question.public_payload->'clues') between 1 and 20
      and jsonb_typeof(question.public_payload->'cluePenalty') = 'number'
      and (question.public_payload->>'cluePenalty')::numeric = trunc((question.public_payload->>'cluePenalty')::numeric)
      and (question.public_payload->>'cluePenalty')::integer between 0 and 50
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'clues') clue
        where jsonb_typeof(clue) is distinct from 'string'
          or char_length(btrim(clue #>> '{}')) not between 1 and 500)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and not exists (select 1 from jsonb_array_elements(solution->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      and not exists (
        select 1
        from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1
      )
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
  end if;
  if question.type = 'matching' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'leftItems') = 'array'
      and jsonb_typeof(question.public_payload->'rightItems') = 'array'
      and jsonb_array_length(question.public_payload->'leftItems') between 3 and 6
      and jsonb_array_length(question.public_payload->'rightItems') = jsonb_array_length(question.public_payload->'leftItems')
      and not private.editorial_has_secret_key(question.public_payload)
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (
        select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
        where jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
      )
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'leftItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(question.public_payload->'rightItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'leftItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and not exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(question.public_payload->'rightItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'matches') = 'object'
      and (select count(*) from jsonb_object_keys(solution->'matches')) = jsonb_array_length(question.public_payload->'leftItems')
      and not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') item
        where not (solution->'matches' ? (item->>'id')))
      and not exists (select 1 from jsonb_each_text(solution->'matches') match
        where not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') item
          where item->>'id' = match.value))
      and (select count(*) from jsonb_each_text(solution->'matches')) =
        (select count(distinct value) from jsonb_each_text(solution->'matches'));
  end if;
  if question.type = 'progressive-image' then
    return jsonb_typeof(question.public_payload) = 'object'
      and jsonb_typeof(question.public_payload->'question') = 'string'
      and jsonb_typeof(question.public_payload->'surface') = 'object'
      and jsonb_typeof(question.public_payload->'surface'->'src') = 'string'
      and char_length(btrim(question.public_payload->'surface'->>'src')) between 10 and 1000
      and left(question.public_payload->'surface'->>'src', 9) = '/visuals/'
      and question.public_payload->'surface'->>'src' !~ '\s'
      and jsonb_typeof(question.public_payload->'surface'->'alt') = 'string'
      and char_length(btrim(question.public_payload->'surface'->>'alt')) between 1 and 500
      and (question.public_payload->'surface'->>'width')::numeric = trunc((question.public_payload->'surface'->>'width')::numeric)
      and (question.public_payload->'surface'->>'width')::integer > 0
      and (question.public_payload->'surface'->>'height')::numeric = trunc((question.public_payload->'surface'->>'height')::numeric)
      and (question.public_payload->'surface'->>'height')::integer > 0
      and (question.public_payload->'surface'->>'fit' is null or question.public_payload->'surface'->>'fit' in ('cover', 'contain'))
      and (question.public_payload->>'revealDurationMs')::numeric = trunc((question.public_payload->>'revealDurationMs')::numeric)
      and (question.public_payload->>'revealDurationMs')::integer > 0
      and (question.public_payload->>'revealDurationMs')::integer < question.time_limit_ms
      and not private.editorial_has_secret_key(question.public_payload)
      and jsonb_typeof(solution) = 'object'
      and jsonb_typeof(solution->'correctAnswer') = 'string'
      and jsonb_typeof(solution->'acceptedAnswers') = 'array'
      and jsonb_array_length(solution->'acceptedAnswers') between 1 and 100
      and jsonb_typeof(solution->'solutionAlt') = 'string'
      and char_length(btrim(solution->>'solutionAlt')) between 1 and 500
      and not exists (select 1 from jsonb_array_elements(solution->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      and not exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1)
      and exists (select 1 from jsonb_array_elements_text(solution->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'));
  end if;
  if question.type <> 'mini-wordle' or jsonb_typeof(solution) <> 'object' then return false; end if;
  expected_word_length := (question.public_payload->>'wordLength')::integer;
  max_attempts := (question.public_payload->>'maxAttempts')::integer;
  selected_dictionary_id := solution->>'dictionaryId';
  normalized := private.mini_wordle_normalize(solution->>'correctAnswer');
  return jsonb_typeof(question.public_payload) = 'object'
    and jsonb_typeof(question.public_payload->'question') = 'string'
    and expected_word_length in (4, 5)
    and max_attempts between 1 and 10
    and ((expected_word_length = 4 and selected_dictionary_id = 'es-general-4.v1')
      or (expected_word_length = 5 and selected_dictionary_id = 'es-general-5.v1'))
    and char_length(normalized) = expected_word_length
    and normalized ~ '^[A-ZÑ]+$'
    and jsonb_typeof(solution->'additionalGuesses') = 'array'
    and jsonb_array_length(solution->'additionalGuesses') <= 1000
    and not exists (select 1 from jsonb_array_elements(solution->'additionalGuesses') extra
      where jsonb_typeof(extra) is distinct from 'string')
    and not exists (select 1 from jsonb_array_elements(solution->'additionalGuesses') extra
      where char_length(private.mini_wordle_normalize(extra #>> '{}')) <> expected_word_length
        or private.mini_wordle_normalize(extra #>> '{}') !~ '^[A-ZÑ]+$'
        or private.mini_wordle_normalize(extra #>> '{}') = normalized
        or (select count(*) from jsonb_array_elements_text(solution->'additionalGuesses') values(value)
            where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(extra #>> '{}')) > 1)
    and not private.editorial_has_secret_key(question.public_payload);
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_usable_question_asset (
  target_asset uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from private.media_assets asset
    where asset.id = target_asset
      and asset.bucket_id = 'question-assets'
      and asset.kind = 'question-asset'
      and asset.status in ('ready', 'archived')
      and asset.mime_type in ('image/jpeg', 'image/png', 'image/webp')
      and asset.byte_size between 1 and 52428800
      and asset.width between 1 and 8192
      and asset.height between 1 and 8192
      and asset.sha256 ~ '^[0-9a-f]{64}$'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_valid_published_competitive_question_format (
  target_question uuid,
  expected_type   text
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  question_row private.question_versions%rowtype;
begin
  if expected_type not in (
    'true-false', 'ordering', 'classification', 'logic-matrix',
    'zip', 'escape', 'word-hashtag', 'connect-pairs'
  ) then
    return false;
  end if;
  select * into question_row
  from private.question_versions question
  where question.id = target_question;
  if not found or question_row.status <> 'published'
    or question_row.type <> expected_type or question_row.payload_schema_version <> 1 then
    return false;
  end if;
  perform private.validate_flash_question_document(private.question_version_document(target_question));
  return true;
exception when others then
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_valid_pyramid_level_config (
  value jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select coalesce(
    jsonb_typeof(value) = 'object'
    and (select count(*) from jsonb_object_keys(value)) = 3
    and jsonb_typeof(value->'levelId') = 'string'
    and char_length(btrim(value->>'levelId')) between 1 and 120
    and jsonb_typeof(value->'label') = 'string'
    and char_length(btrim(value->>'label')) between 1 and 120
    and jsonb_typeof(value->'briefing') = 'object'
    and (select count(*) from jsonb_object_keys(value->'briefing')) = 3
    and jsonb_typeof(value->'briefing'->'title') = 'string'
    and char_length(btrim(value->'briefing'->>'title')) between 1 and 200
    and jsonb_typeof(value->'briefing'->'format') = 'string'
    and char_length(btrim(value->'briefing'->>'format')) between 1 and 120
    and jsonb_typeof(value->'briefing'->'description') = 'string'
    and char_length(btrim(value->'briefing'->>'description')) between 1 and 1000,
    false
  );
$function$;

CREATE OR REPLACE FUNCTION private.lock_command_key (
  target_actor uuid,
  target_key   text
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select pg_advisory_xact_lock(hashtextextended('flash-command:' || target_actor || ':' || target_key, 0))
$function$;

CREATE OR REPLACE FUNCTION private.lock_membership_room()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if tg_op = 'UPDATE' and (new.id, new.room_id, new.player_id) is distinct from
    (old.id, old.room_id, old.player_id) then raise exception 'Membership identity is immutable'; end if;
  perform 1 from public.rooms where id = coalesce(new.room_id, old.room_id) for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.logic_code_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'kind', 'logic-code',
    'submittedCodes', coalesce(
      jsonb_agg(e.code order by e.sequence) filter (where e.id is not null),
      '[]'::jsonb
    ),
    'incorrectAttempts', count(*) filter (where e.id is not null and not e.correct)::integer
  )
  from private.logic_code_attempt_events e
  where e.attempt_id = target_attempt and e.challenge_item_id = target_item
$function$;

CREATE OR REPLACE FUNCTION private.manage_room_member_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text;
  room_slug_value text;
  target_player_id uuid;
  action_value text;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  room_row public.rooms%rowtype;
  actor_membership public.room_memberships%rowtype;
  target_membership public.room_memberships%rowtype;
  before_payload jsonb;
  after_payload jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','roomKey','targetPlayerId','action']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','roomKey','targetPlayerId','action'])
    )
    or input->'idempotencyKey' = 'null'::jsonb
    or input->'roomKey' = 'null'::jsonb
    or input->'targetPlayerId' = 'null'::jsonb
    or input->'action' = 'null'::jsonb
    or jsonb_typeof(input->'idempotencyKey') <> 'string'
    or jsonb_typeof(input->'roomKey') <> 'string'
    or jsonb_typeof(input->'targetPlayerId') <> 'string'
    or jsonb_typeof(input->'action') <> 'string' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  room_slug_value := btrim(input->>'roomKey');
  action_value := input->>'action';
  if char_length(key) < 8 or char_length(key) > 160 or room_slug_value = '' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if action_value not in ('grant_admin', 'revoke_admin', 'remove') then
    raise exception 'invalid_member_action' using errcode = '22023';
  end if;
  if input->>'targetPlayerId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  target_player_id := (input->>'targetPlayerId')::uuid;
  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'roomKey', room_slug_value,
    'targetPlayerId', target_player_id,
    'action', action_value
  );

  perform pg_advisory_xact_lock(hashtextextended('room-membership-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'manage_room_member' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into room_row
  from public.rooms room
  where room.slug = room_slug_value and room.status = 'active'
  for update;
  if not found then raise exception 'room_not_found' using errcode = '42501'; end if;

  select * into actor_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = actor
    and membership.status = 'active'
  for update;
  if not found or actor_membership.role <> 'owner' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into target_membership
  from public.room_memberships membership
  where membership.room_id = room_row.id
    and membership.player_id = target_player_id
    and membership.status = 'active'
  for update;
  if not found then raise exception 'member_not_found' using errcode = '42501'; end if;
  if target_membership.role = 'owner' or target_membership.player_id = actor then
    raise exception 'member_is_owner' using errcode = '42501';
  end if;
  if action_value in ('grant_admin', 'revoke_admin') and target_membership.role = 'spectator' then
    raise exception 'invalid_member_role' using errcode = '22023';
  end if;

  before_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  if action_value = 'grant_admin' then
    update public.room_memberships
    set role = 'admin'
    where id = target_membership.id
    returning * into target_membership;
  elsif action_value = 'revoke_admin' then
    update public.room_memberships
    set role = 'member'
    where id = target_membership.id
    returning * into target_membership;
  else
    update public.room_memberships
    set status = 'removed', ended_at = clock_timestamp()
    where id = target_membership.id
    returning * into target_membership;
  end if;

  result := jsonb_build_object(
    'roomKey', room_slug_value,
    'targetPlayerId', target_membership.player_id,
    'action', action_value,
    'role', target_membership.role,
    'status', target_membership.status
  );
  after_payload := jsonb_build_object(
    'playerId', target_membership.player_id,
    'role', target_membership.role,
    'status', target_membership.status
  );
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'manage_room_member_' || action_value, 'room_membership', target_membership.id,
    null, key, before_payload, after_payload
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'manage_room_member', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.matching_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'kind', 'matching',
    'matchedPairs', coalesce(jsonb_agg(
      jsonb_build_object('leftId', e.left_item_id, 'rightId', e.right_item_id)
      order by e.sequence
    ) filter (where e.correct), '[]'::jsonb),
    'matchedCount', count(*) filter (where e.correct)::integer,
    'totalPairs', jsonb_array_length(q.public_payload->'leftItems'),
    'incorrectAttempts', count(*) filter (where not e.correct)::integer,
    'penaltyPoints', coalesce(sum(e.penalty_points) filter (where not e.correct), 0)::integer
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  left join private.matching_pair_events e
    on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'matching'
  group by q.public_payload
$function$;

CREATE OR REPLACE FUNCTION private.matching_public_payload (
  target_item uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'leftItems', coalesce((
      select jsonb_agg(value - 'correctMatchId' order by ordinality)
      from jsonb_array_elements(q.public_payload->'leftItems') with ordinality
    ), '[]'::jsonb),
    'rightItems', coalesce((
      select jsonb_agg(value - 'correctMatchId' order by ordinality)
      from jsonb_array_elements(q.public_payload->'rightItems') with ordinality
    ), '[]'::jsonb)
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'matching'
$function$;

CREATE OR REPLACE FUNCTION private.mini_wordle_feedback (
  guess_value    text,
  solution_value text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  guess_chars text[] := string_to_array(guess_value, null);
  solution_chars text[] := string_to_array(solution_value, null);
  statuses text[] := array_fill('absent'::text, array[coalesce(array_length(guess_chars, 1), 0)]);
  remaining jsonb := '{}'::jsonb;
  letter text;
  i integer;
  result jsonb;
begin
  if guess_chars is null or solution_chars is null then return '[]'::jsonb; end if;
  for i in 1..array_length(guess_chars, 1) loop
    if guess_chars[i] = solution_chars[i] then
      statuses[i] := 'correct';
    else
      letter := solution_chars[i];
      remaining := jsonb_set(remaining, array[letter], to_jsonb(coalesce((remaining->>letter)::integer, 0) + 1), true);
    end if;
  end loop;
  for i in 1..array_length(guess_chars, 1) loop
    if statuses[i] <> 'correct' and coalesce((remaining->>guess_chars[i])::integer, 0) > 0 then
      statuses[i] := 'present';
      remaining := jsonb_set(remaining, array[guess_chars[i]], to_jsonb((remaining->>guess_chars[i])::integer - 1), true);
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('letter', guess_chars[x], 'status', statuses[x]) order by x), '[]'::jsonb)
    into result from generate_series(1, array_length(guess_chars, 1)) as series(x);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.mini_wordle_normalize (
  value text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select translate(upper(btrim(value)), 'ÁÉÍÓÚÜ', 'AEIOUU')
$function$;

CREATE OR REPLACE FUNCTION private.mini_wordle_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'kind', 'mini-wordle',
    'guesses', coalesce(jsonb_agg(e.guess order by e.sequence) filter (where e.id is not null), '[]'::jsonb),
    'feedback', coalesce(jsonb_agg(e.feedback order by e.sequence) filter (where e.id is not null), '[]'::jsonb),
    'attemptsUsed', count(e.id)::integer,
    'maxAttempts', (q.public_payload->>'maxAttempts')::integer
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  left join private.mini_wordle_guess_events e
    on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'mini-wordle'
  group by q.public_payload
$function$;

CREATE OR REPLACE FUNCTION private.next_attempt_item (
  target_attempt uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select i.id from public.attempts a
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  where a.id = target_attempt and not exists (
    select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id
  )
  order by
    case when cv.mode = 'alphabet' and exists (select 1 from private.interaction_intervals x
      where x.attempt_id = a.id and x.challenge_item_id = i.id) then 1 else 0 end,
    case when cv.mode = 'alphabet' and i.position <= coalesce((
      select ci.position from private.interaction_intervals x
      join private.challenge_items ci on ci.id = x.challenge_item_id
      where x.attempt_id = a.id order by x.started_at desc, x.id desc limit 1
    ), 0) then 1 else 0 end,
    i.position limit 1
$function$;

CREATE OR REPLACE FUNCTION private.pass_interaction (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('pass', input)
$function$;

CREATE OR REPLACE FUNCTION private.prepare_avatar_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  asset uuid;
  object_path_value text := input->>'objectPath';
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','assetId','objectPath','mimeType','byteSize']))
    or not input ?& array['idempotencyKey','assetId','objectPath','mimeType','byteSize']
    or input->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg', 'image/png', 'image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 5242880 then
    raise exception 'invalid_avatar_upload' using errcode = '22023';
  end if;

  asset := (input->>'assetId')::uuid;
  if object_path_value !~ ('^avatars/' || actor::text || '/' || asset::text || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_avatar_path' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'assetId', asset, 'objectPath', object_path_value,
    'mimeType', mime_value, 'byteSize', bytes_value
  );

  perform pg_advisory_xact_lock(hashtextextended('avatar-upload:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'prepare_avatar_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  insert into private.media_assets(
    id, bucket_id, object_path, kind, owner_player_id, created_by_player_id
  ) values (
    asset, 'avatars', object_path_value, 'avatar', actor, actor
  );

  result := jsonb_build_object(
    'assetId', asset, 'objectPath', object_path_value, 'status', 'pending'
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'prepare_avatar_upload', 'media_asset', asset, key,
    jsonb_build_object('bucketId', 'avatars', 'objectPath', object_path_value, 'status', 'pending'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'prepare_avatar_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_avatar_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.prepare_interaction (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  -- A lost prepare response or a countdown race may leave the interval open.
  -- Re-reading is safe: execute_command exposes only public payload/progress,
  -- and an already received answer is still blocked as evaluation_pending.
  if exists (
    select 1 from private.command_requests
    where actor_id = private.command_actor() and idempotency_key = prepare_interaction.input->>'idempotencyKey'
      and operation = 'prepare'
  ) then
    return private.execute_command('prepare', input);
  end if;
  return private.execute_command('prepare', input);
end;
$function$;

CREATE OR REPLACE FUNCTION private.prepare_question_asset_upload_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := btrim(input->>'idempotencyKey');
  asset uuid := (input->>'assetId')::uuid;
  object_path_value text := input->>'objectPath';
  mime_value text := input->>'mimeType';
  bytes_value bigint := (input->>'byteSize')::bigint;
  cached private.command_requests%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','assetId','objectPath','mimeType','byteSize']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey','assetId','objectPath','mimeType','byteSize']))
    or key is null or char_length(key) not between 8 and 160
    or mime_value not in ('image/jpeg','image/png','image/webp')
    or bytes_value is null or bytes_value <= 0 or bytes_value > 52428800
    or object_path_value !~ ('^question-assets/' || asset::text || '\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid_question_asset_upload' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'assetId', asset, 'objectPath', object_path_value,
    'mimeType', mime_value, 'byteSize', bytes_value);
  perform pg_advisory_xact_lock(hashtextextended('question-asset-upload:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'prepare_question_asset_upload' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  insert into private.media_assets(id, bucket_id, object_path, kind, owner_player_id, created_by_player_id)
  values (asset, 'question-assets', object_path_value, 'question-asset', null, actor);
  result := jsonb_build_object('assetId', asset, 'objectPath', object_path_value, 'status', 'pending');
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, after_payload)
  values (actor, 'prepare_question_asset_upload', 'media_asset', asset, key,
    jsonb_build_object('bucketId','question-assets','objectPath',object_path_value,'status','pending'));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'prepare_question_asset_upload', safe_input, result);
  return result;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'invalid_question_asset_upload' using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.progressive_clue_effective_penalty (
  configured_penalty integer,
  item_points        integer
)
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  -- cluePenalty is authored against the shared 100-point question baseline.
  select case
    when configured_penalty <= 0 or item_points <= 0 then 0
    else greatest(1, round((configured_penalty::numeric / 100) * item_points)::integer)
  end
$function$;

CREATE OR REPLACE FUNCTION private.progressive_clues_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with content as (
    select
      i.points,
      q.public_payload,
      jsonb_array_length(q.public_payload->'clues') as total_clues,
      private.progressive_clue_effective_penalty(
        (q.public_payload->>'cluePenalty')::integer,
        i.points
      ) as effective_penalty
    from private.challenge_items i
    join private.question_versions q on q.id = i.question_version_id
    where i.id = target_item and q.type = 'progressive-clues'
  ), current_progress as (
    select
      coalesce(max(e.clue_index), 0)::integer as revealed_clues,
      coalesce((array_agg(e.available_points order by e.clue_index desc))[1], c.points)::integer
        as available_points
    from content c
    left join private.progressive_clue_reveal_events e
      on e.attempt_id = target_attempt and e.challenge_item_id = target_item
    group by c.points
  )
  select jsonb_build_object(
    'kind', 'progressive-clues',
    'clues', coalesce((
      select jsonb_agg(value order by ordinality)
      from jsonb_array_elements_text(c.public_payload->'clues') with ordinality
      where ordinality <= p.revealed_clues
    ), '[]'::jsonb),
    'revealedClues', p.revealed_clues,
    'totalClues', c.total_clues,
    'availablePoints', p.available_points,
    'cluePenalty', c.effective_penalty
  )
  from content c cross join current_progress p
$function$;

CREATE OR REPLACE FUNCTION private.progressive_clues_public_payload (
  target_item uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'question', q.public_payload->'question',
    'category', coalesce(q.public_payload->'category', 'null'::jsonb),
    'tags', coalesce(q.public_payload->'tags', '{}'::jsonb),
    'clueCount', jsonb_array_length(q.public_payload->'clues'),
    'cluePenalty', q.public_payload->'cluePenalty'
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item and q.type = 'progressive-clues'
$function$;

CREATE OR REPLACE FUNCTION private.publication_effective_status (
  raw_status       text,
  season_status    text,
  season_starts_at timestamp with time zone,
  season_ends_at   timestamp with time zone,
  opens_at         timestamp with time zone,
  closes_at        timestamp with time zone,
  at_time          timestamp with time zone
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select case
    when raw_status = 'cancelled' then 'cancelled'
    when raw_status = 'closed' then 'closed'
    when season_status <> 'active' then 'closed'
    when at_time < season_starts_at or at_time < opens_at then 'upcoming'
    when at_time >= season_ends_at or at_time >= closes_at then 'closed'
    else 'available'
  end
$function$;

CREATE OR REPLACE FUNCTION private.publication_is_effectively_open (
  raw_status       text,
  season_status    text,
  season_starts_at timestamp with time zone,
  season_ends_at   timestamp with time zone,
  opens_at         timestamp with time zone,
  closes_at        timestamp with time zone,
  at_time          timestamp with time zone
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select private.publication_effective_status(
    raw_status, season_status, season_starts_at, season_ends_at,
    opens_at, closes_at, at_time
  ) = 'available'
$function$;

CREATE OR REPLACE FUNCTION private.publish_flash_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  expected_updated_at timestamptz;
  challenge_version_id_value uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  item_row private.challenge_items%rowtype;
  question_row private.question_versions%rowtype;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'reason']))
    or input->'idempotencyKey' is null or input->'challengeVersionId' is null
    or input->'expectedUpdatedAt' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'publish_flash' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into challenge_row from private.challenge_versions version
  where version.id = challenge_version_id_value for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if challenge_row.status = 'published' then raise exception 'content_already_published' using errcode = '55000'; end if;
  if challenge_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if challenge_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.challenge_definitions definition
  where definition.id = challenge_row.challenge_definition_id for update;
  if (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value)
    not between 2 and 20 then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;
  if (select coalesce(sum(item.points), 0) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value) <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
  if challenge_row.mode = 'survival' and (
    (select count(*) from jsonb_object_keys(challenge_row.mode_config)) <> 1
    or jsonb_typeof(challenge_row.mode_config->'lives') is distinct from 'number'
    or (challenge_row.mode_config->>'lives')::numeric <> trunc((challenge_row.mode_config->>'lives')::numeric)
    or (challenge_row.mode_config->>'lives')::integer not between 1 and (
      select count(*)::integer from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
    )
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  if challenge_row.mode = 'pyramid' and (
    challenge_row.mode_config <> '{}'::jsonb
    or (select count(*) from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or (select count(distinct item.mode_config->>'levelId') from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value) <> 7
    or exists (select 1 from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
        and (item.position not between 1 and 7
          or not private.is_valid_pyramid_level_config(item.mode_config)))
  ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for item_row in
    select item.* from private.challenge_items item
    where item.challenge_version_id = challenge_version_id_value
    order by item.position for update
  loop
    select * into question_row from private.question_versions version
    where version.id = item_row.question_version_id for update;
    if question_row.status <> 'published' or not exists (
      select 1 from private.question_version_solutions solution
      where solution.question_version_id = question_row.id
    ) then
      raise exception 'question_not_published' using errcode = '55000';
    end if;
    if challenge_row.mode in ('flash', 'survival', 'pyramid') and (
      not private.is_supported_flash_question(question_row.id)
      or (challenge_row.mode = 'survival' and question_row.type = 'short-text')
    ) then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;
  end loop;
  update private.challenge_versions version
  set status = 'published'
  where version.id = challenge_version_id_value
  returning jsonb_build_object(
    'challengeDefinitionId', definition_row.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition_row.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'publish_flash', 'challenge_version', challenge_version_id_value, reason_value, key,
    jsonb_build_object('status', 'draft', 'slug', definition_row.slug),
    jsonb_build_object(
      'status', 'published',
      'slug', definition_row.slug,
      'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = challenge_version_id_value),
      'maxScore', challenge_row.max_score
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_flash', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.publish_question_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  result jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then raise exception 'not_authorized' using errcode = '42501'; end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'reason'] then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id, 'expectedUpdatedAt', expected_updated_at, 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'publish_question' or cached.input <> safe_input then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status = 'published' then raise exception 'content_already_published' using errcode = '55000'; end if;
  if version_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  perform private.validate_flash_question_document(private.question_version_document(version_id));
  update private.question_versions set status = 'published', published_at = clock_timestamp() where id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'publish_question', 'question_version', version_id, reason_value, key,
    jsonb_build_object('status', 'draft'), jsonb_build_object('status', 'published', 'version', result));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'publish_question', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.queens_answer (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'queens', private.queens_progress(target_attempt, target_item)->'queens',
    'marks', '[]'::jsonb
  )
$function$;

CREATE OR REPLACE FUNCTION private.queens_board (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS integer[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with fixed_cells as (
    select value::integer as cell
    from private.challenge_items i
    join private.question_versions q on q.id = i.question_version_id
    cross join jsonb_array_elements_text(coalesce(q.public_payload->'prefilledQueens', '[]'::jsonb)) value
    where i.id = target_item
  ),
  latest_actions as (
    select distinct on (e.cell) e.cell, e.action
    from private.queens_placement_events e
    where e.attempt_id = target_attempt and e.challenge_item_id = target_item
    order by e.cell, e.sequence desc
  )
  select coalesce(array_agg(cell order by cell), '{}'::integer[])
  from (
    select cell from fixed_cells
    union
    select cell from latest_actions where action = 'place'
  ) active_cells
$function$;

CREATE OR REPLACE FUNCTION private.queens_cell_conflicts (
  regions     jsonb,
  target_cell integer,
  queens      integer[]
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  with target as (
    select target_cell / 5 as row_no, target_cell % 5 as column_no,
      regions->target_cell as region
  ), others as (
    select cell, cell / 5 as row_no, cell % 5 as column_no, regions->cell as region
    from unnest(queens) cell
    where cell <> target_cell
  )
  select exists (
    select 1 from target t join others o on
      t.row_no = o.row_no or
      t.column_no = o.column_no or
      t.region = o.region or
      greatest(abs(t.row_no - o.row_no), abs(t.column_no - o.column_no)) = 1
  )
$function$;

CREATE OR REPLACE FUNCTION private.queens_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
declare
  regions integer[] := '{}';
  prefilled integer[] := '{}';
  solution integer[] := '{}';
  value text;
  cell integer;
  index integer;
  solution_count integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
    or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
    or (public_payload->'grid'->>'rows')::integer <> 5
    or (public_payload->'grid'->>'columns')::integer <> 5
    or jsonb_typeof(public_payload->'regions') is distinct from 'array'
    or jsonb_array_length(public_payload->'regions') <> 25
    or jsonb_typeof(public_payload->'prefilledQueens') is distinct from 'array'
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
    or jsonb_array_length(solution_payload->'solution') <> 5
    or exists (
      select 1 from jsonb_array_elements(public_payload->'regions') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    )
    or exists (
      select 1 from jsonb_array_elements(public_payload->'prefilledQueens') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    )
    or exists (
      select 1 from jsonb_array_elements(solution_payload->'solution') entry
      where jsonb_typeof(entry) is distinct from 'number'
        or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
    ) then
    return false;
  end if;

  for value in select jsonb_array_elements_text(public_payload->'regions') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 4 then return false; end if;
    regions := regions || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(public_payload->'prefilledQueens') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 24 then return false; end if;
    prefilled := prefilled || value::integer;
  end loop;
  for value in select jsonb_array_elements_text(solution_payload->'solution') loop
    if value !~ '^[0-9]+$' or value::integer not between 0 and 24 then return false; end if;
    solution := solution || value::integer;
  end loop;
  for index in 0..4 loop
    if not exists (select 1 from unnest(regions) as region_cell where region_cell = index) then return false; end if;
    if exists (
      with recursive walk(cell) as (
        (select min(candidate)::integer
         from generate_series(0, 24) candidate
         where regions[candidate + 1] = index)
        union
        select neighbor::integer
        from walk
        cross join lateral unnest(array[
          walk.cell - 5, walk.cell + 5, walk.cell - 1, walk.cell + 1
        ]) neighbor
        where neighbor between 0 and 24
          and regions[neighbor + 1] = index
      )
      select 1
      from generate_series(0, 24) candidate
      where regions[candidate + 1] = index
        and not exists (select 1 from walk where walk.cell = candidate)
    ) then return false; end if;
  end loop;
  if (select count(distinct solution_cell) from unnest(solution) as solution_cell) <> coalesce(array_length(solution, 1), 0) then return false; end if;
  if (select count(distinct prefilled_cell) from unnest(prefilled) as prefilled_cell) <> coalesce(array_length(prefilled, 1), 0) then return false; end if;
  if exists (select 1 from unnest(prefilled) as prefilled_cell where not prefilled_cell = any(solution)) then return false; end if;
  if exists (
    select 1 from unnest(solution) as left_cell cross join unnest(solution) as right_cell
    where left_cell < right_cell
      and (left_cell / 5 = right_cell / 5
        or left_cell % 5 = right_cell % 5
        or regions[left_cell + 1] = regions[right_cell + 1]
        or greatest(abs(left_cell / 5 - right_cell / 5), abs(left_cell % 5 - right_cell % 5)) = 1)
  ) then return false; end if;
  for index in 0..4 loop
    if (select count(*) from unnest(solution) as solution_cell where solution_cell / 5 = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where solution_cell % 5 = index) <> 1
      or (select count(*) from unnest(solution) as solution_cell where regions[solution_cell + 1] = index) <> 1 then
      return false;
    end if;
  end loop;
  with recursive search(row_no, previous_column, used_columns, used_regions) as (
    select 0, null::integer, '{}'::integer[], '{}'::integer[]
    union all
    select search.row_no + 1,
      candidate,
      search.used_columns || candidate,
      search.used_regions || regions[search.row_no * 5 + candidate + 1]
    from search
    cross join generate_series(0, 4) candidate
    where search.row_no < 5
      and not candidate = any(search.used_columns)
      and not regions[search.row_no * 5 + candidate + 1] = any(search.used_regions)
      and (search.previous_column is null or abs(search.previous_column - candidate) > 1)
  )
  select count(*)::integer into solution_count from search where row_no = 5;
  if solution_count <> 1 then return false; end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.queens_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  regions jsonb;
  queens integer[];
  conflicting_queens integer;
  completed_rows integer;
  completed_columns integer;
  completed_regions integer;
  solved boolean;
begin
  select q.public_payload->'regions' into regions
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  where i.id = target_item;
  queens := private.queens_board(target_attempt, target_item);

  with pairs as (
    select left_cell as cell, right_cell
    from unnest(queens) left_cell
    cross join unnest(queens) right_cell
    where left_cell < right_cell
  ), conflicts as (
    select p.cell
    from pairs p
    where p.cell / 5 = p.right_cell / 5
       or p.cell % 5 = p.right_cell % 5
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / 5 - p.right_cell / 5), abs(p.cell % 5 - p.right_cell % 5)) = 1
    union
    select p.right_cell
    from pairs p
    where p.cell / 5 = p.right_cell / 5
       or p.cell % 5 = p.right_cell % 5
       or regions->p.cell = regions->p.right_cell
       or greatest(abs(p.cell / 5 - p.right_cell / 5), abs(p.cell % 5 - p.right_cell % 5)) = 1
  )
  select count(*)::integer into conflicting_queens from conflicts;

  select count(*)::integer into completed_rows
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where cell / 5 = group_no) = 1;
  select count(*)::integer into completed_columns
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where cell % 5 = group_no) = 1;
  select count(*)::integer into completed_regions
  from generate_series(0, 4) group_no
  where (select count(*) from unnest(queens) cell where (regions->cell)::integer = group_no) = 1;

  solved := coalesce(array_length(queens, 1), 0) = 5
    and completed_rows = 5 and completed_columns = 5 and completed_regions = 5
    and conflicting_queens = 0;

  return jsonb_build_object(
    'kind', 'queens',
    'queens', to_jsonb(queens),
    'placedQueens', coalesce(array_length(queens, 1), 0),
    'completedRows', completed_rows,
    'completedColumns', completed_columns,
    'completedRegions', completed_regions,
    'conflictingQueens', conflicting_queens,
    'solved', solved
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.question_version_detail (
  target_question_version uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  definition_row private.question_definitions%rowtype;
  result jsonb;
begin
  select definition.* into definition_row
  from private.question_definitions definition
  join private.question_versions version on version.question_definition_id = definition.id
  where version.id = target_question_version;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'questionDefinitionId', definition_row.id,
    'slug', definition_row.slug,
    'versions', coalesce(jsonb_agg(
      jsonb_build_object(
        'questionDefinitionId', version.question_definition_id,
        'questionVersionId', version.id,
        'versionNumber', version.version_number,
        'status', version.status,
        'slug', definition_row.slug,
        'type', version.type,
        'question', version.public_payload->>'question',
        'category', version.public_payload->>'category',
        'tags', coalesce(version.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', version.time_limit_ms,
        'createdAt', version.created_at,
        'updatedAt', version.updated_at,
        'publishedAt', version.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = version.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = version.id),
        'document', private.question_version_document(version.id)
      ) order by version.version_number desc
    ), '[]'::jsonb)
  ) into result
  from private.question_versions version
  where version.question_definition_id = definition_row.id;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.question_version_document (
  target_question_version uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'slug', definition.slug,
    'type', version.type,
    'payloadSchemaVersion', version.payload_schema_version,
    'timeLimitMs', version.time_limit_ms,
    'publicPayload', version.public_payload,
    'solutionPayload', solution.solution_payload
  )
  from private.question_versions version
  join private.question_definitions definition on definition.id = version.question_definition_id
  join private.question_version_solutions solution on solution.question_version_id = version.id
  where version.id = target_question_version;
$function$;

CREATE OR REPLACE FUNCTION private.read_attempt_recovery (
  target_attempt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'attemptId', a.id, 'scheduledChallengeId', a.scheduled_challenge_id, 'status', a.status,
    'lockVersion', a.lock_version,
    'hasStartedInteraction', exists (select 1 from private.attempt_timing_units u where u.attempt_id = a.id),
    'hasOpenInteraction', exists (select 1 from private.interaction_intervals interval_row
      where interval_row.attempt_id = a.id and interval_row.ended_at is null),
    'allItemsResolved', not exists (select 1 from private.challenge_items i where i.challenge_version_id = a.challenge_version_id
      and not exists (select 1 from private.attempt_answers aa where aa.attempt_id = a.id and aa.challenge_item_id = i.id)),
    'challengeMode', cv.mode,
    'initialLives', case when cv.mode = 'survival' then (cv.mode_config->>'lives')::integer else null end,
    'livesRemaining', case when cv.mode = 'survival' then greatest((cv.mode_config->>'lives')::integer - coalesce((
      select sum(case
        when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
        when question.type in ('matching', 'queens')
          and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
        else 0 end)::integer
      from private.attempt_answers answer
      join private.challenge_items item on item.id = answer.challenge_item_id
      join private.question_versions question on question.id = item.question_version_id
      where answer.attempt_id = a.id
    ), 0), 0) else null end,
    'terminalOutcome', case when cv.mode = 'survival' and (
      greatest((cv.mode_config->>'lives')::integer - coalesce((
        select sum(case
          when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
          when question.type in ('matching', 'queens')
            and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
          else 0 end)::integer
        from private.attempt_answers answer
        join private.challenge_items item on item.id = answer.challenge_item_id
        join private.question_versions question on question.id = item.question_version_id
        where answer.attempt_id = a.id
      ), 0), 0) = 0
    ) then 'eliminated' when cv.mode = 'survival' and not exists (
      select 1 from private.challenge_items item where item.challenge_version_id = a.challenge_version_id
        and not exists (select 1 from private.attempt_answers answer where answer.attempt_id = a.id and answer.challenge_item_id = item.id)
    ) then 'survived'
      when cv.mode = 'pyramid' and exists (select 1 from private.attempt_answers answer
        where answer.attempt_id = a.id and answer.status <> 'correct') then 'failed'
      when cv.mode = 'pyramid' and (
        select count(*) from private.attempt_answers answer where answer.attempt_id = a.id
      ) = 7 then 'summit'
      else null end,
    'answers', coalesce((select jsonb_agg(jsonb_build_object('challengeItemId', aa.challenge_item_id,
      'status', aa.status, 'answer', aa.answer, 'points', aa.points, 'timeUsedMs', aa.time_used_ms,
      'resultDetails', aa.result_details) order by i.position)
      from private.attempt_answers aa join private.challenge_items i on i.id = aa.challenge_item_id where aa.attempt_id = a.id), '[]'::jsonb)
  ) into result
  from public.attempts a join private.attempt_sessions s on s.attempt_id = a.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  where a.id = target_attempt and a.player_id = actor and a.kind = 'competitive'
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_avatar_upload_asset (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  asset uuid := (input->>'assetId')::uuid;
  result jsonb;
begin
  select jsonb_build_object(
    'assetId', id, 'objectPath', object_path, 'status', status
  ) into result
  from private.media_assets
  where id = asset and owner_player_id = actor;
  return result;
exception when invalid_text_representation then
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_competitive_question_asset (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result
  from public.attempts attempt
  join private.challenge_items item on item.challenge_version_id = attempt.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  join private.media_assets asset on asset.id = coalesce(
    question.public_payload->'surface'->>'assetId',
    question.public_payload->'media'->>'assetId'
  )::uuid
  where attempt.id = (input->>'attemptId')::uuid
    and attempt.player_id = actor and attempt.kind = 'competitive'
    and item.question_version_id is not null
    and question.payload_schema_version = 2
    and (
      (question.type = 'progressive-image' and question.public_payload->'surface' ? 'assetId')
      or (question.type = 'multiple-choice' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'estimation' and question.public_payload->'media' ? 'assetId')
      or (question.type = 'heat-map' and question.public_payload->'surface' ? 'assetId')
    )
    and asset.kind = 'question-asset' and asset.status in ('ready','archived')
    and asset.id = (input->>'assetId')::uuid;
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
exception when invalid_text_representation then raise exception 'not_authorized' using errcode = '42501';
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_evaluation_context (
  target_receipt uuid,
  session_token  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  select jsonb_build_object(
    'receiptId', r.id, 'answer', case when q.type = 'matching' then coalesce((
      select jsonb_object_agg(e.left_item_id, e.right_item_id)
      from private.matching_pair_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '{}'::jsonb) when q.type = 'queens' then private.queens_answer(r.attempt_id, r.challenge_item_id) when q.type = 'word-search' then jsonb_build_object('foundWordIds', coalesce((
      select jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.correct
    ), '[]'::jsonb)) else r.answer end, 'receivedAt', r.received_at,
    'timeUsedMs', r.time_used_ms, 'timedOut', r.timed_out,
    'questionType', q.type, 'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', q.public_payload,
    'submittedCodes', case when q.type = 'logic-code' then coalesce((
      select jsonb_agg(e.code order by e.sequence)
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), '[]'::jsonb) else null end,
    'progressiveCluesRevealed', case when q.type = 'progressive-clues' then coalesce((
      select max(e.clue_index)::integer
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
    ), 1) else null end,
    'progressiveClueAvailablePoints', case when q.type = 'progressive-clues' then coalesce((
      select e.available_points
      from private.progressive_clue_reveal_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id
      order by e.clue_index desc
      limit 1
    ), i.points) else null end,
    'matchingIncorrectAttempts', case when q.type = 'matching' then coalesce((
      select count(*)::integer from private.matching_pair_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'incorrectAttempts', case when q.type = 'logic-code' then coalesce((
      select count(*)::integer
      from private.logic_code_attempt_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) when q.type = 'queens' then coalesce((
      select count(*)::integer
      from private.queens_placement_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and e.penalty_applied
    ), 0) when q.type = 'word-search' then coalesce((
      select count(*)::integer from private.word_search_selection_events e
      where e.attempt_id = r.attempt_id and e.challenge_item_id = r.challenge_item_id and not e.correct
    ), 0) else null end,
    'solutionPayload', qs.solution_payload, 'timeLimitMs', q.time_limit_ms,
    'itemPoints', i.points, 'itemConfigSchemaVersion', i.config_schema_version,
    'itemConfig', i.mode_config, 'mode', cv.mode,
    'modeConfigSchemaVersion', cv.config_schema_version, 'modeConfig', cv.mode_config)
  into result from private.answer_receipts r
  join public.attempts a on a.id = r.attempt_id
  join private.attempt_sessions s on s.attempt_id = a.id
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons season on season.id = sc.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships m on m.room_id = room.id and m.player_id = actor
  join private.challenge_items i on i.id = r.challenge_item_id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  where r.id = target_receipt and a.player_id = actor and a.status = 'in_progress'
    and a.kind = 'competitive' and sc.status <> 'cancelled' and room.status = 'active'
    and m.status = 'active' and m.role in ('owner', 'admin', 'member')
    and s.revoked_at is null and s.session_token_hash = private.secret_hash(session_token)
    and not exists (select 1 from private.platform_role_assignments where player_id = actor);
  if result is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_question_asset_upload (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.command_actor(); result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments where player_id = actor and role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select jsonb_build_object('assetId', asset.id, 'objectPath', asset.object_path, 'status', asset.status)
    into result from private.media_assets asset
    where asset.id = (input->>'assetId')::uuid and asset.kind = 'question-asset';
  return result;
exception when invalid_text_representation then return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_superadmin_editorial_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'challengeVersionId', version.id,
          'versionNumber', version.version_number,
          'status', version.status,
          'slug', definition.slug,
          'title', version.title,
          'subtitle', version.subtitle,
          'description', version.description,
          'mode', version.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
          'createdAt', version.created_at,
          'updatedAt', version.updated_at,
          'publishedAt', version.published_at,
          'document', case when version.status = 'draft' then jsonb_build_object(
            'challenge', jsonb_build_object(
              'slug', definition.slug,
              'title', version.title,
              'subtitle', version.subtitle,
              'description', version.description,
              'mode', version.mode,
              'configSchemaVersion', version.config_schema_version,
              'modeConfig', version.mode_config
            ),
            'questions', coalesce((
              select jsonb_agg(
                case when question.status <> 'draft' then jsonb_build_object(
                  'source', 'library',
                  'questionVersionId', question.id,
                  'points', item.points,
                  'modeConfig', item.mode_config,
                  'challengeItemId', item.id
                ) else jsonb_build_object(
                  'slug', question_definition.slug,
                  'type', question.type,
                  'payloadSchemaVersion', question.payload_schema_version,
                  'timeLimitMs', question.time_limit_ms,
                  'points', item.points,
                  'publicPayload', question.public_payload,
                  'solutionPayload', solution.solution_payload
                ) || case when version.mode = 'pyramid'
                  then jsonb_build_object('modeConfig', item.mode_config) else '{}'::jsonb end end
                order by item.position
              )
              from private.challenge_items item
              join private.question_versions question on question.id = item.question_version_id
              join private.question_definitions question_definition on question_definition.id = question.question_definition_id
              join private.question_version_solutions solution on solution.question_version_id = question.id
              where item.challenge_version_id = version.id
            ), '[]'::jsonb)
          ) else null end
        ) order by version.updated_at desc, version.id
      )
      from private.challenge_versions version
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.read_superadmin_question_library (
  input jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  page_value integer := greatest(1, least(coalesce((input->>'page')::integer, 1), 10000));
  page_size_value integer := greatest(1, least(coalesce((input->>'pageSize')::integer, 25), 100));
  search_value text := nullif(btrim(input->>'search'), '');
  type_value text := nullif(btrim(input->>'type'), '');
  status_value text := coalesce(nullif(btrim(input->>'status'), ''), 'published');
  tag_value text := nullif(btrim(input->>'tag'), '');
  total_value integer;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['page', 'pageSize', 'search', 'type', 'status', 'tag']))
    or status_value not in ('all', 'draft', 'published', 'archived') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  with candidates as (
    select version.id, row_number() over (
      partition by version.question_definition_id order by version.version_number desc, version.id desc
    ) as latest_version
    from private.question_versions version
    join private.question_definitions definition on definition.id = version.question_definition_id
    where (status_value = 'all' or version.status = status_value)
      and (type_value is null or version.type = type_value)
      and (search_value is null or definition.slug ilike '%' || search_value || '%'
        or version.public_payload->>'question' ilike '%' || search_value || '%')
      and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
  )
  select count(*) into total_value
  from candidates
  where status_value <> 'published' or latest_version = 1;

  return jsonb_build_object(
    'entries', coalesce((
      with candidates as (
        select version.*, definition.slug, row_number() over (
          partition by version.question_definition_id order by version.version_number desc, version.id desc
        ) as latest_version
        from private.question_versions version
        join private.question_definitions definition on definition.id = version.question_definition_id
        where (status_value = 'all' or version.status = status_value)
          and (type_value is null or version.type = type_value)
          and (search_value is null or definition.slug ilike '%' || search_value || '%'
            or version.public_payload->>'question' ilike '%' || search_value || '%')
          and (tag_value is null or coalesce(version.public_payload->'tags', '{}'::jsonb)::text ilike '%' || tag_value || '%')
      )
      select jsonb_agg(jsonb_build_object(
        'questionDefinitionId', candidate.question_definition_id,
        'questionVersionId', candidate.id,
        'versionNumber', candidate.version_number,
        'status', candidate.status,
        'slug', candidate.slug,
        'type', candidate.type,
        'question', candidate.public_payload->>'question',
        'category', candidate.public_payload->>'category',
        'tags', coalesce(candidate.public_payload->'tags', '{}'::jsonb),
        'timeLimitMs', candidate.time_limit_ms,
        'createdAt', candidate.created_at,
        'updatedAt', candidate.updated_at,
        'publishedAt', candidate.published_at,
        'versionCount', (select count(*) from private.question_versions count_version
          where count_version.question_definition_id = candidate.question_definition_id),
        'usageCount', (select count(*) from private.challenge_items usage
          where usage.question_version_id = candidate.id)
      ) order by candidate.updated_at desc, candidate.id
      ) from candidates candidate
      where status_value <> 'published' or candidate.latest_version = 1
      offset (page_value - 1) * page_size_value limit page_size_value
    ), '[]'::jsonb),
    'total', total_value,
    'page', page_value,
    'pageSize', page_size_value
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.receive_answer (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('receive', input)
$function$;

CREATE OR REPLACE FUNCTION private.record_evaluation (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('evaluate', input)
$function$;

CREATE OR REPLACE FUNCTION private.recover_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor(); key text := input->>'idempotencyKey';
  safe_input jsonb := input; cached private.command_requests%rowtype;
  a public.attempts%rowtype; s private.attempt_sessions%rowtype;
  cv private.challenge_versions%rowtype;
  segment private.interaction_intervals%rowtype; unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype; question private.question_versions%rowtype;
  receipt private.answer_receipts%rowtype; instant timestamptz := clock_timestamp();
  expected bigint; presented timestamptz; used_ms bigint; effective timestamptz; result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object' or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array['idempotencyKey','attemptId','lockVersion','sessionToken'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform private.lock_command_key(actor, key);
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'recover' or cached.input <> safe_input) then raise exception 'idempotency_conflict' using errcode = '40001'; end if;
  if cached.result is not null then return cached.result; end if;
  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into s from private.attempt_sessions where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or s.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into receipt from private.answer_receipts r where r.attempt_id = a.id and not exists (
    select 1 from private.attempt_answers aa where aa.receipt_id = r.id
  ) order by r.received_at limit 1 for update;
  if found then
    result := jsonb_build_object('receiptId', receipt.id, 'recovered', false);
  else
    select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
    if found then
      select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
      select * into item from private.challenge_items where id = segment.challenge_item_id;
      select * into question from private.question_versions where id = item.question_version_id;
      select * into cv from private.challenge_versions where id = a.challenge_version_id;
      if cv.mode = 'alphabet' and instant < unit.deadline_at then
        update private.interaction_intervals
        set ended_at = greatest(segment.started_at, least(instant, unit.deadline_at)),
            end_reason = 'recovery_interrupted'
        where id = segment.id;
        result := jsonb_build_object('receiptId', null, 'recovered', true,
          'recoveryInterrupted', true, 'challengeItemId', segment.challenge_item_id);
      elsif cv.mode <> 'pyramid'
        and question.type in ('mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'progressive-image', 'queens', 'word-search', 'word-hashtag', 'zip', 'escape')
        and instant < unit.deadline_at then
        result := jsonb_build_object('receiptId', null, 'recovered', false, 'preserved', true);
      else
        effective := greatest(segment.started_at, least(instant, unit.deadline_at));
        update private.interaction_intervals set ended_at = effective, end_reason = 'recovery_interrupted' where id = segment.id;
        select min(started_at), coalesce(sum(floor(extract(epoch from (ended_at - started_at)) * 1000)), 0)::bigint
          into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = segment.challenge_item_id;
        insert into private.answer_receipts(attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
          presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
        values(a.id, segment.challenge_item_id, a.challenge_version_id,
          case when question.type = 'word-hashtag'
            then coalesce(a.progress_payload->'answer', jsonb_build_object('swaps', '[]'::jsonb))
            else null end,
          instant, presented, effective, used_ms,
          instant >= unit.deadline_at, null) returning * into receipt;
        result := jsonb_build_object('receiptId', receipt.id, 'recovered', true);
      end if;
    else
      result := jsonb_build_object('receiptId', null, 'recovered', false);
    end if;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'recover', 'attempt', a.id, key, jsonb_build_object('lockVersion', expected), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'recover', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.reject_rewrite()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  raise exception 'Historical records cannot be overwritten or deleted';
end;
$function$;

CREATE OR REPLACE FUNCTION private.require_room_owner()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare target_id uuid;
begin
  if tg_table_name = 'rooms' then target_id := new.id;
  else target_id := coalesce(new.room_id, old.room_id); end if;
  if exists (select 1 from public.rooms where id = target_id and status = 'active')
    and (select count(*) from public.room_memberships where room_id = target_id
      and role = 'owner' and status = 'active') <> 1 then
    raise exception 'An active room requires exactly one active owner';
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.reveal_progressive_clue (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  event private.progressive_clue_reveal_events%rowtype;
  instant timestamptz := clock_timestamp();
  expected bigint;
  total_clues integer;
  next_index integer;
  effective_penalty integer;
  available_points integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId'
    ])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'reveal_progressive_clue' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;

  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'progressive-clues' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  perform private.ensure_progressive_clue_initial(a.id, item.id, a.challenge_version_id);
  total_clues := jsonb_array_length(question.public_payload->'clues');
  select coalesce(max(e.clue_index), 0) + 1 into next_index
    from private.progressive_clue_reveal_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  if next_index > total_clues then
    raise exception 'all_clues_revealed' using errcode = '55000';
  end if;

  effective_penalty := private.progressive_clue_effective_penalty(
    (question.public_payload->>'cluePenalty')::integer,
    item.points
  );
  available_points := greatest(0, item.points - effective_penalty * (next_index - 1));
  insert into private.progressive_clue_reveal_events(
    attempt_id, challenge_item_id, challenge_version_id, clue_index,
    penalty_points, available_points, revealed_at, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, next_index,
    effective_penalty, available_points, instant, key
  ) returning * into event;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id,
    'challengeItemId', item.id,
    'lockVersion', a.lock_version,
    'clueIndex', event.clue_index,
    'clue', question.public_payload->'clues'->>(event.clue_index - 1),
    'revealedClues', event.clue_index,
    'totalClues', total_clues,
    'availablePoints', event.available_points,
    'cluePenalty', event.penalty_points
  );
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'reveal_progressive_clue', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'clueIndex', event.clue_index,
        'availablePoints', event.available_points));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'reveal_progressive_clue', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.room_slug_base (
  value text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select left(
    btrim(
      regexp_replace(
        regexp_replace(
          translate(lower(btrim(value)),
            'áàäâãéèëêíìïîóòöôõúùüûñç',
            'aaaaaeeeeiiiiooooouuuunc'),
          '[^a-z0-9]+', '-', 'g'
        ),
        '(^-+|-+$)', '', 'g'
      ),
      '-'
    ),
    64
  );
$function$;

CREATE OR REPLACE FUNCTION private.run_calendar_tick_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  run_id_value text;
  now_value timestamptz;
  room_id_value uuid;
  schedule_row public.scheduled_challenges%rowtype;
  season_row public.seasons%rowtype;
  opened_count integer := 0;
  closed_count integer := 0;
  finished_count integer := 0;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' then
    raise exception 'calendar_tick_unauthorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ? 'runId'
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> 'runId')
    or jsonb_typeof(input->'runId') is distinct from 'string' then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;
  run_id_value := btrim(input->>'runId');
  if char_length(run_id_value) not between 8 and 160 then
    raise exception 'calendar_tick_invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('calendar-tick-global', 0));
  now_value := clock_timestamp();

  -- Administrative commands and the tick always acquire room, then season,
  -- then publication locks. This avoids cross-slice deadlocks.
  for room_id_value in
    select distinct season.room_id
    from public.seasons season
    left join public.scheduled_challenges schedule on schedule.season_id = season.id
    where (season.status = 'active' and season.ends_at <= now_value)
       or (schedule.status in ('scheduled', 'open') and schedule.closes_at <= now_value)
    order by season.room_id
  loop
    perform 1 from public.rooms room where room.id = room_id_value for update;
  end loop;

  for season_row in
    select season.*
    from public.seasons season
    where (season.status = 'active' and season.ends_at <= now_value)
       or exists (
         select 1 from public.scheduled_challenges schedule
         where schedule.season_id = season.id
           and schedule.status in ('scheduled', 'open')
           and schedule.closes_at <= now_value
       )
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status in ('scheduled', 'open')
      and schedule.closes_at <= now_value
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'closed'
    where id = schedule_row.id and status in ('scheduled', 'open') and closes_at <= now_value;
    if found then
      closed_count := closed_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'close_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', schedule_row.status), jsonb_build_object('status', 'closed')
      );
    end if;
  end loop;

  for schedule_row in
    select schedule.*
    from public.scheduled_challenges schedule
    join public.seasons season on season.id = schedule.season_id
    where schedule.status = 'scheduled'
      and schedule.opens_at <= now_value and now_value < schedule.closes_at
      and season.status = 'active'
      and season.starts_at <= now_value and now_value < season.ends_at
    order by schedule.id
  loop
    perform 1 from public.scheduled_challenges schedule where schedule.id = schedule_row.id for update;
    update public.scheduled_challenges
    set status = 'open'
    where id = schedule_row.id and status = 'scheduled'
      and opens_at <= now_value and now_value < closes_at;
    if found then
      opened_count := opened_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'open_scheduled_challenge', 'scheduled_challenge', schedule_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'scheduled'), jsonb_build_object('status', 'open')
      );
    end if;
  end loop;

  for season_row in
    select season.* from public.seasons season
    where season.status = 'active' and season.ends_at <= now_value
    order by season.id
  loop
    perform 1 from public.seasons season where season.id = season_row.id for update;
    update public.seasons set status = 'finished'
    where id = season_row.id and status = 'active' and ends_at <= now_value;
    if found then
      finished_count := finished_count + 1;
      insert into private.audit_log(
        actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
      ) values (
        null, 'finish_season', 'season', season_row.id, 'calendar tick', run_id_value,
        jsonb_build_object('status', 'active'), jsonb_build_object('status', 'finished')
      );
    end if;
  end loop;

  return jsonb_build_object(
    'runId', run_id_value, 'evaluatedAt', now_value,
    'opened', opened_count, 'closed', closed_count, 'finishedSeasons', finished_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.secret_hash (
  secret text
)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
begin
  if secret is null or length(secret) < 32 then raise exception 'invalid_token' using errcode = '22023'; end if;
  return encode(sha256(convert_to(secret, 'UTF8')), 'hex');
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('start', input)
$function$;

CREATE OR REPLACE FUNCTION private.submit_logic_code_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.logic_code_attempt_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  code_length integer;
  sequence_no integer;
  incorrect_attempts integer;
  normalized_code text;
  normalized_solution text;
  solved boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','code','clientTimeUsedMs'
    ]))
    or input->>'code' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{code}', to_jsonb(encode(sha256(convert_to(input->>'code', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_logic_code_attempt' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'logic-code' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  code_length := (question.public_payload->>'codeLength')::integer;
  normalized_code := btrim(input->>'code');
  normalized_solution := solution.solution_payload->>'correctAnswer';
  if code_length not between 1 and 12
    or char_length(normalized_code) <> code_length
    or normalized_code !~ '^[0-9]+$'
    or char_length(normalized_solution) <> code_length
    or normalized_solution !~ '^[0-9]+$' then
    raise exception 'invalid_logic_code' using errcode = '22023';
  end if;
  if exists (select 1 from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.code = normalized_code) then
    raise exception 'duplicate_logic_code' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.logic_code_attempt_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  solved := normalized_code = normalized_solution;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.logic_code_attempt_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, code, correct,
    penalty_applied, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, normalized_code, solved,
    not solved, instant, presented, used_ms, key)
  returning * into event;
  if not solved then
    incorrect_attempts := sequence_no;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', false, 'terminal', false,
      'incorrectAttempts', incorrect_attempts);
  else
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    incorrect_attempts := (select count(*)::integer from private.logic_code_attempt_events e
      where e.attempt_id = a.id and e.challenge_item_id = item.id and not e.correct);
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, to_jsonb(event.code), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
    result := jsonb_build_object(
      'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version + 1,
      'sequence', event.sequence, 'code', event.code, 'correct', true, 'terminal', true,
      'incorrectAttempts', incorrect_attempts, 'receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_set(result, '{lockVersion}', to_jsonb(a.lock_version));
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_logic_code_attempt', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'sequence', event.sequence, 'terminal', solved));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_logic_code_attempt', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_matching_pair (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  challenge_version private.challenge_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.matching_pair_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  total_pairs integer;
  penalty integer;
  solved boolean;
  terminal boolean;
  lives_remaining integer;
  mistakes_before integer;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','leftItemId','rightItemId']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','leftItemId','rightItemId','clientTimeUsedMs'
    ]))
    or input->>'leftItemId' is null or btrim(input->>'leftItemId') = ''
    or input->>'rightItemId' is null or btrim(input->>'rightItemId') = '' then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_matching_pair' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into challenge_version from private.challenge_versions where id = a.challenge_version_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'matching' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'leftItems') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'rightItems') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'matches') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  if not exists (select 1 from jsonb_array_elements(question.public_payload->'leftItems') value
    where value->>'id' = btrim(input->>'leftItemId'))
    or not exists (select 1 from jsonb_array_elements(question.public_payload->'rightItems') value
    where value->>'id' = btrim(input->>'rightItemId')) then
    raise exception 'invalid_matching_pair' using errcode = '22023';
  end if;
  if exists (select 1 from private.matching_pair_events e where e.attempt_id = a.id
    and e.challenge_item_id = item.id and e.left_item_id = btrim(input->>'leftItemId')
    and e.right_item_id = btrim(input->>'rightItemId')) then
    raise exception 'duplicate_matching_pair' using errcode = '55000';
  end if;
  if exists (select 1 from private.matching_pair_events e where e.attempt_id = a.id
    and e.challenge_item_id = item.id and e.correct
    and (e.left_item_id = btrim(input->>'leftItemId') or e.right_item_id = btrim(input->>'rightItemId'))) then
    raise exception 'matching_item_already_resolved' using errcode = '55000';
  end if;

  total_pairs := jsonb_array_length(question.public_payload->'leftItems');
  solved := solution.solution_payload->'matches'->>btrim(input->>'leftItemId') = btrim(input->>'rightItemId');
  penalty := case when solved then 0 else round(item.points * 0.10::numeric)::integer end;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.matching_pair_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.matching_pair_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    left_item_id, right_item_id, correct, penalty_points,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    btrim(input->>'leftItemId'), btrim(input->>'rightItemId'), solved, penalty,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.matching_progress(a.id, item.id);
  terminal := solved and (progress->>'matchedCount')::integer = total_pairs;
  if not terminal and not solved and challenge_version.mode = 'survival' then
    select coalesce(sum(case
      when answer.status in ('incorrect', 'unanswered', 'timeout') then 1
      when previous_question.type in ('matching', 'queens')
        and coalesce((answer.result_details->>'incorrectAttempts')::integer, 0) > 0 then 1
      else 0 end), 0)::integer
    into mistakes_before
    from private.attempt_answers answer
    join private.challenge_items previous_item on previous_item.id = answer.challenge_item_id
    join private.question_versions previous_question on previous_question.id = previous_item.question_version_id
    where answer.attempt_id = a.id;
    lives_remaining := greatest((challenge_version.mode_config->>'lives')::integer - mistakes_before, 0);
    terminal := lives_remaining = 1;
  end if;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id,
      coalesce((select jsonb_object_agg(e.left_item_id, e.right_item_id)
        from private.matching_pair_events e where e.attempt_id = a.id and e.challenge_item_id = item.id and e.correct), '{}'::jsonb),
      instant, presented, effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'leftItemId', event.left_item_id, 'rightItemId', event.right_item_id,
    'correct', event.correct, 'terminal', terminal,
    'matchedPairs', progress->'matchedPairs', 'matchedCount', progress->'matchedCount',
    'totalPairs', progress->'totalPairs', 'incorrectAttempts', progress->'incorrectAttempts',
    'penaltyPoints', progress->'penaltyPoints'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_matching_pair', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'leftItemId', event.left_item_id,
        'rightItemId', event.right_item_id, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_matching_pair', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_mini_wordle_guess (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.mini_wordle_guess_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  attempts_used integer;
  max_attempts integer;
  expected_word_length integer;
  normalized_guess text;
  normalized_solution text;
  selected_dictionary_id text;
  feedback jsonb;
  solved boolean;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','guess','clientTimeUsedMs'
    ]))
    or input->>'guess' is null
  then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  safe_input := jsonb_set(safe_input, '{guess}', to_jsonb(encode(sha256(convert_to(input->>'guess', 'UTF8')), 'hex')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_mini_wordle_guess' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'mini-wordle' then raise exception 'unsupported_question' using errcode = '22023'; end if;

  expected_word_length := (question.public_payload->>'wordLength')::integer;
  max_attempts := (question.public_payload->>'maxAttempts')::integer;
  selected_dictionary_id := solution.solution_payload->>'dictionaryId';
  normalized_guess := private.mini_wordle_normalize(input->>'guess');
  normalized_solution := private.mini_wordle_normalize(solution.solution_payload->>'correctAnswer');
  if char_length(normalized_guess) <> expected_word_length or normalized_guess !~ '^[A-ZÑ]+$'
    or not (
      normalized_guess = normalized_solution
      or
      exists (select 1 from private.mini_wordle_dictionary_words d
        where d.dictionary_id = selected_dictionary_id and d.word_length = expected_word_length and d.word = normalized_guess)
      or exists (select 1 from jsonb_array_elements_text(solution.solution_payload->'additionalGuesses') extra(value)
        where private.mini_wordle_normalize(extra.value) = normalized_guess)
    ) then
    raise exception 'invalid_mini_wordle_guess' using errcode = '22023';
  end if;
  if exists (select 1 from private.mini_wordle_guess_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id and e.guess = normalized_guess) then
    raise exception 'duplicate_mini_wordle_guess' using errcode = '55000';
  end if;
  select count(*)::integer into attempts_used from private.mini_wordle_guess_events
    where attempt_id = a.id and challenge_item_id = item.id;
  if attempts_used >= max_attempts then raise exception 'attempt_terminal' using errcode = '55000'; end if;

  feedback := private.mini_wordle_feedback(normalized_guess, normalized_solution);
  solved := normalized_guess = normalized_solution;
  terminal := solved or attempts_used + 1 >= max_attempts;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  insert into private.mini_wordle_guess_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, guess, feedback, solved,
    received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, attempts_used + 1, normalized_guess, feedback, solved,
    instant, presented, used_ms, key)
  returning * into event;
  if terminal then
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id,
      jsonb_build_object('guesses', (select jsonb_agg(e.guess order by e.sequence)
        from private.mini_wordle_guess_events e where e.attempt_id = a.id and e.challenge_item_id = item.id)),
      instant, presented, effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint)
    returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'sequence', event.sequence, 'guess', event.guess, 'feedback', event.feedback,
    'attemptsUsed', event.sequence, 'maxAttempts', max_attempts, 'terminal', terminal,
    'timeUsedMs', used_ms);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_mini_wordle_guess', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'attemptsUsed', attempts_used),
      jsonb_build_object('lockVersion', a.lock_version, 'attemptsUsed', event.sequence, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_mini_wordle_guess', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_queens_placement (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  event private.queens_placement_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  cell integer;
  action text;
  current_queens integer[];
  next_queens integer[];
  progress jsonb;
  conflicting boolean;
  penalty boolean;
  penalty_points integer;
  sequence_no integer;
  terminal boolean;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','cell','action'
    ]))
    or jsonb_typeof(input->'cell') is distinct from 'number'
    or (input->>'cell')::numeric <> trunc((input->>'cell')::numeric)
    or input->>'action' not in ('place', 'remove') then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  cell := (input->>'cell')::integer;
  action := input->>'action';
  if cell not between 0 and 24 then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_queens_placement' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  if question.type <> 'queens' or question.payload_schema_version <> 1 then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;

  current_queens := private.queens_board(a.id, item.id);
  if action = 'remove' and cell = any(coalesce((select array_agg(value::integer) from jsonb_array_elements_text(coalesce(question.public_payload->'prefilledQueens', '[]'::jsonb)) value), '{}'::integer[])) then
    raise exception 'prefilled_queen_locked' using errcode = '55000';
  end if;
  if action = 'place' and cell = any(current_queens) then raise exception 'duplicate_queens_placement' using errcode = '55000'; end if;
  if action = 'remove' and not cell = any(current_queens) then raise exception 'invalid_queens_placement' using errcode = '22023'; end if;
  next_queens := case when action = 'place' then current_queens || cell else array_remove(current_queens, cell) end;
  conflicting := action = 'place' and private.queens_cell_conflicts(question.public_payload->'regions', cell, next_queens);
  penalty := conflicting;
  penalty_points := case when penalty then round(item.points * 0.05)::integer else 0 end;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;
  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.queens_placement_events e where e.attempt_id = a.id and e.challenge_item_id = item.id;
  insert into private.queens_placement_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence, cell, action,
    conflicting, penalty_applied, penalty_points, received_at, presented_at, time_used_ms, idempotency_key)
  values(a.id, item.id, a.challenge_version_id, sequence_no, cell, action,
    conflicting, penalty, penalty_points, instant, presented, used_ms, key)
  returning * into event;
  progress := private.queens_progress(a.id, item.id);
  terminal := (progress->>'solved')::boolean;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, private.queens_answer(a.id, item.id), instant,
      presented, effective, used_ms, false, null) returning * into receipt;
  end if;
  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'cell', event.cell, 'action', event.action, 'conflicting', event.conflicting,
    'penaltyApplied', event.penalty_applied, 'terminal', terminal,
    'queens', progress->'queens', 'placedQueens', progress->'placedQueens',
    'completedRows', progress->'completedRows', 'completedColumns', progress->'completedColumns',
    'completedRegions', progress->'completedRegions', 'conflictingQueens', progress->'conflictingQueens',
    'solved', progress->'solved');
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_queens_placement', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected, 'cell', cell, 'action', action),
      jsonb_build_object('lockVersion', a.lock_version, 'terminal', terminal, 'penaltyApplied', penalty));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_queens_placement', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_word_hashtag_swap (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  from_cell integer;
  to_cell integer;
  max_moves integer;
  current_progress jsonb;
  next_progress jsonb;
  state jsonb;
  letters jsonb;
  solution_letters jsonb;
  next_letters jsonb;
  terminal boolean;
  solved boolean := false;
  correct_cells integer[] := array[]::integer[];
  next_moves_used integer;
  next_moves_remaining integer;
  index integer;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','fromCell','toCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'fromCell') is distinct from 'number'
    or jsonb_typeof(input->'toCell') is distinct from 'number'
    or (input->>'fromCell')::numeric <> trunc((input->>'fromCell')::numeric)
    or (input->>'toCell')::numeric <> trunc((input->>'toCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  from_cell := (input->>'fromCell')::integer;
  to_cell := (input->>'toCell')::integer;
  if from_cell not between 0 and 24 or to_cell not between 0 and 24 or from_cell = to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_hashtag_swap' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then raise exception 'session_revoked' using errcode = '42501'; end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then raise exception 'stale_version' using errcode = '40001'; end if;
  select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then raise exception 'deadline_reached' using errcode = '55000'; end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-hashtag' or question.payload_schema_version <> 1
    or not private.word_hashtag_content_valid(question.public_payload, solution.solution_payload) then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  max_moves := (question.public_payload->>'maxMoves')::integer;
  current_progress := coalesce(a.progress_payload, jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', '[]'::jsonb)));
  if current_progress->>'kind' <> 'word-hashtag' or current_progress->>'challengeItemId' <> item.id::text then
    raise exception 'invalid_progress' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)) >= max_moves then
    raise exception 'word_hashtag_moves_exhausted' using errcode = '55000';
  end if;
  state := private.word_hashtag_progress(a.id, item.id);
  letters := state->'letters';
  solution_letters := private.word_hashtag_solution_letters(solution.solution_payload);
  if ((from_cell / 5) not in (1, 3) and (from_cell % 5) not in (1, 3))
    or ((to_cell / 5) not in (1, 3) and (to_cell % 5) not in (1, 3))
    or letters->from_cell is null or letters->to_cell is null
    or letters->from_cell = letters->to_cell
    or letters->from_cell = solution_letters->from_cell
    or letters->to_cell = solution_letters->to_cell then
    raise exception 'invalid_word_hashtag_swap' using errcode = '22023';
  end if;
  next_progress := jsonb_build_object(
    'kind', 'word-hashtag', 'challengeItemId', item.id,
    'answer', jsonb_build_object('swaps', coalesce(current_progress->'answer'->'swaps', '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('fromCell', from_cell, 'toCell', to_cell))));
  next_letters := jsonb_set(
    jsonb_set(letters, array[from_cell::text], letters->to_cell),
    array[to_cell::text], letters->from_cell
  );
  next_moves_used := (state->>'movesUsed')::integer + 1;
  next_moves_remaining := greatest(0, max_moves - next_moves_used);
  terminal := next_moves_used >= max_moves;
  solved := true;
  for index in 0..24 loop
    if (next_letters->index) is distinct from (solution_letters->index) then
      solved := false;
    elsif (next_letters->index) <> 'null'::jsonb then
      correct_cells := array_append(correct_cells, index);
    end if;
  end loop;
  terminal := terminal or solved;
  if terminal then
    update public.attempts
      set progress_payload = null, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  else
    update public.attempts
      set progress_payload = next_progress, lock_version = lock_version + 1, last_activity_at = instant
      where id = a.id;
  end if;
  select * into a from public.attempts where id = a.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then raise exception 'request_predates_presentation' using errcode = '40001'; end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms from private.interaction_intervals where attempt_id = a.id and challenge_item_id = item.id;
  if terminal then
    update private.interaction_intervals set ended_at = effective, end_reason = 'answer' where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms)
    values(a.id, item.id, a.challenge_version_id, next_progress->'answer', instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
  end if;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'letters', next_letters, 'movesUsed', next_moves_used,
    'movesRemaining', next_moves_remaining, 'correctCells', to_jsonb(correct_cells), 'terminal', terminal);
  if terminal then result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms); end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_hashtag_swap', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'movesUsed', next_moves_used, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_hashtag_swap', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.submit_word_search_selection (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := private.command_actor();
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  session_row private.attempt_sessions%rowtype;
  segment private.interaction_intervals%rowtype;
  unit private.attempt_timing_units%rowtype;
  item private.challenge_items%rowtype;
  question private.question_versions%rowtype;
  solution private.question_version_solutions%rowtype;
  event private.word_search_selection_events%rowtype;
  receipt private.answer_receipts%rowtype;
  instant timestamptz := clock_timestamp();
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  expected bigint;
  sequence_no integer;
  start_cell_i integer;
  end_cell_i integer;
  target_id text;
  total_words integer;
  grid_rows integer;
  grid_columns integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  terminal boolean;
  progress jsonb;
  result jsonb;
begin
  if jsonb_typeof(input) is distinct from 'object'
    or key is null or btrim(key) = ''
    or not input ?& array['idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell']
    or exists (select 1 from jsonb_object_keys(input) k where k <> all(array[
      'idempotencyKey','attemptId','lockVersion','sessionToken','challengeItemId','startCell','endCell','clientTimeUsedMs'
    ]))
    or jsonb_typeof(input->'startCell') is distinct from 'number'
    or jsonb_typeof(input->'endCell') is distinct from 'number'
    or (input->>'startCell')::numeric <> trunc((input->>'startCell')::numeric)
    or (input->>'endCell')::numeric <> trunc((input->>'endCell')::numeric) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  start_cell_i := (input->>'startCell')::integer;
  end_cell_i := (input->>'endCell')::integer;
  if start_cell_i < 0 or end_cell_i < 0 or start_cell_i = end_cell_i then
    raise exception 'invalid_word_search_selection' using errcode = '22023';
  end if;
  safe_input := jsonb_set(safe_input, '{sessionToken}', to_jsonb(private.secret_hash(input->>'sessionToken')));
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> 'submit_word_search_selection' or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  if cached.result is not null then return cached.result; end if;

  select * into a from public.attempts where id = (input->>'attemptId')::uuid for update;
  if not found or a.player_id <> actor or a.kind <> 'competitive' or a.status <> 'in_progress'
    or exists (select 1 from private.platform_role_assignments where player_id = actor) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into session_row from private.attempt_sessions
    where attempt_id = a.id and session_token_hash = safe_input->>'sessionToken';
  if not found or session_row.revoked_at is not null then
    raise exception 'session_revoked' using errcode = '42501';
  end if;
  expected := (input->>'lockVersion')::bigint;
  if expected is distinct from a.lock_version then
    raise exception 'stale_version' using errcode = '40001';
  end if;
  select * into segment from private.interaction_intervals
    where attempt_id = a.id and ended_at is null for update;
  if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
    raise exception 'interaction_not_presented' using errcode = '55000';
  end if;
  select * into unit from private.attempt_timing_units where id = segment.timing_unit_id;
  if instant >= unit.deadline_at then
    raise exception 'deadline_reached' using errcode = '55000';
  end if;
  select * into item from private.challenge_items where id = segment.challenge_item_id;
  select * into question from private.question_versions where id = item.question_version_id;
  select * into solution from private.question_version_solutions where question_version_id = question.id;
  if question.type <> 'word-search' or question.payload_schema_version <> 1
    or jsonb_typeof(question.public_payload->'grid') is distinct from 'object'
    or jsonb_typeof(question.public_payload->'letters') is distinct from 'array'
    or jsonb_typeof(question.public_payload->'targets') is distinct from 'array'
    or jsonb_typeof(solution.solution_payload->'positionsByTargetId') is distinct from 'object' then
    raise exception 'unsupported_question' using errcode = '22023';
  end if;
  total_words := jsonb_array_length(question.public_payload->'targets');
  grid_rows := (question.public_payload->'grid'->>'rows')::integer;
  grid_columns := (question.public_payload->'grid'->>'columns')::integer;

  select positions.key into target_id
  from jsonb_each(solution.solution_payload->'positionsByTargetId') positions
  where (positions.value->>'startCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'endCell')::integer in (start_cell_i, end_cell_i)
    and (positions.value->>'startCell')::integer <> (positions.value->>'endCell')::integer
  limit 1;
  if target_id is null then
    start_row_i := floor(start_cell_i / grid_columns);
    start_col_i := start_cell_i % grid_columns;
    end_row_i := floor(end_cell_i / grid_columns);
    end_col_i := end_cell_i % grid_columns;
    if start_cell_i >= grid_rows * grid_columns or end_cell_i >= grid_rows * grid_columns
      or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
      raise exception 'invalid_word_search_selection' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id
      and e.correct and e.matched_target_id = target_id) then
    raise exception 'word_search_target_already_found' using errcode = '55000';
  end if;

  select coalesce(max(e.sequence), 0) + 1 into sequence_no
    from private.word_search_selection_events e
    where e.attempt_id = a.id and e.challenge_item_id = item.id;
  effective := least(instant, unit.deadline_at);
  if instant < segment.started_at then
    raise exception 'request_predates_presentation' using errcode = '40001';
  end if;
  select min(started_at), coalesce(sum(floor(extract(epoch from (coalesce(ended_at, effective) - started_at)) * 1000)), 0)::bigint
    into presented, used_ms
    from private.interaction_intervals
    where attempt_id = a.id and challenge_item_id = item.id;

  insert into private.word_search_selection_events(
    attempt_id, challenge_item_id, challenge_version_id, sequence,
    start_cell, end_cell, matched_target_id, correct,
    received_at, presented_at, time_used_ms, idempotency_key
  ) values (
    a.id, item.id, a.challenge_version_id, sequence_no,
    start_cell_i, end_cell_i, target_id, target_id is not null,
    instant, presented, used_ms, key
  ) returning * into event;

  progress := private.word_search_progress(a.id, item.id);
  terminal := (progress->>'foundCount')::integer = total_words;
  if terminal then
    update private.interaction_intervals
      set ended_at = effective, end_reason = 'answer'
      where id = segment.id;
    insert into private.answer_receipts(
      attempt_id, challenge_item_id, challenge_version_id, answer, received_at,
      presented_at, effective_submitted_at, time_used_ms, timed_out, client_time_used_ms
    ) values (
      a.id, item.id, a.challenge_version_id, jsonb_build_object('foundWordIds', progress->'foundWordIds'), instant, presented,
      effective, used_ms, false, (input->>'clientTimeUsedMs')::bigint
    ) returning * into receipt;
  end if;

  update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
    where id = a.id returning * into a;
  result := jsonb_build_object(
    'attemptId', a.id, 'challengeItemId', item.id, 'lockVersion', a.lock_version,
    'startCell', event.start_cell, 'endCell', event.end_cell,
    'correct', event.correct, 'terminal', terminal,
    'matchedTargetId', event.matched_target_id,
    'foundSelections', progress->'foundSelections', 'foundWordIds', progress->'foundWordIds',
    'foundCount', progress->'foundCount', 'totalWords', progress->'totalWords',
    'incorrectAttempts', progress->'incorrectAttempts'
  );
  if terminal then
    result := result || jsonb_build_object('receiptId', receipt.id, 'timeUsedMs', used_ms);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, request_id, before_payload, after_payload)
    values(actor, 'submit_word_search_selection', 'attempt', a.id, key,
      jsonb_build_object('lockVersion', expected),
      jsonb_build_object('lockVersion', a.lock_version, 'startCell', event.start_cell,
        'endCell', event.end_cell, 'correct', event.correct, 'terminal', terminal));
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
    values(actor, key, 'submit_word_search_selection', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.take_over_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  -- Cross-device control transfer is deliberately deferred for the MVP.
  raise exception 'takeover_disabled' using errcode = '55000';
end;
$function$;

CREATE OR REPLACE FUNCTION private.touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_flash_draft_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  reason_value text;
  document_value jsonb;
  document_hash text;
  expected_updated_at timestamptz;
  challenge_version_id_value uuid;
  safe_input jsonb;
  cached private.command_requests%rowtype;
  challenge_row private.challenge_versions%rowtype;
  definition_row private.challenge_definitions%rowtype;
  item_row private.challenge_items%rowtype;
  question_row private.question_versions%rowtype;
  question_definition_row private.question_definitions%rowtype;
  old_question_definition_id uuid;
  existing_item_count integer;
  desired_item_count integer;
  question_index integer;
  question_definition_id uuid;
  question_version_id uuid;
  item_id uuid;
  question jsonb;
  result jsonb;
  before_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array['idempotencyKey', 'challengeVersionId', 'expectedUpdatedAt', 'document', 'reason']))
    or input->'idempotencyKey' is null or input->'challengeVersionId' is null
    or input->'expectedUpdatedAt' is null or input->'document' is null or input->'reason' is null then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  document_value := input->'document';
  begin
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    expected_updated_at := (input->>'expectedUpdatedAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_editorial_document(document_value);
  document_hash := encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex');
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'challengeVersionId', challenge_version_id_value,
    'expectedUpdatedAt', expected_updated_at, 'documentHash', document_hash, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-editorial-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_flash_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select * into challenge_row from private.challenge_versions version
  where version.id = challenge_version_id_value for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if challenge_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if challenge_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.challenge_definitions definition
  where definition.id = challenge_row.challenge_definition_id for update;

  desired_item_count := jsonb_array_length(document_value->'questions');
  select count(*) into existing_item_count
  from private.challenge_items item
  where item.challenge_version_id = challenge_version_id_value;
  before_payload := jsonb_build_object(
    'challengeDefinitionId', definition_row.id, 'challengeVersionId', challenge_row.id,
    'status', challenge_row.status, 'slug', definition_row.slug, 'title', challenge_row.title,
    'updatedAt', challenge_row.updated_at, 'questionCount', existing_item_count
  );

  begin
    update private.challenge_definitions
    set slug = document_value->'challenge'->>'slug'
    where id = definition_row.id;
    update private.challenge_versions
    set config_schema_version = 1,
        mode = document_value->'challenge'->>'mode',
        title = document_value->'challenge'->>'title',
        subtitle = document_value->'challenge'->>'subtitle',
        description = document_value->'challenge'->>'description',
        global_time_limit_ms = (document_value->'challenge'->>'globalTimeLimitMs')::integer,
        max_score = (select coalesce(sum((value->>'points')::integer), 0)
          from jsonb_array_elements(document_value->'questions') value),
        mode_config = document_value->'challenge'->'modeConfig'
    where id = challenge_version_id_value;

    if existing_item_count > desired_item_count then
      for item_row in
        select item.* from private.challenge_items item
        where item.challenge_version_id = challenge_version_id_value
          and item.position > desired_item_count
        order by item.position desc for update
      loop
        select version.question_definition_id into old_question_definition_id
        from private.question_versions version
        where version.id = item_row.question_version_id;
        delete from private.challenge_items where id = item_row.id;
        delete from private.question_version_solutions solution
        where solution.question_version_id = item_row.question_version_id;
        delete from private.question_versions where id = item_row.question_version_id;
        delete from private.question_definitions
        where id = old_question_definition_id
          and not exists (
            select 1 from private.question_versions version
            where version.question_definition_id = old_question_definition_id
          );
      end loop;
    elsif existing_item_count < desired_item_count then
      for question, question_index in
        select value, ordinality::integer
        from jsonb_array_elements(document_value->'questions') with ordinality
        where ordinality > existing_item_count
      loop
        item_id := gen_random_uuid();
        if question->>'source' = 'library' then
          question_version_id := (question->>'questionVersionId')::uuid;
          if not exists (
            select 1 from private.question_versions version
            where version.id = question_version_id and version.status = 'published'
          ) then
            raise exception 'question_not_published' using errcode = '55000';
          end if;
        else
          question_definition_id := gen_random_uuid();
          question_version_id := gen_random_uuid();
          insert into private.question_definitions(id, slug, created_by_player_id)
          values (question_definition_id, question->>'slug', actor);
          insert into private.question_versions(
            id, question_definition_id, version_number, payload_schema_version, status, type,
            time_limit_ms, public_payload, created_by_player_id
          ) values (
            question_version_id, question_definition_id, 1, (question->>'payloadSchemaVersion')::integer, 'draft', question->>'type',
            (question->>'timeLimitMs')::integer, question->'publicPayload', actor
          );
          insert into private.question_version_solutions(question_version_id, solution_payload)
          values (question_version_id, question->'solutionPayload');
        end if;
        insert into private.challenge_items(
          id, challenge_version_id, question_version_id, position, points,
          config_schema_version, mode_config
        ) values (item_id, challenge_version_id_value, question_version_id, question_index,
          (question->>'points')::integer, 1, coalesce(question->'modeConfig', '{}'::jsonb));
      end loop;
    end if;

    for item_row in
      select item.* from private.challenge_items item
      where item.challenge_version_id = challenge_version_id_value
      order by item.position for update
    loop
      question := coalesce(
        (
          select value from jsonb_array_elements(document_value->'questions') value
          where value->>'challengeItemId' = item_row.id::text
          limit 1
        ),
        document_value->'questions'->(item_row.position - 1)
      );
      if question->>'source' = 'library' then
        question_version_id := (question->>'questionVersionId')::uuid;
        if not exists (
          select 1 from private.question_versions version
          where version.id = question_version_id and version.status = 'published'
        ) then
          raise exception 'question_not_published' using errcode = '55000';
        end if;
        update private.challenge_items
        set question_version_id = (question->>'questionVersionId')::uuid,
            points = (question->>'points')::integer,
            config_schema_version = 1,
            mode_config = coalesce(question->'modeConfig', '{}'::jsonb)
        where id = item_row.id;
      else
        select * into question_row from private.question_versions version
        where version.id = item_row.question_version_id for update;
        select * into question_definition_row from private.question_definitions definition
        where definition.id = question_row.question_definition_id for update;
        if question_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
        update private.question_definitions
        set slug = question->>'slug'
        where id = question_definition_row.id;
        update private.question_versions
        set payload_schema_version = (question->>'payloadSchemaVersion')::integer,
            type = question->>'type',
            time_limit_ms = (question->>'timeLimitMs')::integer,
            public_payload = question->'publicPayload'
        where id = question_row.id;
        update private.question_version_solutions solution
        set solution_payload = question->'solutionPayload'
        where solution.question_version_id = question_row.id;
        update private.challenge_items
        set points = (question->>'points')::integer, config_schema_version = 1,
            mode_config = coalesce(question->'modeConfig', '{}'::jsonb)
        where id = item_row.id;
      end if;
    end loop;
  exception when unique_violation then
    raise exception 'content_slug_conflict' using errcode = '23505';
  end;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'challengeVersionId', version.id,
    'versionNumber', version.version_number,
    'status', version.status,
    'slug', definition.slug,
    'title', version.title,
    'subtitle', version.subtitle,
    'description', version.description,
    'mode', version.mode,
    'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
    'createdAt', version.created_at,
    'updatedAt', version.updated_at,
    'publishedAt', version.published_at,
    'document', null
  ) into result
  from private.challenge_definitions definition
  join private.challenge_versions version on version.challenge_definition_id = definition.id
  where version.id = challenge_version_id_value;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'update_flash_draft', 'challenge_version', challenge_version_id_value, reason_value, key,
    before_payload, jsonb_build_object(
      'documentHash', document_hash,
      'status', 'draft',
      'updatedAt', result->>'updatedAt',
      'questionCount', result->>'questionCount',
      'maxScore', (select max_score from private.challenge_versions where id = challenge_version_id_value)
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_flash_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_question_draft_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text := btrim(input->>'idempotencyKey');
  reason_value text := btrim(input->>'reason');
  version_id uuid := (input->>'questionVersionId')::uuid;
  expected_updated_at timestamptz := (input->>'expectedUpdatedAt')::timestamptz;
  document_value jsonb := input->'document';
  cached private.command_requests%rowtype;
  version_row private.question_versions%rowtype;
  definition_row private.question_definitions%rowtype;
  safe_input jsonb;
  result jsonb;
begin
  if actor is null or not exists (select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason']
    or exists (select 1 from jsonb_object_keys(input) key_name where key_name <> all(array[
      'idempotencyKey', 'questionVersionId', 'expectedUpdatedAt', 'document', 'reason'])) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  if char_length(key) not between 8 and 160 or char_length(reason_value) not between 1 and 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  perform private.validate_flash_question_document(document_value);
  safe_input := jsonb_build_object('idempotencyKey', key, 'questionVersionId', version_id,
    'expectedUpdatedAt', expected_updated_at,
    'documentHash', encode(sha256(convert_to(document_value::text, 'UTF8')), 'hex'), 'reason', reason_value);
  perform pg_advisory_xact_lock(hashtextextended('question-library:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_question_draft' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;
  select * into version_row from private.question_versions version where version.id = version_id for update;
  if not found then raise exception 'content_not_found' using errcode = 'P0002'; end if;
  if version_row.status <> 'draft' then raise exception 'content_not_draft' using errcode = '55000'; end if;
  if version_row.updated_at <> expected_updated_at then raise exception 'content_conflict' using errcode = '40001'; end if;
  select * into definition_row from private.question_definitions definition
  where definition.id = version_row.question_definition_id for update;
  if definition_row.slug <> document_value->>'slug' then raise exception 'content_slug_conflict' using errcode = '23505'; end if;
  update private.question_versions set type = document_value->>'type',
    payload_schema_version = (document_value->>'payloadSchemaVersion')::integer,
    time_limit_ms = (document_value->>'timeLimitMs')::integer,
    public_payload = document_value->'publicPayload'
  where id = version_id;
  update private.question_version_solutions set solution_payload = document_value->'solutionPayload'
  where question_version_id = version_id;
  result := private.question_version_detail(version_id);
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload) values (actor, 'update_question_draft', 'question_version', version_id,
    reason_value, key, jsonb_build_object('updatedAt', version_row.updated_at), result);
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_question_draft', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_scheduled_challenge_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  schedule_id_value uuid;
  expected_updated_at_value timestamptz;
  challenge_version_id_value uuid;
  number_value integer;
  opens_at_value timestamptz;
  closes_at_value timestamptz;
  reason_value text;
  now_value timestamptz;
  room_id_value uuid;
  season_id_value uuid;
  cached private.command_requests%rowtype;
  schedule_row public.scheduled_challenges%rowtype;
  season_row public.seasons%rowtype;
  result jsonb;
  before_payload jsonb;
  safe_input jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','scheduledChallengeId','expectedUpdatedAt','challengeVersionId','number','opensAt','closesAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  reason_value := btrim(input->>'reason');
  if jsonb_typeof(input->'number') is distinct from 'number'
    or (input->>'number') !~ '^[0-9]+$'
    or char_length(key) not between 8 and 160
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_command' using errcode = '22023';
  end if;
  begin
    schedule_id_value := (input->>'scheduledChallengeId')::uuid;
    expected_updated_at_value := (input->>'expectedUpdatedAt')::timestamptz;
    challenge_version_id_value := (input->>'challengeVersionId')::uuid;
    number_value := (input->>'number')::integer;
    opens_at_value := (input->>'opensAt')::timestamptz;
    closes_at_value := (input->>'closesAt')::timestamptz;
  exception when others then
    raise exception 'invalid_command' using errcode = '22023';
  end;
  if number_value <= 0 then raise exception 'invalid_command' using errcode = '22023'; end if;
  safe_input := jsonb_build_object(
    'idempotencyKey', key, 'scheduledChallengeId', schedule_id_value,
    'expectedUpdatedAt', expected_updated_at_value, 'challengeVersionId', challenge_version_id_value,
    'number', number_value, 'opensAt', opens_at_value, 'closesAt', closes_at_value, 'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-calendar-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_scheduled_challenge' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select schedule.season_id into season_id_value
  from public.scheduled_challenges schedule where schedule.id = schedule_id_value;
  if not found then raise exception 'schedule_not_found' using errcode = '22023'; end if;
  select season.room_id into room_id_value from public.seasons season where season.id = season_id_value;
  if not found then raise exception 'season_not_found' using errcode = '22023'; end if;
  perform 1 from public.rooms room where room.id = room_id_value for update;
  if not found then raise exception 'room_not_found' using errcode = '22023'; end if;
  select season.* into season_row from public.seasons season where season.id = season_id_value for update;
  select schedule.* into schedule_row from public.scheduled_challenges schedule
  where schedule.id = schedule_id_value for update;
  if schedule_row.status = 'open' then raise exception 'schedule_already_open' using errcode = '55000'; end if;
  if schedule_row.status <> 'scheduled' then raise exception 'schedule_not_editable' using errcode = '55000'; end if;
  if schedule_row.updated_at <> expected_updated_at_value then
    raise exception 'schedule_conflict' using errcode = '40001';
  end if;
  now_value := clock_timestamp();
  if now_value >= schedule_row.opens_at then raise exception 'schedule_already_open' using errcode = '55000'; end if;
  if season_row.status <> 'active' then raise exception 'season_not_active' using errcode = '55000'; end if;
  if not exists (select 1 from public.rooms room where room.id = room_id_value and room.status = 'active') then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if opens_at_value <= now_value or opens_at_value >= closes_at_value
    or season_row.starts_at > opens_at_value or closes_at_value > season_row.ends_at
    or closes_at_value <= now_value then
    raise exception 'invalid_schedule_dates' using errcode = '22007';
  end if;
  perform private.assert_supported_calendar_content(challenge_version_id_value);

  before_payload := jsonb_build_object(
    'status', schedule_row.status, 'number', schedule_row.number,
    'challengeVersionId', schedule_row.challenge_version_id,
    'opensAt', schedule_row.opens_at, 'closesAt', schedule_row.closes_at
  );
  begin
    update public.scheduled_challenges
    set challenge_version_id = challenge_version_id_value,
        number = number_value, opens_at = opens_at_value, closes_at = closes_at_value
    where id = schedule_id_value;
  exception
    when unique_violation then raise exception 'schedule_number_conflict' using errcode = '23505';
    when exclusion_violation then raise exception 'schedule_overlap' using errcode = '23P01';
  end;
  select jsonb_build_object(
    'scheduledChallengeId', schedule.id, 'roomId', season.room_id,
    'seasonId', schedule.season_id, 'challengeVersionId', schedule.challenge_version_id,
    'number', schedule.number, 'status', schedule.status,
    'opensAt', schedule.opens_at, 'closesAt', schedule.closes_at, 'updatedAt', schedule.updated_at
  ) into result
  from public.scheduled_challenges schedule join public.seasons season on season.id = schedule.season_id
  where schedule.id = schedule_id_value;
  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload
  ) values (
    actor, 'update_scheduled_challenge', 'scheduled_challenge', schedule_id_value, reason_value, key,
    before_payload, jsonb_build_object(
      'status', 'scheduled', 'number', number_value, 'challengeVersionId', challenge_version_id_value,
      'opensAt', opens_at_value, 'closesAt', closes_at_value
    )
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_scheduled_challenge', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.update_season_command (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  key text;
  season_id_value uuid;
  title_value text;
  starts_at_value timestamptz;
  ends_at_value timestamptz;
  reason_value text;
  cached private.command_requests%rowtype;
  season_row public.seasons%rowtype;
  room_status text;
  safe_input jsonb;
  before_payload jsonb;
  result jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if input is null or jsonb_typeof(input) is distinct from 'object'
    or not input ?& array['idempotencyKey','seasonId','title','startsAt','endsAt','reason']
    or exists (
      select 1 from jsonb_object_keys(input) key_name
      where key_name <> all(array['idempotencyKey','seasonId','title','startsAt','endsAt','reason'])
    )
    or exists (
      select 1 from unnest(array['idempotencyKey','seasonId','title','startsAt','endsAt','reason']) key_name
      where input->key_name is null or input->key_name = 'null'::jsonb
    ) then
    raise exception 'invalid_command' using errcode = '22023';
  end if;

  key := btrim(input->>'idempotencyKey');
  title_value := btrim(input->>'title');
  reason_value := btrim(input->>'reason');
  if char_length(key) not between 8 and 160
    or char_length(title_value) not between 3 and 80
    or char_length(reason_value) = 0 or char_length(reason_value) > 500 then
    raise exception 'invalid_season' using errcode = '22023';
  end if;

  begin
    season_id_value := (input->>'seasonId')::uuid;
    starts_at_value := (input->>'startsAt')::timestamptz;
    ends_at_value := (input->>'endsAt')::timestamptz;
  exception when others then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end;
  if starts_at_value >= ends_at_value then
    raise exception 'invalid_season_dates' using errcode = '22007';
  end if;

  safe_input := jsonb_build_object(
    'idempotencyKey', key,
    'seasonId', season_id_value,
    'title', title_value,
    'startsAt', starts_at_value,
    'endsAt', ends_at_value,
    'reason', reason_value
  );
  perform pg_advisory_xact_lock(hashtextextended('superadmin-season-command:' || actor || ':' || key, 0));
  select * into cached
  from private.command_requests request
  where request.actor_id = actor and request.idempotency_key = key;
  if found then
    if cached.operation <> 'update_season' or cached.input <> safe_input then
      raise exception 'idempotency_conflict' using errcode = '40001';
    end if;
    return cached.result;
  end if;

  select season.*
  into season_row
  from public.seasons season
  join public.rooms room on room.id = season.room_id
  where season.id = season_id_value
  for update of season, room;
  if not found then
    raise exception 'season_not_found' using errcode = '22023';
  end if;
  select room.status into room_status from public.rooms room where room.id = season_row.room_id;
  if room_status <> 'active' then
    raise exception 'room_not_found' using errcode = '22023';
  end if;
  if season_row.status <> 'draft' then
    raise exception 'season_not_draft' using errcode = '55000';
  end if;

  before_payload := jsonb_build_object(
    'seasonId', season_row.id,
    'roomId', season_row.room_id,
    'title', season_row.title,
    'status', season_row.status,
    'startsAt', season_row.starts_at,
    'endsAt', season_row.ends_at
  );
  update public.seasons
  set title = title_value, starts_at = starts_at_value, ends_at = ends_at_value
  where id = season_id_value
  returning jsonb_build_object(
    'seasonId', id,
    'roomId', room_id,
    'title', title,
    'status', status,
    'startsAt', starts_at,
    'endsAt', ends_at
  ) into result;

  insert into private.audit_log(
    actor_player_id, action, entity_type, entity_id, reason, request_id,
    before_payload, after_payload
  ) values (
    actor, 'update_season', 'season', season_id_value, reason_value, key,
    before_payload, result
  );
  insert into private.command_requests(actor_id, idempotency_key, operation, input, result)
  values (actor, key, 'update_season', safe_input, result);
  return result;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_flash_editorial_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  challenge jsonb;
  question jsonb;
  question_slug text;
  seen_slugs text[] := array[]::text[];
  question_index integer;
  question_points numeric;
  total_points integer := 0;
  seen_question_versions text[] := array[]::text[];
  seen_level_ids text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object'
    or not document ?& array['challenge', 'questions']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['challenge', 'questions'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  challenge := document->'challenge';
  if jsonb_typeof(challenge) is distinct from 'object'
    or not challenge ?& array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig']
    or exists (
      select 1 from jsonb_object_keys(challenge) key_name
      where key_name <> all(array['slug', 'title', 'subtitle', 'description', 'mode', 'configSchemaVersion', 'modeConfig', 'globalTimeLimitMs'])
    )
    or jsonb_typeof(challenge->'slug') is distinct from 'string'
    or char_length(btrim(challenge->>'slug')) not between 1 and 120
    or jsonb_typeof(challenge->'title') is distinct from 'string'
    or char_length(btrim(challenge->>'title')) not between 1 and 200
    or jsonb_typeof(challenge->'subtitle') is distinct from 'string'
    or char_length(challenge->>'subtitle') > 300
    or jsonb_typeof(challenge->'description') is distinct from 'string'
    or char_length(challenge->>'description') > 2000
    or challenge->>'mode' not in ('flash', 'alphabet', 'survival', 'pyramid')
    or challenge->'configSchemaVersion' <> '1'::jsonb
    or jsonb_typeof(challenge->'modeConfig') is distinct from 'object'
    or (challenge->>'mode' = 'alphabet' and (
      jsonb_typeof(challenge->'globalTimeLimitMs') is distinct from 'number'
      or (challenge->>'globalTimeLimitMs')::numeric <> trunc((challenge->>'globalTimeLimitMs')::numeric)
      or (challenge->>'globalTimeLimitMs')::integer <= 0
    ))
    or (challenge->>'mode' <> 'alphabet' and challenge ? 'globalTimeLimitMs')
    or (challenge->>'mode' = 'survival' and (
      (select count(*) from jsonb_object_keys(challenge->'modeConfig')) <> 1
      or jsonb_typeof(challenge->'modeConfig'->'lives') is distinct from 'number'
      or (challenge->'modeConfig'->>'lives')::numeric <> trunc((challenge->'modeConfig'->>'lives')::numeric)
      or (challenge->'modeConfig'->>'lives')::integer not between 1 and 20
    ))
    or (challenge->>'mode' = 'pyramid' and challenge->'modeConfig' <> '{}'::jsonb) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  if jsonb_typeof(document->'questions') is distinct from 'array'
    or (challenge->>'mode' = 'pyramid' and jsonb_array_length(document->'questions') <> 7)
    or (challenge->>'mode' <> 'pyramid' and jsonb_array_length(document->'questions') not between 2 and 20) then
    raise exception 'incomplete_content' using errcode = '22023';
  end if;

  if challenge->>'mode' = 'survival'
    and (challenge->'modeConfig'->>'lives')::integer > jsonb_array_length(document->'questions') then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  for question, question_index in
    select value, ordinality::integer
    from jsonb_array_elements(document->'questions') with ordinality
  loop
    if challenge->>'mode' = 'pyramid' then
      if not private.is_valid_pyramid_level_config(question->'modeConfig') then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      if question->'modeConfig'->>'levelId' = any(seen_level_ids) then
        raise exception 'invalid_content' using errcode = '22023';
      end if;
      seen_level_ids := seen_level_ids || (question->'modeConfig'->>'levelId');
    end if;
    if jsonb_typeof(question) = 'object' and question->>'source' = 'library' then
      if exists (
          select 1 from jsonb_object_keys(question) key_name
          where key_name <> all(array['source', 'questionVersionId', 'points', 'modeConfig', 'challengeItemId'])
        )
        or not question ?& array['source', 'questionVersionId', 'points', 'modeConfig']
        or jsonb_typeof(question->'questionVersionId') is distinct from 'string'
        or question->>'questionVersionId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or jsonb_typeof(question->'points') is distinct from 'number'
        or (question->>'points')::numeric <> trunc((question->>'points')::numeric)
        or (question->>'points')::integer <= 0
        or (question->>'points')::integer > 100
        or jsonb_typeof(question->'modeConfig') is distinct from 'object'
        or (question ? 'challengeItemId' and (
          jsonb_typeof(question->'challengeItemId') is distinct from 'string'
          or question->>'challengeItemId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or question->>'questionVersionId' = any(seen_question_versions) then
        raise exception 'invalid_question_reference' using errcode = '22023';
      end if;
      seen_question_versions := seen_question_versions || (question->>'questionVersionId');
      if challenge->>'mode' in ('survival', 'pyramid') and not exists (
        select 1 from private.question_versions supported
        where supported.id = (question->>'questionVersionId')::uuid
          and supported.type <> 'short-text'
          and private.is_supported_flash_question(supported.id)
      ) then
        raise exception 'unsupported_question' using errcode = '22023';
      end if;
      total_points := total_points + (question->>'points')::integer;
      continue;
    end if;
    if jsonb_typeof(question) is distinct from 'object'
      or not question ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload']
      or exists (
        select 1 from jsonb_object_keys(question) key_name
        where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'points', 'publicPayload', 'solutionPayload', 'modeConfig'])
      )
      or (challenge->>'mode' = 'pyramid' and not private.is_valid_pyramid_level_config(question->'modeConfig'))
      or (challenge->>'mode' <> 'pyramid' and question ? 'modeConfig') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;

    if challenge->>'mode' = 'survival' and question->>'type' = 'short-text' then
      raise exception 'unsupported_question' using errcode = '22023';
    end if;

    perform private.validate_flash_question_document(question - 'points' - 'modeConfig');
    question_slug := btrim(question->>'slug');
    if question_slug = any(seen_slugs) then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_typeof(question->'points') is distinct from 'number' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    question_points := (question->>'points')::numeric;
    if question_points <> trunc(question_points)
      or question_points <= 0
      or question_points > 100 then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    total_points := total_points + question_points::integer;
    seen_slugs := seen_slugs || question_slug;
  end loop;
  if challenge->>'mode' = 'alphabet' then
    if exists (
      select 1 from jsonb_array_elements(document->'questions') question_row
      where question_row->>'source' <> 'library'
        or jsonb_typeof(question_row->'modeConfig') is distinct from 'object'
        or jsonb_typeof(question_row->'modeConfig'->'letter') is distinct from 'string'
        or char_length(question_row->'modeConfig'->>'letter') = 0
        or char_length(question_row->'modeConfig'->>'letter') > 4
        or question_row->'modeConfig'->>'letter' !~ '^[[:alpha:]]$'
        or not exists (
          select 1 from private.question_versions version
          where version.id = (question_row->>'questionVersionId')::uuid
            and version.status = 'published' and version.type = 'short-text'
        )
    ) then
      raise exception 'invalid_alphabet_item' using errcode = '22023';
    end if;
    if exists (
      select 1 from (
        select lower(question_row->'modeConfig'->>'letter') as letter
        from jsonb_array_elements(document->'questions') question_row
      ) letters group by letter having count(*) > 1
    ) then
      raise exception 'duplicate_alphabet_letter' using errcode = '22023';
    end if;
  elsif exists (
    select 1
    from jsonb_array_elements(document->'questions') question_row
    where question_row->>'type' = 'short-text'
      or (question_row->>'source' = 'library' and exists (
        select 1 from private.question_versions version
        where version.id = (question_row->>'questionVersionId')::uuid
          and version.type = 'short-text'
      ))
  ) then
    raise exception 'short_text_requires_alphabet' using errcode = '22023';
  end if;
  if total_points <> 100 then
    raise exception 'points_total_invalid' using errcode = '22023';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_flash_question_document (
  document jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  question jsonb;
  public_payload jsonb;
  solution_payload jsonb;
  option jsonb;
  question_slug text;
  option_count integer;
  expected_word_length integer;
  max_attempts integer;
  code_length integer;
  selected_dictionary_id text;
  solution_word text;
  guess_word text;
  grid_rows integer;
  grid_columns integer;
  target_id text;
  target_word text;
  target_pos jsonb;
  start_cell_i integer;
  end_cell_i integer;
  start_row_i integer;
  start_col_i integer;
  end_row_i integer;
  end_col_i integer;
  row_step_i integer;
  col_step_i integer;
  word_length_i integer;
  path_cell_i integer;
  path_offset_i integer;
  occurrence_count_i integer;
  candidate_word text;
  candidate_segment text;
  target_segment text;
  check_start integer;
  direction_row integer;
  direction_col integer;
  cell_row integer;
  cell_col integer;
  seen_ids text[] := array[]::text[];
  seen_words text[] := array[]::text[];
  seen_segments text[] := array[]::text[];
begin
  if document is null or jsonb_typeof(document) is distinct from 'object' or document ? 'points' then
    raise exception 'invalid_question_document' using errcode = '22023';
  end if;
  if document->>'type' = 'short-text' then
    if exists (select 1 from jsonb_object_keys(document) key_name where key_name <> all(array[
      'slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload'
    ]))
      or jsonb_typeof(document->'slug') is distinct from 'string'
      or char_length(btrim(document->>'slug')) not between 1 and 120
      or document->'payloadSchemaVersion' <> '1'::jsonb
      or jsonb_typeof(document->'timeLimitMs') is distinct from 'number'
      or (document->>'timeLimitMs')::numeric <> trunc((document->>'timeLimitMs')::numeric)
      or (document->>'timeLimitMs')::integer <= 0
      or jsonb_typeof(document->'publicPayload') is distinct from 'object'
      or not document->'publicPayload' ? 'question'
      or exists (select 1 from jsonb_object_keys(document->'publicPayload') key_name
        where key_name <> all(array['category', 'tags', 'question', 'answerPlaceholder']))
      or private.editorial_has_secret_key(document->'publicPayload')
      or jsonb_typeof(document->'publicPayload'->'question') is distinct from 'string'
      or char_length(btrim(document->'publicPayload'->>'question')) not between 1 and 2000
      or (document->'publicPayload' ? 'category' and jsonb_typeof(document->'publicPayload'->'category') is distinct from 'string')
      or (document->'publicPayload' ? 'tags' and jsonb_typeof(document->'publicPayload'->'tags') is distinct from 'object')
      or (document->'publicPayload' ? 'answerPlaceholder' and jsonb_typeof(document->'publicPayload'->'answerPlaceholder') not in ('null', 'string'))
      or jsonb_typeof(document->'solutionPayload') is distinct from 'object'
      or not document->'solutionPayload' ?& array['correctAnswer', 'acceptedAnswers']
      or exists (select 1 from jsonb_object_keys(document->'solutionPayload') key_name
        where key_name <> all(array['correctAnswer', 'acceptedAnswers', 'explanation']))
      or jsonb_typeof(document->'solutionPayload'->'correctAnswer') is distinct from 'string'
      or char_length(btrim(document->'solutionPayload'->>'correctAnswer')) not between 1 and 500
      or jsonb_typeof(document->'solutionPayload'->'acceptedAnswers') is distinct from 'array'
      or jsonb_array_length(document->'solutionPayload'->'acceptedAnswers') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(document->'solutionPayload'->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      or not exists (select 1 from jsonb_array_elements_text(document->'solutionPayload'->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(document->'solutionPayload'->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')) then
      raise exception 'invalid_question_document' using errcode = '22023';
    end if;
    return;
  end if;

  if not document ?& array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload']
    or exists (
      select 1 from jsonb_object_keys(document) key_name
      where key_name <> all(array['slug', 'type', 'payloadSchemaVersion', 'timeLimitMs', 'publicPayload', 'solutionPayload'])
    ) then
    raise exception 'invalid_content' using errcode = '22023';
  end if;

  question := document;
  question_slug := btrim(question->>'slug');
  if jsonb_typeof(question->'slug') is distinct from 'string'
    or char_length(question_slug) not between 1 and 120
    or question->>'type' not in ('multiple-choice', 'estimation', 'heat-map', 'mini-wordle', 'logic-code', 'logic-matrix', 'progressive-clues', 'matching', 'connect-pairs', 'progressive-image', 'queens', 'true-false', 'odd-one-out', 'ordering', 'anagram', 'classification', 'short-text', 'word-search', 'word-hashtag', 'zip', 'escape')
    or (question->>'type' not in ('progressive-image', 'multiple-choice', 'estimation', 'heat-map') and question->'payloadSchemaVersion' <> '1'::jsonb)
    or (question->>'type' in ('progressive-image', 'multiple-choice') and question->'payloadSchemaVersion' not in ('1'::jsonb, '2'::jsonb))
    or (question->>'type' in ('estimation', 'heat-map') and question->'payloadSchemaVersion' <> '2'::jsonb)
    or jsonb_typeof(question->'timeLimitMs') is distinct from 'number'
    or (question->>'timeLimitMs')::numeric <= 0 then
    raise exception 'invalid_content' using errcode = '22023';
  end if;
  public_payload := question->'publicPayload';
  solution_payload := question->'solutionPayload';
  seen_ids := array[]::text[];
  seen_words := array[]::text[];
  seen_segments := array[]::text[];

  if question->>'type' = 'estimation' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'min', 'max', 'step', 'initialValue', 'unit', 'media']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'min', 'max', 'step', 'initialValue', 'unit', 'media'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'min') is distinct from 'number'
      or jsonb_typeof(public_payload->'max') is distinct from 'number'
      or jsonb_typeof(public_payload->'step') is distinct from 'number'
      or jsonb_typeof(public_payload->'initialValue') is distinct from 'number'
      or (public_payload->>'min')::numeric >= (public_payload->>'max')::numeric
      or (public_payload->>'step')::numeric <= 0
      or (public_payload->>'initialValue')::numeric < (public_payload->>'min')::numeric
      or (public_payload->>'initialValue')::numeric > (public_payload->>'max')::numeric
      or abs(
        ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
        (public_payload->>'step')::numeric - round(
          ((public_payload->>'initialValue')::numeric - (public_payload->>'min')::numeric) /
          (public_payload->>'step')::numeric
        )
      ) > 0.000000001
      or jsonb_typeof(public_payload->'unit') is distinct from 'string'
      or char_length(btrim(public_payload->>'unit')) not between 1 and 120
      or jsonb_typeof(public_payload->'media') not in ('null', 'object')
      or (jsonb_typeof(public_payload->'media') = 'object' and (
        not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
          'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'media'->>'type' <> 'image'
        or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
        or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
        or (public_payload->'media'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
        or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
        or (public_payload->'media'->>'height')::integer not between 1 and 8192
        or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'media' ? 'position' and (
          jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
          or char_length(public_payload->'media'->>'position') > 100
        ))
      )) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['correctAnswer', 'tolerance']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'tolerance', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'number'
      or (solution_payload->>'correctAnswer')::numeric < (public_payload->>'min')::numeric
      or (solution_payload->>'correctAnswer')::numeric > (public_payload->>'max')::numeric
      or jsonb_typeof(solution_payload->'tolerance') is distinct from 'number'
      or (solution_payload->>'tolerance')::numeric < 0
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'heat-map' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'surface', 'targetLabel']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'surface', 'targetLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'targetLabel') is distinct from 'string'
      or char_length(btrim(public_payload->>'targetLabel')) not between 1 and 500
      or jsonb_typeof(public_payload->'surface') is distinct from 'object'
      or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
        'assetId', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
      or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
      or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
      or (public_payload->'surface'->>'width')::integer not between 1 and 8192
      or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
      or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
      or (public_payload->'surface'->>'height')::integer not between 1 and 8192
      or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'surface' ? 'position' and (
        jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
        or char_length(public_payload->'surface'->>'position') > 100
      )) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['target', 'fullCreditRadius', 'toleranceRadius']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'target', 'fullCreditRadius', 'toleranceRadius', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'target') is distinct from 'object'
      or not solution_payload->'target' ?& array['x', 'y']
      or exists (select 1 from jsonb_object_keys(solution_payload->'target') key_name where key_name <> all(array['x', 'y']))
      or jsonb_typeof(solution_payload->'target'->'x') is distinct from 'number'
      or (solution_payload->'target'->>'x')::numeric not between 0 and 1
      or jsonb_typeof(solution_payload->'target'->'y') is distinct from 'number'
      or (solution_payload->'target'->>'y')::numeric not between 0 and 1
      or jsonb_typeof(solution_payload->'fullCreditRadius') is distinct from 'number'
      or (solution_payload->>'fullCreditRadius')::numeric < 0
      or jsonb_typeof(solution_payload->'toleranceRadius') is distinct from 'number'
      or (solution_payload->>'toleranceRadius')::numeric <= (solution_payload->>'fullCreditRadius')::numeric
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'mini-wordle' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'wordLength', 'maxAttempts']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'hint', 'wordLength', 'maxAttempts'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'wordLength') is distinct from 'number'
      or (public_payload->>'wordLength')::integer not in (4, 5)
      or jsonb_typeof(public_payload->'maxAttempts') is distinct from 'number'
      or (public_payload->>'maxAttempts')::integer not between 1 and 10
      or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['correctAnswer', 'additionalGuesses', 'dictionaryId']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'additionalGuesses', 'dictionaryId', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or jsonb_typeof(solution_payload->'additionalGuesses') is distinct from 'array'
      or jsonb_typeof(solution_payload->'dictionaryId') is distinct from 'string'
      or solution_payload->>'dictionaryId' not in ('es-general-4.v1', 'es-general-5.v1')
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    expected_word_length := (public_payload->>'wordLength')::integer;
    max_attempts := (public_payload->>'maxAttempts')::integer;
    selected_dictionary_id := solution_payload->>'dictionaryId';
    if (expected_word_length = 4 and selected_dictionary_id <> 'es-general-4.v1')
      or (expected_word_length = 5 and selected_dictionary_id <> 'es-general-5.v1')
      or char_length(private.mini_wordle_normalize(solution_payload->>'correctAnswer')) <> expected_word_length
      or private.mini_wordle_normalize(solution_payload->>'correctAnswer') !~ '^[A-ZÑ]+$'
      or jsonb_array_length(solution_payload->'additionalGuesses') > 1000
      or exists (select 1 from jsonb_array_elements(solution_payload->'additionalGuesses') extra
        where jsonb_typeof(extra) is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    solution_word := private.mini_wordle_normalize(solution_payload->>'correctAnswer');
    for guess_word in select value from jsonb_array_elements_text(solution_payload->'additionalGuesses') loop
      if char_length(private.mini_wordle_normalize(guess_word)) <> expected_word_length
        or private.mini_wordle_normalize(guess_word) !~ '^[A-ZÑ]+$'
        or private.mini_wordle_normalize(guess_word) = solution_word
        or (select count(*) from jsonb_array_elements_text(solution_payload->'additionalGuesses') values(value)
            where private.mini_wordle_normalize(value) = private.mini_wordle_normalize(guess_word)) > 1 then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
    end loop;
    return;
  end if;

if question->>'type' = 'logic-code' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'clues', 'codeLength']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'clues', 'codeLength'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'clues') is distinct from 'array'
      or jsonb_array_length(public_payload->'clues') not between 1 and 20
      or jsonb_typeof(public_payload->'codeLength') is distinct from 'number'
      or (public_payload->>'codeLength')::integer not between 1 and 12
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or exists (
        select 1
        from jsonb_array_elements(public_payload->'clues') clue
        where jsonb_typeof(clue) is distinct from 'object'
          or not clue ?& array['code', 'hint']
          or exists (select 1 from jsonb_object_keys(clue) key_name where key_name <> all(array['code', 'hint']))
          or jsonb_typeof(clue->'code') is distinct from 'string'
          or char_length(clue->>'code') <> (public_payload->>'codeLength')::integer
          or clue->>'code' !~ '^[0-9]+$'
          or jsonb_typeof(clue->'hint') is distinct from 'string'
          or char_length(btrim(clue->>'hint')) not between 1 and 500
      )
      or (select count(distinct clue->>'code') from jsonb_array_elements(public_payload->'clues') clue)
         <> jsonb_array_length(public_payload->'clues') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(solution_payload->>'correctAnswer') <> (public_payload->>'codeLength')::integer
      or solution_payload->>'correctAnswer' !~ '^[0-9]+$'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'logic-matrix' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'pieces', 'cells', 'optionIds']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'pieces', 'cells', 'optionIds', 'showPieceLabels'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'pieces') is distinct from 'array'
      or jsonb_array_length(public_payload->'pieces') not between 4 and 20
      or exists (
        select 1 from jsonb_array_elements(public_payload->'pieces') piece
        where jsonb_typeof(piece) is distinct from 'object'
          or not piece ?& array['id', 'symbol', 'label']
          or exists (select 1 from jsonb_object_keys(piece) key_name where key_name <> all(array['id', 'symbol', 'label']))
          or jsonb_typeof(piece->'id') is distinct from 'string'
          or char_length(btrim(piece->>'id')) not between 1 and 120
          or jsonb_typeof(piece->'symbol') is distinct from 'string'
          or char_length(btrim(piece->>'symbol')) not between 1 and 120
          or jsonb_typeof(piece->'label') is distinct from 'string'
          or char_length(btrim(piece->>'label')) not between 1 and 500
      )
      or (select count(*) from jsonb_array_elements(public_payload->'pieces') piece)
        <> (select count(distinct piece->>'id') from jsonb_array_elements(public_payload->'pieces') piece)
      or jsonb_typeof(public_payload->'cells') is distinct from 'array'
      or jsonb_array_length(public_payload->'cells') <> 9
      or (select count(*) from jsonb_array_elements(public_payload->'cells') cell where jsonb_typeof(cell) = 'null') <> 1
      or exists (
        select 1 from jsonb_array_elements(public_payload->'cells') cell
        where jsonb_typeof(cell) not in ('null', 'string')
          or (jsonb_typeof(cell) = 'string' and not exists (
            select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = cell #>> '{}'
          ))
      )
      or jsonb_typeof(public_payload->'optionIds') is distinct from 'array'
      or jsonb_array_length(public_payload->'optionIds') <> 4
      or exists (
        select 1 from jsonb_array_elements(public_payload->'optionIds') option_id
        where jsonb_typeof(option_id) is distinct from 'string'
          or not exists (
            select 1 from jsonb_array_elements(public_payload->'pieces') piece where piece->>'id' = option_id #>> '{}'
          )
      )
      or (select count(*) from jsonb_array_elements_text(public_payload->'optionIds'))
        <> (select count(distinct value) from jsonb_array_elements_text(public_payload->'optionIds') value)
      or (public_payload ? 'showPieceLabels' and jsonb_typeof(public_payload->'showPieceLabels') not in ('null', 'boolean'))
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctOptionId'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['correctOptionId', 'explanation']))
      or jsonb_typeof(solution_payload->'correctOptionId') is distinct from 'string'
      or not exists (
        select 1 from jsonb_array_elements_text(public_payload->'optionIds') option_id
        where option_id = solution_payload->>'correctOptionId'
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'progressive-clues' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'clues', 'cluePenalty']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'clues', 'cluePenalty'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'clues') is distinct from 'array'
      or jsonb_array_length(public_payload->'clues') not between 1 and 20
      or jsonb_typeof(public_payload->'cluePenalty') is distinct from 'number'
      or (public_payload->>'cluePenalty')::numeric <> trunc((public_payload->>'cluePenalty')::numeric)
      or (public_payload->>'cluePenalty')::integer not between 0 and 50
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'clues') clue
        where jsonb_typeof(clue) is distinct from 'string'
          or char_length(btrim(clue #>> '{}')) not between 1 and 500
      ) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['correctAnswer', 'acceptedAnswers']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'acceptedAnswers', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
      or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
      or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
      or exists (
        select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500
      )
      or exists (
        select 1
        from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1
      )
      or not exists (
        select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'true-false' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ? 'question'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'boolean'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'odd-one-out' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 3 and 8
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'label']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'media']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
      )
      or exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(public_payload->'items') item
        group by item->>'id' having count(*) > 1
      ) duplicate_id) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or not exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where item->>'id' = solution_payload->>'correctAnswer'
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'connect-pairs' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'grid', 'pairs', 'requireFullCoverage']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'pairs', 'requireFullCoverage'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'grid') is distinct from 'object'
      or public_payload->'grid'->>'rows' <> '5'
      or public_payload->'grid'->>'columns' <> '5'
      or jsonb_typeof(public_payload->'pairs') is distinct from 'array'
      or jsonb_array_length(public_payload->'pairs') not between 3 and 5
      or public_payload->>'requireFullCoverage' <> 'true'
      or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
        where jsonb_typeof(pair) is distinct from 'object'
          or not pair ?& array['id', 'label', 'symbol', 'endpoints']
          or exists (select 1 from jsonb_object_keys(pair) key_name where key_name <> all(array['id', 'label', 'symbol', 'endpoints', 'color']))
          or jsonb_typeof(pair->'id') is distinct from 'string'
          or char_length(btrim(pair->>'id')) not between 1 and 120
          or jsonb_typeof(pair->'label') is distinct from 'string'
          or char_length(btrim(pair->>'label')) not between 1 and 500
          or jsonb_typeof(pair->'symbol') is distinct from 'string'
          or char_length(btrim(pair->>'symbol')) not between 1 and 32
          or jsonb_typeof(pair->'endpoints') is distinct from 'array'
          or jsonb_array_length(pair->'endpoints') <> 2
          or exists (select 1 from jsonb_array_elements(pair->'endpoints') endpoint
            where jsonb_typeof(endpoint) is distinct from 'number'
              or (endpoint #>> '{}')::numeric <> trunc((endpoint #>> '{}')::numeric)
              or (endpoint #>> '{}')::integer not between 0 and 24)
          or (pair ? 'color' and jsonb_typeof(pair->'color') is distinct from 'string'))
      or (select count(distinct pair->>'id') from jsonb_array_elements(public_payload->'pairs') pair)
         <> jsonb_array_length(public_payload->'pairs')
      or (select count(distinct endpoint #>> '{}') from jsonb_array_elements(public_payload->'pairs') pair, jsonb_array_elements(pair->'endpoints') endpoint)
         <> jsonb_array_length(public_payload->'pairs') * 2 then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'paths'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['paths', 'explanation']))
      or jsonb_typeof(solution_payload->'paths') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(solution_payload->'paths')) <> jsonb_array_length(public_payload->'pairs')
      or exists (select 1 from jsonb_array_elements(public_payload->'pairs') pair
        where not solution_payload->'paths' ? (pair->>'id')
          or jsonb_typeof(solution_payload->'paths'->(pair->>'id')) is distinct from 'array')
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'ordering' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items', 'directionLabels'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 2 and 8
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'string'
          or char_length(btrim(item #>> '{}')) not between 1 and 500
      )
      or exists (select 1 from (
        select value from jsonb_array_elements_text(public_payload->'items') group by value having count(*) > 1
      ) duplicate_item)
      or (public_payload ? 'directionLabels' and jsonb_typeof(public_payload->'directionLabels') not in ('null', 'object'))
      or (jsonb_typeof(public_payload->'directionLabels') = 'object' and (
        exists (select 1 from jsonb_object_keys(public_payload->'directionLabels') key_name where key_name not in ('start', 'end'))
        or not (public_payload->'directionLabels' ?& array['start', 'end'])
        or jsonb_typeof(public_payload->'directionLabels'->'start') is distinct from 'string'
        or char_length(btrim(public_payload->'directionLabels'->>'start')) not between 1 and 120
        or jsonb_typeof(public_payload->'directionLabels'->'end') is distinct from 'string'
        or char_length(btrim(public_payload->'directionLabels'->>'end')) not between 1 and 120
      ))
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctOrder'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctOrder', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctOrder') is distinct from 'array'
      or jsonb_array_length(solution_payload->'correctOrder') <> jsonb_array_length(public_payload->'items')
      or exists (
        select 1 from jsonb_array_elements(solution_payload->'correctOrder') item
        where jsonb_typeof(item) is distinct from 'string'
      )
      or exists (
        select 1 from jsonb_array_elements_text(solution_payload->'correctOrder') item
        where not exists (select 1 from jsonb_array_elements_text(public_payload->'items') public_item where public_item = item)
      )
      or (select count(*) from jsonb_array_elements_text(solution_payload->'correctOrder')) <> (
        select count(distinct value) from jsonb_array_elements_text(solution_payload->'correctOrder') value
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'anagram' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'tiles']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'tiles', 'hint'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'tiles') is distinct from 'array'
      or jsonb_array_length(public_payload->'tiles') not between 3 and 10
      or exists (
        select 1 from jsonb_array_elements(public_payload->'tiles') tile
        where jsonb_typeof(tile) is distinct from 'object'
          or not tile ?& array['id', 'value']
          or exists (select 1 from jsonb_object_keys(tile) key_name where key_name <> all(array['id', 'value']))
          or jsonb_typeof(tile->'id') is distinct from 'string'
          or char_length(btrim(tile->>'id')) not between 1 and 120
          or jsonb_typeof(tile->'value') is distinct from 'string'
          or char_length(tile->>'value') <> 1
          or char_length(btrim(tile->>'value')) <> 1
      )
      or exists (select 1 from (
        select tile->>'id' as id from jsonb_array_elements(public_payload->'tiles') tile
        group by tile->>'id' having count(*) > 1
      ) duplicate_id)
      or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') not in ('null', 'string'))
      or (public_payload ? 'hint' and jsonb_typeof(public_payload->'hint') = 'string' and char_length(public_payload->>'hint') > 500) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'correctAnswer'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) not between 3 and 120
      or solution_payload->>'correctAnswer' ~ '\s'
      or char_length(solution_payload->>'correctAnswer') <> jsonb_array_length(public_payload->'tiles')
      or (select string_agg(lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(tile->>'value', 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
          from jsonb_array_elements(public_payload->'tiles') tile) <>
        (select string_agg(lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '' order by lower(translate(letter, 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')))
          from regexp_split_to_table(solution_payload->>'correctAnswer', '') letter)
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'classification' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'items', 'categories']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'items', 'categories'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'items') is distinct from 'array'
      or jsonb_array_length(public_payload->'items') not between 2 and 20
      or jsonb_typeof(public_payload->'categories') is distinct from 'array'
      or jsonb_array_length(public_payload->'categories') not between 2 and 8
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ? 'label'
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> 'label')
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
      )
      or exists (select 1 from (
        select item->>'label' as label from jsonb_array_elements(public_payload->'items') item
        group by item->>'label' having count(*) > 1
      ) duplicate_label)
      or exists (
        select 1 from jsonb_array_elements(public_payload->'categories') category
        where jsonb_typeof(category) is distinct from 'string'
          or char_length(btrim(category #>> '{}')) not between 1 and 120
      )
      or exists (select 1 from (
        select value from jsonb_array_elements_text(public_payload->'categories') group by value having count(*) > 1
      ) duplicate_category) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'categoriesByItem'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'categoriesByItem', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'categoriesByItem') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(solution_payload->'categoriesByItem')) <> jsonb_array_length(public_payload->'items')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'items') item
        where not (solution_payload->'categoriesByItem' ? (item->>'label'))
          or jsonb_typeof(solution_payload->'categoriesByItem'->(item->>'label')) is distinct from 'string'
          or not exists (
            select 1 from jsonb_array_elements_text(public_payload->'categories') category
            where category = solution_payload->'categoriesByItem'->>(item->>'label')
          )
      )
      or exists (
        select 1 from jsonb_object_keys(solution_payload->'categoriesByItem') key_name
        where not exists (select 1 from jsonb_array_elements(public_payload->'items') item where item->>'label' = key_name)
      )
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'matching' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'leftItems', 'rightItems']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'leftItems', 'rightItems'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'leftItems') is distinct from 'array'
      or jsonb_typeof(public_payload->'rightItems') is distinct from 'array'
      or jsonb_array_length(public_payload->'leftItems') not between 3 and 6
      or jsonb_array_length(public_payload->'rightItems') <> jsonb_array_length(public_payload->'leftItems')
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or exists (
        select 1 from jsonb_array_elements(public_payload->'leftItems') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'label']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
          or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
      )
      or exists (
        select 1 from jsonb_array_elements(public_payload->'rightItems') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'label']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'label', 'icon', 'media']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'label') is distinct from 'string'
          or char_length(btrim(item->>'label')) not between 1 and 500
          or (item ? 'icon' and (jsonb_typeof(item->'icon') is distinct from 'string' or char_length(item->>'icon') > 32))
          or (item ? 'media' and jsonb_typeof(item->'media') not in ('null', 'object'))
      )
      or exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(public_payload->'leftItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate_id)
      or exists (select 1 from (
        select item->>'id' as id from jsonb_array_elements(public_payload->'rightItems') item
        group by item->>'id' having count(*) > 1
      ) duplicate_id)
      or exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(public_payload->'leftItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate)
      or exists (select 1 from (
        select regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') as label
        from jsonb_array_elements(public_payload->'rightItems') item
        group by regexp_replace(lower(btrim(item->>'label')), '\\s+', ' ', 'g') having count(*) > 1
      ) duplicate) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'matches'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['matches', 'explanation']))
      or jsonb_typeof(solution_payload->'matches') is distinct from 'object'
      or (select count(*) from jsonb_object_keys(solution_payload->'matches')) <> jsonb_array_length(public_payload->'leftItems')
      or exists (select 1 from jsonb_array_elements(public_payload->'leftItems') item where not (solution_payload->'matches' ? (item->>'id')))
      or exists (select 1 from jsonb_each_text(solution_payload->'matches') match where not exists (
        select 1 from jsonb_array_elements(public_payload->'rightItems') item where item->>'id' = match.value
      ))
      or (select count(*) from jsonb_each_text(solution_payload->'matches')) <> (select count(distinct value) from jsonb_each_text(solution_payload->'matches'))
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'word-search' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'grid', 'letters', 'targets']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'letters', 'targets'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or jsonb_typeof(public_payload->'grid') is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
      or not public_payload->'grid' ?& array['rows', 'columns']
      or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
      or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
      or (public_payload->'grid'->>'rows')::numeric <> trunc((public_payload->'grid'->>'rows')::numeric)
      or (public_payload->'grid'->>'columns')::numeric <> trunc((public_payload->'grid'->>'columns')::numeric)
      or (public_payload->'grid'->>'rows')::integer not between 6 and 10
      or (public_payload->'grid'->>'columns')::integer not between 6 and 10
      or jsonb_typeof(public_payload->'letters') is distinct from 'array'
      or jsonb_array_length(public_payload->'letters') <> (public_payload->'grid'->>'rows')::integer * (public_payload->'grid'->>'columns')::integer
      or exists (select 1 from jsonb_array_elements_text(public_payload->'letters') letter
        where char_length(upper(btrim(letter))) <> 1 or upper(btrim(letter)) !~ '^[A-ZÁÉÍÓÚÜÑ]$')
      or jsonb_typeof(public_payload->'targets') is distinct from 'array'
      or jsonb_array_length(public_payload->'targets') not between 2 and 8
      or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
        where jsonb_typeof(item) is distinct from 'object'
          or not item ?& array['id', 'word']
          or exists (select 1 from jsonb_object_keys(item) key_name where key_name <> all(array['id', 'word']))
          or jsonb_typeof(item->'id') is distinct from 'string'
          or char_length(btrim(item->>'id')) not between 1 and 120
          or jsonb_typeof(item->'word') is distinct from 'string'
          or char_length(btrim(item->>'word')) not between 1 and 120
          or upper(btrim(item->>'word')) !~ '^[A-ZÁÉÍÓÚÜÑ]+$')
      or exists (select 1 from (
        select btrim(item->>'id') value from jsonb_array_elements(public_payload->'targets') item
        group by btrim(item->>'id') having count(*) > 1
      ) duplicate)
      or exists (select 1 from (
        select upper(btrim(item->>'word')) value from jsonb_array_elements(public_payload->'targets') item
        group by upper(btrim(item->>'word')) having count(*) > 1
      ) duplicate) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ? 'positionsByTargetId'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['positionsByTargetId', 'explanation']))
      or jsonb_typeof(solution_payload->'positionsByTargetId') is distinct from 'object'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or (select count(*) from jsonb_object_keys(solution_payload->'positionsByTargetId')) <> jsonb_array_length(public_payload->'targets')
      or exists (select 1 from jsonb_array_elements(public_payload->'targets') item
        where not solution_payload->'positionsByTargetId' ? (item->>'id')) then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;

    grid_rows := (public_payload->'grid'->>'rows')::integer;
    grid_columns := (public_payload->'grid'->>'columns')::integer;
    for target_id, target_word in
      select btrim(item->>'id'), upper(btrim(item->>'word'))
      from jsonb_array_elements(public_payload->'targets') item
    loop
      target_pos := solution_payload->'positionsByTargetId'->target_id;
      if jsonb_typeof(target_pos) is distinct from 'object'
        or not target_pos ?& array['startCell', 'endCell']
        or exists (select 1 from jsonb_object_keys(target_pos) key_name where key_name <> all(array['startCell', 'endCell']))
        or jsonb_typeof(target_pos->'startCell') is distinct from 'number'
        or jsonb_typeof(target_pos->'endCell') is distinct from 'number'
        or (target_pos->>'startCell')::numeric <> trunc((target_pos->>'startCell')::numeric)
        or (target_pos->>'endCell')::numeric <> trunc((target_pos->>'endCell')::numeric) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      start_cell_i := (target_pos->>'startCell')::integer;
      end_cell_i := (target_pos->>'endCell')::integer;
      start_row_i := floor(start_cell_i / grid_columns);
      start_col_i := start_cell_i % grid_columns;
      end_row_i := floor(end_cell_i / grid_columns);
      end_col_i := end_cell_i % grid_columns;
      if start_cell_i not between 0 and grid_rows * grid_columns - 1
        or end_cell_i not between 0 and grid_rows * grid_columns - 1
        or start_cell_i = end_cell_i
        or not (start_row_i = end_row_i or start_col_i = end_col_i or abs(start_row_i - end_row_i) = abs(start_col_i - end_col_i)) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      word_length_i := char_length(target_word);
      if array_length(seen_ids, 1) is not null and target_id = any(seen_ids)
        or array_length(seen_words, 1) is not null and target_word = any(seen_words) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      seen_ids := seen_ids || target_id;
      seen_words := seen_words || target_word;
      target_segment := least(start_cell_i, end_cell_i)::text || ':' || greatest(start_cell_i, end_cell_i)::text;
      if array_length(seen_segments, 1) is not null and target_segment = any(seen_segments) then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
      seen_segments := seen_segments || target_segment;
      row_step_i := sign(end_row_i - start_row_i);
      col_step_i := sign(end_col_i - start_col_i);
      candidate_word := '';
      for path_offset_i in 0..word_length_i - 1 loop
        path_cell_i := (start_row_i + row_step_i * path_offset_i) * grid_columns + start_col_i + col_step_i * path_offset_i;
        if path_cell_i < 0 or path_cell_i >= grid_rows * grid_columns then
          raise exception 'invalid_solution_payload' using errcode = '22023';
        end if;
        candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
      end loop;
      if candidate_word <> target_word then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;

      occurrence_count_i := 0;
      for check_start in 0..grid_rows * grid_columns - 1 loop
        for direction_row in -1..1 loop
          for direction_col in -1..1 loop
            if direction_row = 0 and direction_col = 0 then continue; end if;
            candidate_word := '';
            candidate_segment := null;
            for path_offset_i in 0..word_length_i - 1 loop
              cell_row := floor(check_start / grid_columns) + direction_row * path_offset_i;
              cell_col := (check_start % grid_columns) + direction_col * path_offset_i;
              if cell_row < 0 or cell_row >= grid_rows or cell_col < 0 or cell_col >= grid_columns then
                candidate_word := null;
                exit;
              end if;
              path_cell_i := cell_row * grid_columns + cell_col;
              candidate_word := candidate_word || upper(btrim(public_payload->'letters'->>path_cell_i));
            end loop;
            if candidate_word = target_word then
              candidate_segment := least(check_start, path_cell_i)::text || ':' || greatest(check_start, path_cell_i)::text;
              occurrence_count_i := occurrence_count_i + 1;
              if candidate_segment = target_segment then
                -- Both directions describe one undirected occurrence.
                occurrence_count_i := occurrence_count_i - 1;
              end if;
            end if;
          end loop;
        end loop;
      end loop;
      if occurrence_count_i <> 0 then
        raise exception 'invalid_solution_payload' using errcode = '22023';
      end if;
    end loop;
    return;
  end if;

  if question->>'type' = 'word-hashtag' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.word_hashtag_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'zip' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'checkpoints', 'instruction', 'mapNote', 'boardLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
        or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
      or (public_payload ? 'mapNote' and (jsonb_typeof(public_payload->'mapNote') is distinct from 'string'
        or char_length(btrim(public_payload->>'mapNote')) not between 1 and 500))
      or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['solution', 'explanation']))
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.zip_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'queens' then
    if exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name not in ('category', 'tags', 'question', 'grid', 'regions', 'prefilledQueens'))
      or private.editorial_has_secret_key(public_payload)
      or not private.queens_content_valid(public_payload, solution_payload)
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'escape' then
    if jsonb_typeof(public_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'grid', 'initialBlocks', 'instruction', 'hideInstruction',
        'objectiveLabel', 'hideObjectiveLabel', 'completionMessage', 'boardLabel'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
      or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
      or (public_payload ? 'instruction' and (jsonb_typeof(public_payload->'instruction') is distinct from 'string'
        or char_length(btrim(public_payload->>'instruction')) not between 1 and 500))
      or (public_payload ? 'objectiveLabel' and (jsonb_typeof(public_payload->'objectiveLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'objectiveLabel')) not between 1 and 500))
      or (public_payload ? 'completionMessage' and (jsonb_typeof(public_payload->'completionMessage') is distinct from 'string'
        or char_length(btrim(public_payload->>'completionMessage')) not between 1 and 500))
      or (public_payload ? 'boardLabel' and (jsonb_typeof(public_payload->'boardLabel') is distinct from 'string'
        or char_length(btrim(public_payload->>'boardLabel')) not between 1 and 500))
      or (public_payload ? 'hideInstruction' and jsonb_typeof(public_payload->'hideInstruction') is distinct from 'boolean')
      or (public_payload ? 'hideObjectiveLabel' and jsonb_typeof(public_payload->'hideObjectiveLabel') is distinct from 'boolean')
      or jsonb_typeof(solution_payload) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array['referenceSolution', 'optimalMoves', 'explanation']))
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string')
      or not private.escape_content_valid(public_payload, solution_payload) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if question->>'type' = 'progressive-image' then
    if question->>'payloadSchemaVersion' = '2' then
      if jsonb_typeof(public_payload) is distinct from 'object'
        or not public_payload ?& array['question', 'surface', 'revealDurationMs']
        or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
          'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
        ]))
        or private.editorial_has_secret_key(public_payload)
        or jsonb_typeof(public_payload->'surface') is distinct from 'object'
        or not public_payload->'surface' ?& array['assetId', 'alt', 'width', 'height']
        or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
          'assetId', 'alt', 'width', 'height', 'fit', 'position'
        ]))
        or public_payload->'surface'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not private.is_ready_question_asset((public_payload->'surface'->>'assetId')::uuid)
        or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
        or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
        or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
        or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
        or (public_payload->'surface'->>'width')::integer not between 1 and 8192
        or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
        or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
        or (public_payload->'surface'->>'height')::integer not between 1 and 8192
        or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
        or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
          or char_length(public_payload->'surface'->>'position') > 100))
        or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
        or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
        or (public_payload->>'revealDurationMs')::integer <= 0
        or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
        or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
        or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
        raise exception 'invalid_public_payload' using errcode = '22023';
      end if;
    else
    if jsonb_typeof(public_payload) is distinct from 'object'
      or not public_payload ?& array['question', 'surface', 'revealDurationMs']
      or exists (select 1 from jsonb_object_keys(public_payload) key_name where key_name <> all(array[
        'category', 'tags', 'question', 'surface', 'revealDurationMs', 'answerLabel', 'answerPlaceholder'
      ]))
      or private.editorial_has_secret_key(public_payload)
      or jsonb_typeof(public_payload->'question') is distinct from 'string'
      or char_length(btrim(public_payload->>'question')) not between 1 and 2000
      or jsonb_typeof(public_payload->'surface') is distinct from 'object'
      or not public_payload->'surface' ?& array['src', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'surface') key_name where key_name <> all(array[
        'src', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or jsonb_typeof(public_payload->'surface'->'src') is distinct from 'string'
      or char_length(btrim(public_payload->'surface'->>'src')) not between 10 and 1000
      or left(public_payload->'surface'->>'src', 9) <> '/visuals/'
      or public_payload->'surface'->>'src' ~ '\s'
      or jsonb_typeof(public_payload->'surface'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'surface'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'surface'->'width') is distinct from 'number'
      or (public_payload->'surface'->>'width')::numeric <> trunc((public_payload->'surface'->>'width')::numeric)
      or (public_payload->'surface'->>'width')::integer <= 0
      or jsonb_typeof(public_payload->'surface'->'height') is distinct from 'number'
      or (public_payload->'surface'->>'height')::numeric <> trunc((public_payload->'surface'->>'height')::numeric)
      or (public_payload->'surface'->>'height')::integer <= 0
      or (public_payload->'surface' ? 'fit' and public_payload->'surface'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'surface' ? 'position' and (jsonb_typeof(public_payload->'surface'->'position') is distinct from 'string'
        or char_length(public_payload->'surface'->>'position') > 100))
      or jsonb_typeof(public_payload->'revealDurationMs') is distinct from 'number'
      or (public_payload->>'revealDurationMs')::numeric <> trunc((public_payload->>'revealDurationMs')::numeric)
      or (public_payload->>'revealDurationMs')::integer <= 0
      or (public_payload->>'revealDurationMs')::integer >= (question->>'timeLimitMs')::numeric
      or (public_payload ? 'answerLabel' and jsonb_typeof(public_payload->'answerLabel') not in ('null', 'string'))
      or (public_payload ? 'answerPlaceholder' and jsonb_typeof(public_payload->'answerPlaceholder') not in ('null', 'string')) then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
    end if;
    if jsonb_typeof(solution_payload) is distinct from 'object'
      or not solution_payload ?& array['correctAnswer', 'acceptedAnswers', 'solutionAlt']
      or exists (select 1 from jsonb_object_keys(solution_payload) key_name where key_name <> all(array[
        'correctAnswer', 'acceptedAnswers', 'solutionAlt', 'explanation'
      ]))
      or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
      or char_length(btrim(solution_payload->>'correctAnswer')) not between 1 and 500
      or jsonb_typeof(solution_payload->'acceptedAnswers') is distinct from 'array'
      or jsonb_array_length(solution_payload->'acceptedAnswers') not between 1 and 100
      or exists (select 1 from jsonb_array_elements(solution_payload->'acceptedAnswers') answer
        where jsonb_typeof(answer) is distinct from 'string'
          or char_length(btrim(answer #>> '{}')) not between 1 and 500)
      or exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
        group by regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
        having count(*) > 1)
      or not exists (select 1 from jsonb_array_elements_text(solution_payload->'acceptedAnswers') answer
        where regexp_replace(lower(translate(btrim(answer), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') =
          regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g'))
      or position(
        regexp_replace(lower(translate(btrim(solution_payload->>'correctAnswer'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g') in
        regexp_replace(lower(translate(btrim(public_payload->'surface'->>'alt'), 'ÁÉÍÓÚÜáéíóúü', 'AEIOUUAEIOUU')), '\s+', '', 'g')
      ) > 0
      or jsonb_typeof(solution_payload->'solutionAlt') is distinct from 'string'
      or char_length(btrim(solution_payload->>'solutionAlt')) not between 1 and 500
      or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
      raise exception 'invalid_solution_payload' using errcode = '22023';
    end if;
    return;
  end if;

  if jsonb_typeof(public_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'options']
    or exists (
      select 1 from jsonb_object_keys(public_payload) key_name
      where key_name <> all(array['category', 'tags', 'question', 'options', 'media', 'promptVisual'])
    )
    or private.editorial_has_secret_key(public_payload)
    or jsonb_typeof(public_payload->'question') is distinct from 'string'
    or char_length(btrim(public_payload->>'question')) not between 1 and 2000
    or jsonb_typeof(public_payload->'options') is distinct from 'array'
    or jsonb_array_length(public_payload->'options') < 2
    or (public_payload ? 'category' and jsonb_typeof(public_payload->'category') is distinct from 'string')
    or (public_payload ? 'tags' and jsonb_typeof(public_payload->'tags') is distinct from 'object')
    or (public_payload ? 'media' and jsonb_typeof(public_payload->'media') not in ('null', 'object'))
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '1'
      and public_payload ? 'media' and public_payload->'media' ? 'assetId')
    or (question->>'type' = 'multiple-choice' and question->>'payloadSchemaVersion' = '2' and (
      jsonb_typeof(public_payload->'media') is distinct from 'object'
      or not public_payload->'media' ?& array['type', 'assetId', 'alt', 'width', 'height']
      or exists (select 1 from jsonb_object_keys(public_payload->'media') key_name where key_name <> all(array[
        'type', 'assetId', 'alt', 'width', 'height', 'fit', 'position'
      ]))
      or public_payload->'media'->>'type' <> 'image'
      or public_payload->'media'->>'assetId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not private.is_ready_question_asset((public_payload->'media'->>'assetId')::uuid)
      or jsonb_typeof(public_payload->'media'->'alt') is distinct from 'string'
      or char_length(btrim(public_payload->'media'->>'alt')) not between 1 and 500
      or jsonb_typeof(public_payload->'media'->'width') is distinct from 'number'
      or (public_payload->'media'->>'width')::numeric <> trunc((public_payload->'media'->>'width')::numeric)
      or (public_payload->'media'->>'width')::integer not between 1 and 8192
      or jsonb_typeof(public_payload->'media'->'height') is distinct from 'number'
      or (public_payload->'media'->>'height')::numeric <> trunc((public_payload->'media'->>'height')::numeric)
      or (public_payload->'media'->>'height')::integer not between 1 and 8192
      or (public_payload->'media' ? 'fit' and public_payload->'media'->>'fit' not in ('cover', 'contain'))
      or (public_payload->'media' ? 'position' and (jsonb_typeof(public_payload->'media'->'position') is distinct from 'string'
        or char_length(public_payload->'media'->>'position') > 100))
    ))
    or (public_payload ? 'promptVisual' and jsonb_typeof(public_payload->'promptVisual') not in ('null', 'object')) then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;

  for option in select value from jsonb_array_elements(public_payload->'options') loop
    if jsonb_typeof(option) is distinct from 'string' or char_length(btrim(option #>> '{}')) = 0 then
      raise exception 'invalid_public_payload' using errcode = '22023';
    end if;
  end loop;
  select count(distinct value) into option_count from jsonb_array_elements_text(public_payload->'options');
  if option_count <> jsonb_array_length(public_payload->'options') then
    raise exception 'invalid_public_payload' using errcode = '22023';
  end if;

  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'correctAnswer'
    or exists (
      select 1 from jsonb_object_keys(solution_payload) key_name
      where key_name <> all(array['correctAnswer', 'explanation'])
    )
    or jsonb_typeof(solution_payload->'correctAnswer') is distinct from 'string'
    or char_length(btrim(solution_payload->>'correctAnswer')) = 0
    or (solution_payload ? 'explanation' and jsonb_typeof(solution_payload->'explanation') is distinct from 'string') then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  if not exists (
    select 1 from jsonb_array_elements_text(public_payload->'options') value
    where value = solution_payload->>'correctAnswer'
  ) then
    raise exception 'invalid_solution_payload' using errcode = '22023';
  end if;
  return;
end;
$function$;

CREATE OR REPLACE FUNCTION private.word_hashtag_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  solution jsonb;
  initial jsonb;
  entry jsonb;
  index integer;
  cell integer;
  initial_signature text;
  solution_signature text;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or not public_payload ?& array['question', 'grid', 'initialLetters', 'maxMoves']
    or exists (select 1 from jsonb_object_keys(public_payload) key_name
      where key_name <> all(array['category', 'tags', 'question', 'grid', 'initialLetters', 'maxMoves']))
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name
      where key_name <> all(array['rows', 'columns']))
    or (public_payload->'grid'->>'rows')::numeric <> 5
    or (public_payload->'grid'->>'columns')::numeric <> 5
    or jsonb_typeof(public_payload->'initialLetters') is distinct from 'array'
    or jsonb_array_length(public_payload->'initialLetters') <> 25
    or jsonb_typeof(public_payload->'maxMoves') is distinct from 'number'
    or (public_payload->>'maxMoves')::numeric <> trunc((public_payload->>'maxMoves')::numeric)
    or (public_payload->>'maxMoves')::integer <= 0
    or not solution_payload ? 'words'
    or exists (select 1 from jsonb_object_keys(solution_payload) key_name
      where key_name <> all(array['words', 'explanation'])) then
    return false;
  end if;

  initial := public_payload->'initialLetters';
  for entry, index in select value, ordinality::integer from jsonb_array_elements(initial) with ordinality loop
    cell := index - 1;
    if ((cell / 5) in (0, 2, 4) and (cell % 5) in (0, 2, 4))
      and entry <> 'null'::jsonb then
      return false;
    end if;
    if ((cell / 5) in (1, 3) or (cell % 5) in (1, 3)) then
      if jsonb_typeof(entry) is distinct from 'string'
        or upper(entry #>> '{}') !~ '^[A-ZÑ]$' then
        return false;
      end if;
    elsif entry <> 'null'::jsonb then
      return false;
    end if;
  end loop;

  solution := private.word_hashtag_solution_letters(solution_payload);
  if solution is null then return false; end if;
  if (select count(*) from jsonb_array_elements(solution) s where s.value <> 'null'::jsonb) <> 16 then
    return false;
  end if;
  select string_agg(upper(value #>> '{}'), '' order by upper(value #>> '{}'))
    into initial_signature
    from jsonb_array_elements(initial) with ordinality
    where ((ordinality - 1) / 5 in (1, 3) or ((ordinality - 1) % 5) in (1, 3));
  select string_agg(value #>> '{}', '' order by value #>> '{}')
    into solution_signature
    from jsonb_array_elements(solution) value
    where value <> 'null'::jsonb;
  if initial_signature is distinct from solution_signature then return false; end if;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION private.word_hashtag_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  public_payload jsonb;
  solution_payload jsonb;
  progress_payload jsonb;
  letters text[];
  solution text[];
  swap jsonb;
  from_cell integer;
  to_cell integer;
  moves_used integer := 0;
  correct_cells integer[] := array[]::integer[];
  index integer;
  temporary text;
  solved boolean := false;
begin
  select q.public_payload, qs.solution_payload, a.progress_payload
    into public_payload, solution_payload, progress_payload
    from public.attempts a
    join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
    join private.question_versions q on q.id = i.question_version_id
    join private.question_version_solutions qs on qs.question_version_id = q.id
    where a.id = target_attempt and i.id = target_item and q.type = 'word-hashtag';
  if public_payload is null or solution_payload is null then return null; end if;

  select array_agg(nullif(value #>> '{}', '') order by ordinality)
    into solution from jsonb_array_elements(private.word_hashtag_solution_letters(solution_payload)) with ordinality;
  letters := array_fill(null::text, array[25]);
  for index in 0..24 loop
    letters[index + 1] := nullif(public_payload->'initialLetters'->>index, '');
  end loop;
  for swap in select value from jsonb_array_elements(
    coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb)
  ) loop
    from_cell := (swap->>'fromCell')::integer;
    to_cell := (swap->>'toCell')::integer;
    if from_cell between 0 and 24 and to_cell between 0 and 24 then
      temporary := letters[from_cell + 1];
      letters[from_cell + 1] := letters[to_cell + 1];
      letters[to_cell + 1] := temporary;
    end if;
    moves_used := moves_used + 1;
  end loop;
  solved := true;
  for index in 1..25 loop
    if letters[index] is distinct from solution[index] then
      solved := false;
    elsif letters[index] is not null then
      correct_cells := array_append(correct_cells, index - 1);
    end if;
  end loop;
  return jsonb_build_object(
    'kind', 'word-hashtag',
    'letters', to_jsonb(letters),
    'swaps', coalesce(progress_payload->'answer'->'swaps', '[]'::jsonb),
    'movesUsed', moves_used,
    'movesRemaining', greatest(0, (public_payload->>'maxMoves')::integer - moves_used),
    'correctCells', to_jsonb(correct_cells),
    'solved', solved
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.word_hashtag_solution_letters (
  solution_payload jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  letters text[] := array_fill(null::text, array[25]);
  word_name text;
  word_value text;
  cells integer[];
  index integer;
  cell integer;
  letter text;
begin
  if jsonb_typeof(solution_payload) is distinct from 'object'
    or not solution_payload ? 'words'
    or jsonb_typeof(solution_payload->'words') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(solution_payload->'words') key_name
      where key_name <> all(array['top', 'bottom', 'left', 'right'])) then
    return null;
  end if;
  foreach word_name in array ARRAY['top', 'bottom', 'left', 'right'] loop
    word_value := upper(btrim(solution_payload->'words'->>word_name));
    if word_value is null or char_length(word_value) <> 5 or word_value !~ '^[A-ZÑ]+$' then
      return null;
    end if;
    cells := case word_name
      when 'top' then array[5, 6, 7, 8, 9]
      when 'bottom' then array[15, 16, 17, 18, 19]
      when 'left' then array[1, 6, 11, 16, 21]
      else array[3, 8, 13, 18, 23]
    end;
    for index in 1..5 loop
      cell := cells[index];
      letter := substr(word_value, index, 1);
      if letters[cell + 1] is not null and letters[cell + 1] <> letter then
        return null;
      end if;
      letters[cell + 1] := letter;
    end loop;
  end loop;
  return to_jsonb(letters);
end;
$function$;

CREATE OR REPLACE FUNCTION private.word_search_progress (
  target_attempt uuid,
  target_item    uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'kind', 'word-search',
    'foundSelections', coalesce(jsonb_agg(jsonb_build_object(
      'targetId', e.matched_target_id,
      'startCell', e.start_cell,
      'endCell', e.end_cell
    ) order by e.sequence) filter (where e.correct), '[]'::jsonb),
    'foundWordIds', coalesce(jsonb_agg(to_jsonb(e.matched_target_id) order by e.sequence)
      filter (where e.correct), '[]'::jsonb),
    'foundCount', count(*) filter (where e.correct)::integer,
    'totalWords', jsonb_array_length(q.public_payload->'targets'),
    'incorrectAttempts', count(*) filter (where not e.correct)::integer
  )
  from private.challenge_items i
  join private.question_versions q on q.id = i.question_version_id
  left join private.word_search_selection_events e
    on e.attempt_id = target_attempt and e.challenge_item_id = target_item
  where i.id = target_item and q.type = 'word-search'
  group by q.public_payload
$function$;

CREATE OR REPLACE FUNCTION private.zip_content_valid (
  public_payload   jsonb,
  solution_payload jsonb
)
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  checkpoints integer[] := '{}';
  solution integer[] := '{}';
  checkpoint_count integer;
  index integer;
  entry jsonb;
  cell integer;
  previous_cell integer;
  next_checkpoint integer := 2;
  checkpoint_at_cell integer;
  solution_count integer;
begin
  if jsonb_typeof(public_payload) is distinct from 'object'
    or jsonb_typeof(solution_payload) is distinct from 'object'
    or jsonb_typeof(public_payload->'grid') is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(public_payload->'grid') key_name where key_name <> all(array['rows', 'columns']))
    or jsonb_typeof(public_payload->'grid'->'rows') is distinct from 'number'
    or jsonb_typeof(public_payload->'grid'->'columns') is distinct from 'number'
    or (public_payload->'grid'->>'rows')::numeric <> 5
    or (public_payload->'grid'->>'columns')::numeric <> 5
    or jsonb_typeof(public_payload->'checkpoints') is distinct from 'array'
    or jsonb_array_length(public_payload->'checkpoints') not between 2 and 25
    or jsonb_typeof(solution_payload->'solution') is distinct from 'array'
    or jsonb_array_length(solution_payload->'solution') <> 25 then
    return false;
  end if;

  for entry, index in
    select value, ordinality::integer
    from jsonb_array_elements(public_payload->'checkpoints') with ordinality
  loop
    if jsonb_typeof(entry) is distinct from 'object'
      or exists (select 1 from jsonb_object_keys(entry) key_name where key_name <> all(array['value', 'cell', 'label']))
      or jsonb_typeof(entry->'value') is distinct from 'number'
      or jsonb_typeof(entry->'cell') is distinct from 'number'
      or (entry->>'value')::numeric <> trunc((entry->>'value')::numeric)
      or (entry->>'cell')::numeric <> trunc((entry->>'cell')::numeric)
      or (entry->>'value')::integer <> index
      or (entry->>'cell')::integer not between 0 and 24
      or (entry ? 'label' and (jsonb_typeof(entry->'label') is distinct from 'string'
        or char_length(btrim(entry->>'label')) not between 1 and 500)) then
      return false;
    end if;
    cell := (entry->>'cell')::integer;
    if cell = any(checkpoints) then return false; end if;
    checkpoints := checkpoints || cell;
  end loop;
  checkpoint_count := coalesce(array_length(checkpoints, 1), 0);

  for entry in select value from jsonb_array_elements(solution_payload->'solution') loop
    if jsonb_typeof(entry) is distinct from 'number'
      or (entry #>> '{}')::numeric <> trunc((entry #>> '{}')::numeric)
      or (entry #>> '{}')::integer not between 0 and 24 then
      return false;
    end if;
    cell := (entry #>> '{}')::integer;
    if cell = any(solution) then return false; end if;
    solution := solution || cell;
  end loop;

  if solution[1] <> checkpoints[1] or solution[25] <> checkpoints[checkpoint_count] then
    return false;
  end if;
  for index in 2..25 loop
    previous_cell := solution[index - 1];
    cell := solution[index];
    if abs(previous_cell / 5 - cell / 5) + abs(previous_cell % 5 - cell % 5) <> 1 then
      return false;
    end if;
    checkpoint_at_cell := array_position(checkpoints, cell);
    if checkpoint_at_cell is not null then
      if checkpoint_at_cell <> next_checkpoint or
         (checkpoint_at_cell = checkpoint_count and index <> 25) then
        return false;
      end if;
      next_checkpoint := next_checkpoint + 1;
    end if;
  end loop;
  if next_checkpoint <> checkpoint_count + 1 then return false; end if;

  with recursive walk(cell, depth, next_checkpoint, visited) as (
    select checkpoints[1], 1, 2, array[checkpoints[1]]
    union all
    select candidate.cell,
      walk.depth + 1,
      case
        when array_position(checkpoints, candidate.cell) = walk.next_checkpoint
          then walk.next_checkpoint + 1
        else walk.next_checkpoint
      end,
      walk.visited || candidate.cell
    from walk
    cross join lateral generate_series(0, 24) candidate(cell)
    where walk.depth < 25
      and not candidate.cell = any(walk.visited)
      and abs(walk.cell / 5 - candidate.cell / 5) + abs(walk.cell % 5 - candidate.cell % 5) = 1
      and (array_position(checkpoints, candidate.cell) is null
        or array_position(checkpoints, candidate.cell) = walk.next_checkpoint)
      and (candidate.cell <> checkpoints[checkpoint_count] or walk.depth = 24)
  )
  select count(*)::integer into solution_count
  from (select 1 from walk
    where walk.depth = 25 and walk.cell = checkpoints[checkpoint_count]
      and walk.next_checkpoint = checkpoint_count + 1
    limit 2) candidates;
  return solution_count = 1;
end;
$function$;

CREATE OR REPLACE FUNCTION public.activate_superadmin_season (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.activate_season_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.add_superadmin_room_member (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.add_superadmin_room_member_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.archive_superadmin_question (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.archive_question_command(input); $function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_flash_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_flash_draft_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_player (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_superadmin_player_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_question_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.create_question_draft_command(input); $function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_room (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_room_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_scheduled_challenge (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_scheduled_challenge_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.create_superadmin_season (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.create_season_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.get_challenge_ranking (
  target_publication_id uuid
)
  RETURNS TABLE (
    player_id    uuid,
    display_name text,
    avatar_path  text,
    flash_points bigint,
    duration_ms  bigint,
    "position"   bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select e.player_id, p.display_name, p.avatar_path, e.flash_points, e.duration_ms,
    rank() over (order by e.flash_points desc, e.duration_ms, e.started_at) as "position"
  from private.effective_results e join public.players p on p.id = e.player_id
  where e.scheduled_challenge_id = target_publication_id and private.is_room_member(e.room_id)
  order by "position", e.player_id
$function$;

CREATE OR REPLACE FUNCTION public.get_flash_history (
  target_room_slug      text,
  target_publication_id uuid DEFAULT NULL::uuid
)
  RETURNS TABLE (
    room_id               uuid,
    room_slug             text,
    room_title            text,
    viewer_role           text,
    season_id             uuid,
    season_title          text,
    publication_id        uuid,
    publication_number    integer,
    publication_status    text,
    publication_opens_at  timestamp with time zone,
    publication_closes_at timestamp with time zone,
    challenge_id          uuid,
    challenge_slug        text,
    challenge_version_id  uuid,
    challenge_title       text,
    challenge_subtitle    text,
    challenge_description text,
    challenge_mode        text,
    challenge_max_score   integer,
    question_count        bigint,
    played_at             timestamp with time zone,
    player_count          bigint,
    player_id             uuid,
    display_name          text,
    avatar_path           text,
    flash_points          bigint,
    duration_ms           bigint,
    started_at            timestamp with time zone,
    "position"            bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select p.id as player_id, m.role as viewer_role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), eligible_publications as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      s.id as season_id,
      s.title as season_title,
      sc.id as publication_id,
      sc.number as publication_number,
      sc.status as publication_status,
      sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (select count(*)::bigint
         from private.challenge_items i
        where i.challenge_version_id = cv.id) as question_count,
      coalesce((
        select max(a.completed_at)
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), sc.closes_at) as played_at,
      coalesce((
        select count(distinct a.player_id)::bigint
        from public.attempts a
        where a.scheduled_challenge_id = sc.id
          and a.kind = 'competitive'
          and a.status in ('completed', 'abandoned')
      ), 0::bigint) as player_count
    from public.rooms r
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer v
    where r.slug = target_room_slug
      and sc.id = coalesce(target_publication_id, sc.id)
      and sc.status = 'closed'
      and cv.mode = 'flash'
      and cv.status in ('published', 'archived')
      and not exists (
        select 1 from public.attempts in_progress
        where in_progress.scheduled_challenge_id = sc.id
          and in_progress.status = 'in_progress'
      )
  ), ranked_results as (
    select
      e.scheduled_challenge_id as publication_id,
      e.player_id,
      p.display_name,
      p.avatar_path,
      e.flash_points,
      e.duration_ms,
      e.started_at,
      rank() over (
        partition by e.scheduled_challenge_id
        order by e.flash_points desc, e.duration_ms, e.started_at
      ) as "position"
    from private.effective_results e
    join eligible_publications h on h.publication_id = e.scheduled_challenge_id
    join public.players p on p.id = e.player_id
  )
  select
    h.room_id, h.room_slug, h.room_title, h.viewer_role,
    h.season_id, h.season_title, h.publication_id, h.publication_number,
    h.publication_status, h.publication_opens_at, h.publication_closes_at,
    h.challenge_id, h.challenge_slug, h.challenge_version_id, h.challenge_title,
    h.challenge_subtitle, h.challenge_description, h.challenge_mode,
    h.challenge_max_score, h.question_count, h.played_at, h.player_count,
    r.player_id, r.display_name, r.avatar_path, r.flash_points, r.duration_ms,
    r.started_at, r."position"
  from eligible_publications h
  left join ranked_results r on r.publication_id = h.publication_id
  order by h.played_at desc, h.publication_number desc, h.publication_id,
    r."position" nulls last, r.player_id
$function$;

CREATE OR REPLACE FUNCTION public.get_flash_member_review (
  target_room_slug      text,
  target_publication_id uuid,
  target_player_id      uuid
)
  RETURNS TABLE (
    room_id                uuid,
    room_slug              text,
    room_title             text,
    viewer_role            text,
    publication_id         uuid,
    publication_status     text,
    publication_closes_at  timestamp with time zone,
    challenge_id           uuid,
    challenge_slug         text,
    challenge_version_id   uuid,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_mode         text,
    challenge_max_score    integer,
    player_id              uuid,
    display_name           text,
    avatar_path            text,
    attempt_id             uuid,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    time_limit_ms          integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    item_points            integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select p.id as player_id, m.role as viewer_role, r.id as room_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.players p on p.id = private.current_player_id()
      and p.id = m.player_id
    where r.slug = target_room_slug
      and r.status = 'active'
      and m.status = 'active'
  ), authorized_attempt as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      v.viewer_role,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      a.id as attempt_id,
      a.status as attempt_status,
      a.score as attempt_score,
      a.started_at as attempt_started_at,
      a.completed_at as attempt_completed_at,
      a.lock_version as attempt_lock_version,
      v.player_id as viewer_player_id
    from viewer v
    join public.rooms r on r.id = v.room_id
    join public.seasons s on s.room_id = r.id and s.status <> 'draft'
    join public.scheduled_challenges sc on sc.id = target_publication_id
      and sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = target_player_id
      and a.kind = 'competitive'
      and a.status in ('completed', 'abandoned')
    where cv.mode = 'flash'
      and cv.status in ('published', 'archived')
      and exists (
        select 1 from public.room_memberships historical_membership
        where historical_membership.room_id = r.id
          and historical_membership.player_id = target_player_id
      )
      and (
        (
          target_player_id = v.player_id
          and sc.status in ('open', 'closed')
        )
        or (
          target_player_id <> v.player_id
          and v.viewer_role in ('owner', 'admin', 'member')
          and sc.status = 'closed'
          and not exists (
            select 1 from public.attempts in_progress
            where in_progress.scheduled_challenge_id = sc.id
              and in_progress.status = 'in_progress'
          )
        )
      )
  )
  select
    a.room_id, a.room_slug, a.room_title, a.viewer_role,
    a.publication_id, a.publication_status, a.publication_closes_at,
    a.challenge_id, a.challenge_slug, a.challenge_version_id, a.challenge_title,
    a.challenge_subtitle, a.challenge_description, a.challenge_mode,
    a.challenge_max_score, target_player_id, p.display_name, p.avatar_path,
    a.attempt_id, a.attempt_status, a.attempt_score, a.attempt_started_at,
    a.attempt_completed_at, a.attempt_lock_version, i.id, i.position,
    q.id, q.type, q.payload_schema_version, q.time_limit_ms, q.public_payload, qs.solution_payload,
    aa.answer, aa.status, aa.points, aa.result_details, aa.presented_at,
    aa.submitted_at, aa.time_used_ms, i.points
  from authorized_attempt a
  join public.players p on p.id = target_player_id
  join private.challenge_items i on i.challenge_version_id = a.challenge_version_id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.attempt_id
    and aa.challenge_item_id = i.id
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_alphabet_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    global_time_limit_ms     integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer,
    alphabet_letter          text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select
      r.id as room_id, r.slug as room_slug, r.title as room_title,
      sc.id as publication_id, sc.status as publication_status,
      sc.opens_at as publication_opens_at, sc.closes_at as publication_closes_at,
      cd.id as challenge_id, cd.slug as challenge_slug, cv.id as challenge_version_id,
      cv.title as challenge_title, cv.subtitle as challenge_subtitle,
      cv.description as challenge_description, cv.mode as challenge_mode,
      cv.max_score as challenge_max_score, cv.global_time_limit_ms,
      a.id as own_attempt_id, a.status as own_attempt_status, a.score as own_attempt_score,
      a.started_at as own_attempt_started_at, a.completed_at as own_attempt_completed_at,
      a.deadline_at as own_attempt_deadline_at, a.lock_version as own_attempt_lock_version,
      cv.id as version_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer
    left join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = viewer.player_id and a.kind = 'competitive'
    where r.slug = target_room_slug and sc.id = target_publication_id
      and r.status = 'active' and m.player_id = viewer.player_id and m.status = 'active'
      and m.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        sc.status, s.status, s.starts_at, s.ends_at, sc.opens_at, sc.closes_at,
        statement_timestamp()) or a.id is not null)
      and cv.status = 'published' and cv.mode = 'alphabet'
  )
  select
    p.room_id, p.room_slug, p.room_title, p.publication_id, p.publication_status,
    p.publication_opens_at, p.publication_closes_at, p.challenge_id, p.challenge_slug,
    p.challenge_version_id, p.challenge_title, p.challenge_subtitle, p.challenge_description,
    p.challenge_mode, p.challenge_max_score, p.global_time_limit_ms,
    count(i.id) over (partition by p.challenge_version_id),
    p.own_attempt_id, p.own_attempt_status, p.own_attempt_score, p.own_attempt_started_at,
    p.own_attempt_completed_at, p.own_attempt_deadline_at, p.own_attempt_lock_version,
    i.id, i.position, q.id, q.type, q.payload_schema_version, q.time_limit_ms, i.points,
    i.mode_config->>'letter'
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_alphabet_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer,
    alphabet_letter        text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    a.id, a.scheduled_challenge_id, i.id, i.position, q.id, q.type,
    q.payload_schema_version, q.public_payload, qs.solution_payload,
    aa.answer, aa.status, coalesce(aa.points, 0), aa.result_details,
    aa.presented_at, aa.submitted_at, coalesce(aa.time_used_ms, 0),
    a.status, coalesce(a.score, 0), a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score, i.mode_config->>'letter'
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa
    on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id and a.player_id = private.current_player_id()
    and a.kind = 'competitive' and a.status = 'completed'
    and cv.mode = 'alphabet' and r.status = 'active'
    and m.player_id = private.current_player_id() and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_flash_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select
      r.id as room_id,
      r.slug as room_slug,
      r.title as room_title,
      sc.id as publication_id,
      sc.status as publication_status,
      sc.opens_at as publication_opens_at,
      sc.closes_at as publication_closes_at,
      cd.id as challenge_id,
      cd.slug as challenge_slug,
      cv.id as challenge_version_id,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.description as challenge_description,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      a.id as own_attempt_id,
      a.status as own_attempt_status,
      a.score as own_attempt_score,
      a.started_at as own_attempt_started_at,
      a.completed_at as own_attempt_completed_at,
      a.deadline_at as own_attempt_deadline_at,
      a.lock_version as own_attempt_lock_version,
      cv.id as version_id
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    join public.seasons s on s.room_id = r.id and s.status in ('active', 'finished')
    join public.scheduled_challenges sc on sc.season_id = s.id
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    join private.challenge_definitions cd on cd.id = cv.challenge_definition_id
    cross join viewer
    left join public.attempts a on a.scheduled_challenge_id = sc.id
      and a.player_id = viewer.player_id and a.kind = 'competitive'
    where r.slug = target_room_slug
      and sc.id = target_publication_id
      and r.status = 'active'
      and m.player_id = viewer.player_id
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'member')
      and (
        private.publication_is_effectively_open(
          sc.status, s.status, s.starts_at, s.ends_at,
          sc.opens_at, sc.closes_at, statement_timestamp()
        )
        or a.id is not null
      )
      and cv.status = 'published'
      and cv.mode = 'flash'
  )
  select
    p.room_id, p.room_slug, p.room_title, p.publication_id, p.publication_status,
    p.publication_opens_at, p.publication_closes_at, p.challenge_id, p.challenge_slug,
    p.challenge_version_id, p.challenge_title, p.challenge_subtitle, p.challenge_description,
    p.challenge_mode, p.challenge_max_score,
    count(i.id) over (partition by p.challenge_version_id),
    p.own_attempt_id, p.own_attempt_status, p.own_attempt_score, p.own_attempt_started_at,
    p.own_attempt_completed_at, p.own_attempt_deadline_at, p.own_attempt_lock_version,
    i.id, i.position, q.id, q.type, q.payload_schema_version,
    q.time_limit_ms, i.points
  from authorized_publication p
  join private.challenge_items i on i.challenge_version_id = p.version_id
  join private.question_versions q on q.id = i.question_version_id
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_flash_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    a.id, a.scheduled_challenge_id, aa.challenge_item_id, i.position, aa.challenge_version_id,
    q.type, q.payload_schema_version, q.public_payload, qs.solution_payload, aa.answer,
    aa.status, aa.points, aa.result_details, aa.presented_at, aa.submitted_at, aa.time_used_ms,
    a.status, a.score, a.started_at, a.completed_at, a.lock_version,
    cv.title, cv.subtitle, cv.description, cv.max_score
  from public.attempts a
  join public.scheduled_challenges sc on sc.id = a.scheduled_challenge_id
  join public.seasons s on s.id = sc.season_id
  join public.rooms r on r.id = s.room_id
  join public.room_memberships m on m.room_id = r.id
  join private.challenge_versions cv on cv.id = a.challenge_version_id
  join private.challenge_items i on i.challenge_version_id = cv.id
  join private.question_versions q on q.id = i.question_version_id
  join private.question_version_solutions qs on qs.question_version_id = q.id
  left join private.attempt_answers aa on aa.attempt_id = a.id and aa.challenge_item_id = i.id
  where a.id = target_attempt_id
    and a.player_id = private.current_player_id()
    and a.kind = 'competitive'
    and a.status = 'completed'
    and cv.mode = 'flash'
    and r.status = 'active'
    and m.player_id = private.current_player_id()
    and m.status = 'active'
    and m.role in ('owner', 'admin', 'member')
  order by i.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_pyramid_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_version_number integer,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    level_id                 text,
    level_label              text,
    briefing_title           text,
    briefing_format          text,
    briefing_description     text,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.version_number as challenge_version_number,
      version.title as challenge_title, version.subtitle as challenge_subtitle,
      version.description as challenge_description, version.mode as challenge_mode,
      version.max_score as challenge_max_score,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status = 'published' and version.mode = 'pyramid'
      and version.config_schema_version = 1 and version.mode_config = '{}'::jsonb
      and version.max_score = 100
      and (select count(*) from private.challenge_items item where item.challenge_version_id = version.id) = 7
      and (select count(*) from private.challenge_items item
        where item.challenge_version_id = version.id
          and item.position between 1 and 7 and item.config_schema_version = 1
          and private.is_valid_pyramid_level_config(item.mode_config)
          and private.is_supported_flash_question(item.question_version_id)) = 7
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_version_number, publication.challenge_title,
    publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, item.mode_config->>'levelId', item.mode_config->>'label',
    item.mode_config->'briefing'->>'title', item.mode_config->'briefing'->>'format',
    item.mode_config->'briefing'->>'description', question.id, question.type,
    question.payload_schema_version, question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_pyramid_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, answer.challenge_version_id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and attempt.outcome in ('summit', 'failed')
    and version.mode = 'pyramid' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_room_cards()
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with current_player as (
    select private.current_player_id() as player_id
  ), accessible_rooms as (
    select r.id, r.slug, r.title, r.description, m.role
    from public.rooms r
    join public.room_memberships m on m.room_id = r.id
    cross join current_player viewer
    where m.player_id = viewer.player_id
      and m.status = 'active'
      and r.status = 'active'
  )
  select
    r.id,
    r.slug,
    r.title,
    r.description,
    r.role,
    season.id,
    season.title,
    season.status,
    season.starts_at,
    season.ends_at,
    publication.id,
    publication.status,
    publication.opens_at,
    publication.closes_at,
    publication.challenge_title,
    publication.challenge_subtitle,
    publication.challenge_mode,
    publication.challenge_max_score,
    publication.question_count,
    publication.competitive_playable,
    (select count(*)::bigint
       from public.room_memberships active_members
      where active_members.room_id = r.id and active_members.status = 'active'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.display_name,
          'avatarPath', p.avatar_path,
          'role', active_members.role
        ) order by active_members.joined_at, p.id
      )
      from public.room_memberships active_members
      join public.players p on p.id = active_members.player_id
      where active_members.room_id = r.id
        and active_members.status = 'active'
        and p.status = 'active'
    ), '[]'::jsonb),
    coalesce((
      select sum(entries.amount)::bigint
      from private.flash_point_entries entries
      where entries.player_id = (select player_id from current_player)
        and entries.season_id = season.id
    ), 0::bigint),
    (
      select ranking."position"
      from public.get_season_ranking(season.id) ranking
      where ranking.player_id = (select player_id from current_player)
    )
  from accessible_rooms r
  left join lateral (
    select s.id, s.title, s.status, s.starts_at, s.ends_at
    from public.seasons s
    where s.room_id = r.id
      and s.status = 'active'
    order by s.starts_at desc, s.id
    limit 1
  ) season on true
  left join lateral (
    select
      sc.id,
      sc.status,
      sc.opens_at,
      sc.closes_at,
      cv.title as challenge_title,
      cv.subtitle as challenge_subtitle,
      cv.mode as challenge_mode,
      cv.max_score as challenge_max_score,
      (
        select count(*)::bigint
        from private.challenge_items items
        where items.challenge_version_id = cv.id
      ) as question_count,
      (
        select (count(*) between 2 and 20 and cv.mode in ('flash', 'survival')
            or count(*) = 7 and cv.mode = 'pyramid')
          and bool_and(private.is_supported_flash_question(q.id))
          and (cv.mode = 'flash' and cv.mode_config = '{}'::jsonb
            or cv.mode = 'survival'
              and jsonb_typeof(cv.mode_config->'lives') = 'number'
              and (cv.mode_config->>'lives')::integer between 1 and count(*)
              and (select count(*) from jsonb_object_keys(cv.mode_config)) = 1
            or cv.mode = 'pyramid' and cv.mode_config = '{}'::jsonb
              and bool_and(private.is_valid_pyramid_level_config(items.mode_config))
              and count(distinct items.mode_config->>'levelId') = 7)
        from private.challenge_items items
        join private.question_versions q on q.id = items.question_version_id
        where items.challenge_version_id = cv.id
      ) as competitive_playable
    from public.scheduled_challenges sc
    join private.challenge_versions cv on cv.id = sc.challenge_version_id
    where sc.season_id = season.id
      and private.publication_is_effectively_open(
        sc.status, season.status, season.starts_at, season.ends_at,
        sc.opens_at, sc.closes_at, statement_timestamp()
      )
      and cv.status = 'published'
    order by sc.number
    limit 1
  ) publication on true
  order by r.title, r.id
$function$;

CREATE OR REPLACE FUNCTION public.get_my_survival_challenge (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id                  uuid,
    room_slug                text,
    room_title               text,
    publication_id           uuid,
    publication_status       text,
    publication_opens_at     timestamp with time zone,
    publication_closes_at    timestamp with time zone,
    challenge_id             uuid,
    challenge_slug           text,
    challenge_version_id     uuid,
    challenge_title          text,
    challenge_subtitle       text,
    challenge_description    text,
    challenge_mode           text,
    challenge_max_score      integer,
    initial_lives            integer,
    question_count           bigint,
    own_attempt_id           uuid,
    own_attempt_status       text,
    own_attempt_score        integer,
    own_attempt_started_at   timestamp with time zone,
    own_attempt_completed_at timestamp with time zone,
    own_attempt_deadline_at  timestamp with time zone,
    own_attempt_lock_version bigint,
    challenge_item_id        uuid,
    item_position            integer,
    question_version_id      uuid,
    question_type            text,
    payload_schema_version   integer,
    time_limit_ms            integer,
    item_points              integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with viewer as (
    select private.current_player_id() as player_id
  ), authorized_publication as (
    select room.id as room_id, room.slug as room_slug, room.title as room_title,
      schedule.id as publication_id, schedule.status as publication_status,
      schedule.opens_at as publication_opens_at, schedule.closes_at as publication_closes_at,
      definition.id as challenge_id, definition.slug as challenge_slug,
      version.id as challenge_version_id, version.title as challenge_title,
      version.subtitle as challenge_subtitle, version.description as challenge_description,
      version.mode as challenge_mode, version.max_score as challenge_max_score,
      (version.mode_config->>'lives')::integer as initial_lives,
      attempt.id as own_attempt_id, attempt.status as own_attempt_status,
      attempt.score as own_attempt_score, attempt.started_at as own_attempt_started_at,
      attempt.completed_at as own_attempt_completed_at, attempt.deadline_at as own_attempt_deadline_at,
      attempt.lock_version as own_attempt_lock_version
    from public.rooms room
    join public.room_memberships membership on membership.room_id = room.id
    join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
    join public.scheduled_challenges schedule on schedule.season_id = season.id
    join private.challenge_versions version on version.id = schedule.challenge_version_id
    join private.challenge_definitions definition on definition.id = version.challenge_definition_id
    cross join viewer
    left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
      and attempt.player_id = viewer.player_id and attempt.kind = 'competitive'
    where room.slug = target_room_slug and schedule.id = target_publication_id
      and room.status = 'active'
      and membership.player_id = viewer.player_id and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'member')
      and (private.publication_is_effectively_open(
        schedule.status, season.status, season.starts_at, season.ends_at,
        schedule.opens_at, schedule.closes_at, statement_timestamp()) or attempt.id is not null)
      and version.status = 'published' and version.mode = 'survival'
      and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
      and jsonb_typeof(version.mode_config->'lives') = 'number'
      and (version.mode_config->>'lives')::integer between 1 and 20
  )
  select publication.room_id, publication.room_slug, publication.room_title,
    publication.publication_id, publication.publication_status,
    publication.publication_opens_at, publication.publication_closes_at,
    publication.challenge_id, publication.challenge_slug, publication.challenge_version_id,
    publication.challenge_title, publication.challenge_subtitle, publication.challenge_description,
    publication.challenge_mode, publication.challenge_max_score, publication.initial_lives,
    count(item.id) over (partition by publication.challenge_version_id),
    publication.own_attempt_id, publication.own_attempt_status, publication.own_attempt_score,
    publication.own_attempt_started_at, publication.own_attempt_completed_at,
    publication.own_attempt_deadline_at, publication.own_attempt_lock_version,
    item.id, item.position, question.id, question.type, question.payload_schema_version,
    question.time_limit_ms, item.points
  from authorized_publication publication
  join private.challenge_items item on item.challenge_version_id = publication.challenge_version_id
  join private.question_versions question on question.id = item.question_version_id
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_my_survival_result (
  target_attempt_id uuid
)
  RETURNS TABLE (
    attempt_id             uuid,
    scheduled_challenge_id uuid,
    challenge_item_id      uuid,
    item_position          integer,
    question_version_id    uuid,
    question_type          text,
    payload_schema_version integer,
    public_payload         jsonb,
    solution_payload       jsonb,
    answer                 jsonb,
    answer_status          text,
    points                 integer,
    result_details         jsonb,
    presented_at           timestamp with time zone,
    submitted_at           timestamp with time zone,
    time_used_ms           bigint,
    attempt_status         text,
    attempt_score          integer,
    attempt_outcome        text,
    attempt_started_at     timestamp with time zone,
    attempt_completed_at   timestamp with time zone,
    attempt_lock_version   bigint,
    challenge_title        text,
    challenge_subtitle     text,
    challenge_description  text,
    challenge_max_score    integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select attempt.id, attempt.scheduled_challenge_id, answer.challenge_item_id,
    item.position, answer.challenge_version_id, question.type, question.payload_schema_version,
    question.public_payload, solution.solution_payload, answer.answer, answer.status,
    answer.points, answer.result_details, answer.presented_at, answer.submitted_at,
    answer.time_used_ms, attempt.status, attempt.score, attempt.outcome,
    attempt.started_at, attempt.completed_at, attempt.lock_version,
    version.title, version.subtitle, version.description, version.max_score
  from public.attempts attempt
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join public.room_memberships membership on membership.room_id = room.id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.attempt_answers answer on answer.attempt_id = attempt.id
  join private.challenge_items item on item.id = answer.challenge_item_id
  join private.question_versions question on question.id = item.question_version_id
  join private.question_version_solutions solution on solution.question_version_id = question.id
  where attempt.id = target_attempt_id
    and attempt.player_id = private.current_player_id()
    and attempt.kind = 'competitive' and attempt.status = 'completed'
    and version.mode = 'survival' and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active' and membership.role in ('owner', 'admin', 'member')
  order by item.position
$function$;

CREATE OR REPLACE FUNCTION public.get_room_calendar (
  target_room_slug text
)
  RETURNS TABLE (
    room_id             uuid,
    room_slug           text,
    room_title          text,
    time_zone           text,
    membership_role     text,
    season_id           uuid,
    season_title        text,
    season_status       text,
    publication_id      uuid,
    publication_number  integer,
    publication_status  text,
    availability_status text,
    opens_at            timestamp with time zone,
    closes_at           timestamp with time zone,
    challenge_title     text,
    challenge_subtitle  text,
    challenge_mode      text,
    question_count      bigint,
    own_attempt_status  text,
    can_start           boolean,
    can_continue        boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id, room.slug, room.title, room.time_zone, membership.role,
    season.id, season.title, season.status,
    schedule.id, schedule.number, schedule.status,
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    schedule.opens_at, schedule.closes_at,
    version.title, version.subtitle, version.mode,
    compatibility.question_count,
    attempt.status,
    membership.role <> 'spectator' and (
      version.mode = 'flash' and version.mode_config = '{}'::jsonb
      or version.mode = 'survival'
        and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
        and jsonb_typeof(version.mode_config->'lives') = 'number'
        and (version.mode_config->>'lives')::integer between 1 and compatibility.question_count
      or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
        and compatibility.question_count = 7
    ) and compatibility.is_supported and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    coalesce(attempt.status = 'in_progress', false)
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join lateral (
    select
      count(*)::bigint as question_count,
      (count(*) between 2 and 20 and version.mode in ('flash', 'survival')
        or count(*) = 7 and version.mode = 'pyramid')
        and coalesce(bool_and(item.position between 1 and case when version.mode = 'pyramid' then 7 else 20 end), false)
        and coalesce(bool_and(item.points > 0), false)
        and coalesce(bool_and(item.config_schema_version = 1 and (
          version.mode = 'pyramid' and private.is_valid_pyramid_level_config(item.mode_config)
          or version.mode <> 'pyramid' and item.mode_config = '{}'::jsonb
        )), false)
        and (version.mode <> 'pyramid' or count(distinct item.mode_config->>'levelId') = 7)
        and count(*) filter (where private.is_supported_flash_question(question.id)) = count(*)
        and coalesce(sum(item.points), 0) = 100 as is_supported
    from private.challenge_items item
    join private.question_versions question on question.id = item.question_version_id
    where item.challenge_version_id = version.id
  ) compatibility on true
  left join public.attempts attempt on attempt.scheduled_challenge_id = schedule.id
    and attempt.player_id = private.current_player_id() and attempt.kind = 'competitive'
  where room.slug = target_room_slug
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status = 'published'
    and version.mode in ('flash', 'survival', 'pyramid')
    and version.config_schema_version = 1
    and version.max_score = 100
  order by schedule.number
$function$;

CREATE OR REPLACE FUNCTION public.get_room_detail (
  target_room_slug text
)
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    room_description     text,
    membership_role      text,
    season_id            uuid,
    season_title         text,
    season_status        text,
    season_starts_at     timestamp with time zone,
    season_ends_at       timestamp with time zone,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    member_count         bigint,
    member_previews      jsonb,
    current_flash_points bigint,
    current_position     bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select cards.*
  from public.get_my_room_cards() cards
  where cards.room_slug = target_room_slug
$function$;

CREATE OR REPLACE FUNCTION public.get_room_introduction (
  target_room_slug      text,
  target_publication_id uuid
)
  RETURNS TABLE (
    room_id              uuid,
    room_slug            text,
    room_title           text,
    membership_role      text,
    publication_id       uuid,
    publication_status   text,
    opens_at             timestamp with time zone,
    closes_at            timestamp with time zone,
    challenge_title      text,
    challenge_subtitle   text,
    challenge_mode       text,
    challenge_max_score  integer,
    question_count       bigint,
    competitive_playable boolean,
    availability_status  text,
    can_start            boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select
    room.id,
    room.slug,
    room.title,
    membership.role,
    schedule.id,
    schedule.status,
    schedule.opens_at,
    schedule.closes_at,
    version.title,
    version.subtitle,
    version.mode,
    version.max_score,
    (select count(*)::bigint from private.challenge_items item where item.challenge_version_id = version.id),
    (select (count(*) between 2 and 20 and version.mode in ('flash', 'survival')
          or count(*) = 7 and version.mode = 'pyramid')
        and bool_and(private.is_supported_flash_question(question.id))
        and (version.mode = 'flash' and version.mode_config = '{}'::jsonb
          or version.mode = 'survival'
            and jsonb_typeof(version.mode_config->'lives') = 'number'
            and (version.mode_config->>'lives')::integer between 1 and count(*)
            and (select count(*) from jsonb_object_keys(version.mode_config)) = 1
          or version.mode = 'pyramid' and version.mode_config = '{}'::jsonb
            and bool_and(private.is_valid_pyramid_level_config(item.mode_config))
            and count(distinct item.mode_config->>'levelId') = 7)
       from private.challenge_items item
       join private.question_versions question on question.id = item.question_version_id
      where item.challenge_version_id = version.id),
    private.publication_effective_status(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    ),
    membership.role <> 'spectator' and private.publication_is_effectively_open(
      schedule.status, season.status, season.starts_at, season.ends_at,
      schedule.opens_at, schedule.closes_at, statement_timestamp()
    )
  from public.rooms room
  join public.room_memberships membership on membership.room_id = room.id
  join public.seasons season on season.room_id = room.id and season.status in ('active', 'finished')
  join public.scheduled_challenges schedule on schedule.season_id = season.id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  where room.slug = target_room_slug
    and schedule.id = target_publication_id
    and room.status = 'active'
    and membership.player_id = private.current_player_id()
    and membership.status = 'active'
    and version.status = 'published'
  order by season.starts_at desc, schedule.number
$function$;

CREATE OR REPLACE FUNCTION public.get_season_ranking (
  target_season_id uuid
)
  RETURNS TABLE (
    player_id        uuid,
    display_name     text,
    avatar_path      text,
    flash_points     bigint,
    is_former_member boolean,
    "position"       bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_attempt_inspection (
  target_room_id                uuid,
  target_scheduled_challenge_id uuid,
  target_attempt_id             uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  inspection_payload jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'publication', jsonb_build_object(
      'scheduledChallengeId', schedule.id,
      'roomId', room.id,
      'roomTitle', room.title,
      'seasonId', season.id,
      'seasonTitle', season.title,
      'seasonStatus', season.status,
      'challengeVersionId', version.id,
      'challengeSlug', definition.slug,
      'versionNumber', version.version_number,
      'challengeTitle', version.title,
      'challengeSubtitle', version.subtitle,
      'mode', version.mode,
      'number', schedule.number,
      'status', schedule.status,
      'opensAt', schedule.opens_at,
      'closesAt', schedule.closes_at,
      'updatedAt', schedule.updated_at
    ),
    'attempt', jsonb_build_object(
      'attemptId', attempt.id,
      'playerId', attempt.player_id,
      'displayName', player.display_name,
      'avatarPath', player.avatar_path,
      'email', auth_user.email,
      'status', attempt.status,
      'outcome', attempt.outcome,
      'attemptNumber', attempt.attempt_number,
      'startedAt', attempt.started_at,
      'deadlineAt', attempt.deadline_at,
      'completedAt', attempt.completed_at,
      'originalScore', attempt.score,
      'effectiveScore', coalesce((select sum(entry.amount)::integer
        from private.flash_point_entries entry where entry.attempt_id = attempt.id), 0),
      'lockVersion', attempt.lock_version,
      'isCorrected', exists (select 1 from private.flash_point_entries entry
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'reversal')),
      'terminalReason', attempt.terminal_reason
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'challengeItemId', item.id,
        'position', item.position,
        'itemPoints', item.points,
        'questionVersionId', question.id,
        'questionType', question.type,
        'publicPayload', question.public_payload,
        'answer', answer.answer,
        'status', answer.status,
        'resultDetails', answer.result_details,
        'awardedPoints', answer.points,
        'presentedAt', answer.presented_at,
        'submittedAt', answer.submitted_at,
        'timeUsedMs', answer.time_used_ms
      ) order by item.position)
      from private.challenge_items item
      join private.question_versions question on question.id = item.question_version_id
      left join private.attempt_answers answer
        on answer.attempt_id = attempt.id and answer.challenge_item_id = item.id
      where item.challenge_version_id = attempt.challenge_version_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entryId', entry.id,
        'entryType', entry.entry_type,
        'amount', entry.amount,
        'reason', entry.reason,
        'createdByPlayerId', entry.created_by_player_id,
        'createdByDisplayName', creator.display_name,
        'createdAt', entry.created_at
      ) order by entry.created_at, entry.id)
      from private.flash_point_entries entry
      left join public.players creator on creator.id = entry.created_by_player_id
      where entry.attempt_id = attempt.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'auditId', audit.id,
        'action', audit.action,
        'entityType', audit.entity_type,
        'entityId', audit.entity_id,
        'reason', audit.reason,
        'requestId', audit.request_id,
        'actorPlayerId', audit.actor_player_id,
        'actorDisplayName', audit_actor.display_name,
        'beforePayload', coalesce(audit.before_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'afterPayload', coalesce(audit.after_payload - 'answer' - 'publicPayload' - 'solutionPayload', '{}'::jsonb),
        'createdAt', audit.created_at
      ) order by audit.created_at, audit.id)
      from private.audit_log audit
      left join public.players audit_actor on audit_actor.id = audit.actor_player_id
      where audit.entity_type = 'attempt' and audit.entity_id = attempt.id
    ), '[]'::jsonb)
  )
  into inspection_payload
  from public.attempts attempt
  join public.players player on player.id = attempt.player_id
  left join auth.users auth_user on auth_user.id = player.auth_user_id
  join public.scheduled_challenges schedule on schedule.id = attempt.scheduled_challenge_id
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = attempt.challenge_version_id
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where attempt.id = target_attempt_id
    and attempt.scheduled_challenge_id = target_scheduled_challenge_id
    and attempt.kind = 'competitive'
    and room.id = target_room_id
    and room.status = 'active'
    and version.status = 'published'
    and version.mode in ('flash', 'alphabet', 'survival', 'pyramid');

  return inspection_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_attempt_publications (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.rooms room
    where room.id = target_room_id and room.status = 'active'
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'roomId', target_room_id,
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomTitle', room.title,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by season.starts_at desc, schedule.number, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status = 'published'
        and version.mode in ('flash', 'alphabet', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_calendar_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.status = 'active' and version.status = 'published' and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_catalog()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'slug', definition.slug,
          'title', latest.title,
          'subtitle', latest.subtitle,
          'description', latest.description,
          'mode', latest.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = latest.id),
          'versionCount', (
            select count(*)
            from private.challenge_versions version_count
            where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid')
          ),
          'status', latest.status,
          'statusCounts', jsonb_build_object(
            'draft', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'draft'),
            'published', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'published'),
            'archived', (select count(*) from private.challenge_versions version_count where version_count.challenge_definition_id = definition.id and version_count.mode in ('flash', 'survival', 'pyramid') and version_count.status = 'archived')
          ),
          'updatedAt', latest.updated_at,
          'latestVersion', jsonb_build_object(
            'challengeVersionId', latest.id,
            'versionNumber', latest.version_number,
            'status', latest.status,
            'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = latest.id),
            'updatedAt', latest.updated_at,
            'publishedAt', latest.published_at
          )
        ) order by latest.updated_at desc, definition.id
      )
      from private.challenge_definitions definition
      join lateral (
        select version.*
        from private.challenge_versions version
        where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
        order by version.updated_at desc, version.id
        limit 1
      ) latest on true
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_challenge_detail (
  target_challenge_definition_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  challenge_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'challengeDefinitionId', definition.id,
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'challengeDefinitionId', definition.id,
          'challengeVersionId', version.id,
          'versionNumber', version.version_number,
          'status', version.status,
          'slug', definition.slug,
          'title', version.title,
          'subtitle', version.subtitle,
          'description', version.description,
          'mode', version.mode,
          'questionCount', (select count(*) from private.challenge_items item where item.challenge_version_id = version.id),
          'createdAt', version.created_at,
          'updatedAt', version.updated_at,
          'publishedAt', version.published_at,
          'document', case when version.status = 'draft' then jsonb_build_object(
            'challenge', jsonb_build_object(
              'slug', definition.slug,
              'title', version.title,
              'subtitle', version.subtitle,
              'description', version.description,
              'mode', version.mode,
              'configSchemaVersion', version.config_schema_version,
              'modeConfig', version.mode_config
            ),
            'questions', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'slug', question_definition.slug,
                  'type', question.type,
                  'payloadSchemaVersion', question.payload_schema_version,
                  'timeLimitMs', question.time_limit_ms,
                  'points', item.points,
                  'publicPayload', question.public_payload,
                  'solutionPayload', solution.solution_payload
                ) || case when version.mode = 'pyramid'
                  then jsonb_build_object('modeConfig', item.mode_config) else '{}'::jsonb end
                order by item.position
              )
              from private.challenge_items item
              join private.question_versions question on question.id = item.question_version_id
              join private.question_definitions question_definition on question_definition.id = question.question_definition_id
              join private.question_version_solutions solution on solution.question_version_id = question.id
              where item.challenge_version_id = version.id
            ), '[]'::jsonb)
          ) else null end
        ) order by version.updated_at desc, version.id
      )
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  )
  into challenge_payload
  from private.challenge_definitions definition
  where definition.id = target_challenge_definition_id
    and exists (
      select 1
      from private.challenge_versions version
      where version.challenge_definition_id = definition.id and version.mode in ('flash', 'survival', 'pyramid')
    );

  return challenge_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_dashboard_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
    'metrics', jsonb_build_object(
      'activeRooms', (
        select count(*)
        from public.rooms room
        where room.status = 'active'
      ),
      'activeSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status = 'active'
      ),
      'pendingSeasons', (
        select count(*)
        from public.seasons season
        join public.rooms room on room.id = season.room_id
        where room.status = 'active' and season.status in ('draft', 'scheduled')
      ),
      'editorialDrafts', (
        select count(*)
        from private.challenge_versions version
        where version.mode in ('flash', 'survival', 'pyramid') and version.status = 'draft'
      ),
      'upcomingChallenges', (
        select count(*)
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'pyramid')
          and version.status = 'published'
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
      )
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'roomId', room.id,
          'slug', room.slug,
          'title', room.title,
          'timeZone', room.time_zone,
          'seasonCount', (
            select count(*)
            from public.seasons season_count
            where season_count.room_id = room.id
          ),
          'activeSeason', (
            select jsonb_build_object(
              'title', season.title,
              'startsAt', season.starts_at,
              'endsAt', season.ends_at
            )
            from public.seasons season
            where season.room_id = room.id and season.status = 'active'
            order by season.starts_at desc, season.id
            limit 1
          )
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb),
    'upcomingChallenges', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduledChallengeId', upcoming.scheduled_challenge_id,
          'roomId', upcoming.room_id,
          'roomTitle', upcoming.room_title,
          'seasonId', upcoming.season_id,
          'seasonTitle', upcoming.season_title,
          'challengeVersionId', upcoming.challenge_version_id,
          'challengeTitle', upcoming.challenge_title,
          'number', upcoming.challenge_number,
          'status', upcoming.challenge_status,
          'opensAt', upcoming.opens_at,
          'closesAt', upcoming.closes_at,
          'timeZone', upcoming.time_zone
        ) order by upcoming.opens_at, upcoming.scheduled_challenge_id
      )
      from (
        select
          schedule.id as scheduled_challenge_id,
          room.id as room_id,
          room.title as room_title,
          season.id as season_id,
          season.title as season_title,
          version.id as challenge_version_id,
          version.title as challenge_title,
          schedule.number as challenge_number,
          schedule.status as challenge_status,
          schedule.opens_at,
          schedule.closes_at,
          room.time_zone
        from public.scheduled_challenges schedule
        join public.seasons season on season.id = schedule.season_id
        join public.rooms room on room.id = season.room_id
        join private.challenge_versions version on version.id = schedule.challenge_version_id
        where room.status = 'active'
          and season.status = 'active'
          and version.mode in ('flash', 'survival', 'pyramid')
          and version.status = 'published'
          and schedule.status in ('scheduled', 'open')
          and schedule.closes_at >= now()
        order by schedule.opens_at, schedule.id
        limit 5
      ) upcoming
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_editorial_context()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.read_superadmin_editorial_context();
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_portal_context()
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
          'timeZone', room.time_zone,
          'seasons', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'seasonId', season.id,
                'title', season.title,
                'status', season.status,
                'startsAt', season.starts_at,
                'endsAt', season.ends_at
              ) order by season.starts_at desc, season.id
            )
            from public.seasons season
            where season.room_id = room.id
          ), '[]'::jsonb),
          'status', room.status
        ) order by room.title, room.id
      )
      from public.rooms room
      where room.status = 'active'
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_question_library (
  input jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.read_superadmin_question_library(input); $function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_question_version (
  question_version_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.question_version_detail(question_version_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_attempts (
  target_room_id                uuid,
  target_scheduled_challenge_id uuid,
  cursor_started_at             timestamp with time zone,
  cursor_attempt_id             uuid,
  page_size                     integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  requested_page_size integer := least(greatest(coalesce(page_size, 50), 1), 100);
  publication_payload jsonb;
  attempt_payload jsonb;
  row_count integer := 0;
  last_started_at timestamptz;
  last_attempt_id uuid;
  next_cursor jsonb;
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'scheduledChallengeId', schedule.id,
    'roomId', room.id,
    'roomTitle', room.title,
    'seasonId', season.id,
    'seasonTitle', season.title,
    'seasonStatus', season.status,
    'challengeVersionId', version.id,
    'challengeSlug', definition.slug,
    'versionNumber', version.version_number,
    'challengeTitle', version.title,
    'challengeSubtitle', version.subtitle,
    'mode', version.mode,
    'number', schedule.number,
    'status', schedule.status,
    'opensAt', schedule.opens_at,
    'closesAt', schedule.closes_at,
    'updatedAt', schedule.updated_at
  )
  into publication_payload
  from public.scheduled_challenges schedule
  join public.seasons season on season.id = schedule.season_id
  join public.rooms room on room.id = season.room_id
  join private.challenge_versions version on version.id = schedule.challenge_version_id
  join private.challenge_definitions definition on definition.id = version.challenge_definition_id
  where schedule.id = target_scheduled_challenge_id
    and room.id = target_room_id
    and room.status = 'active'
    and version.status = 'published'
    and version.mode in ('flash', 'alphabet', 'survival', 'pyramid');

  if publication_payload is null then return null; end if;

  with page as (
    select
      attempt.id,
      attempt.player_id,
      player.display_name,
      player.avatar_path,
      attempt.status,
      attempt.outcome,
      attempt.attempt_number,
      attempt.started_at,
      attempt.deadline_at,
      attempt.completed_at,
      attempt.score,
      attempt.lock_version,
      coalesce((select sum(entry.amount)::integer
        from private.flash_point_entries entry where entry.attempt_id = attempt.id), 0) as effective_score,
      exists (select 1 from private.flash_point_entries entry
        where entry.attempt_id = attempt.id and entry.entry_type in ('adjustment', 'reversal')) as is_corrected
    from public.attempts attempt
    join public.players player on player.id = attempt.player_id
    where attempt.scheduled_challenge_id = target_scheduled_challenge_id
      and attempt.kind = 'competitive'
      and player.status in ('active', 'anonymized')
      and (
        cursor_started_at is null
        or (attempt.started_at, attempt.id) < (cursor_started_at, cursor_attempt_id)
      )
    order by attempt.started_at desc, attempt.id desc
    limit requested_page_size
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'attemptId', page.id,
      'playerId', page.player_id,
      'displayName', page.display_name,
      'avatarPath', page.avatar_path,
      'status', page.status,
      'outcome', page.outcome,
      'attemptNumber', page.attempt_number,
      'startedAt', page.started_at,
      'deadlineAt', page.deadline_at,
      'completedAt', page.completed_at,
      'originalScore', page.score,
      'effectiveScore', page.effective_score,
      'lockVersion', page.lock_version,
      'isCorrected', page.is_corrected
    ) order by page.started_at desc, page.id desc), '[]'::jsonb),
    count(*)::integer,
    (array_agg(page.started_at order by page.started_at desc, page.id desc))[count(*)::integer],
    (array_agg(page.id order by page.started_at desc, page.id desc))[count(*)::integer]
  into attempt_payload, row_count, last_started_at, last_attempt_id
  from page;

  if row_count = requested_page_size and exists (
    select 1
    from public.attempts attempt
    where attempt.scheduled_challenge_id = target_scheduled_challenge_id
      and attempt.kind = 'competitive'
      and (attempt.started_at, attempt.id) < (last_started_at, last_attempt_id)
  ) then
    next_cursor := jsonb_build_object(
      'startedAt', last_started_at,
      'attemptId', last_attempt_id
    );
  end if;

  return jsonb_build_object(
    'publication', publication_payload,
    'attempts', attempt_payload,
    'nextCursor', next_cursor
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_calendar_context (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scheduledChallengeId', schedule.id,
        'roomId', room.id,
        'roomSlug', room.slug,
        'roomTitle', room.title,
        'timeZone', room.time_zone,
        'seasonId', season.id,
        'seasonTitle', season.title,
        'seasonStatus', season.status,
        'challengeVersionId', version.id,
        'challengeSlug', definition.slug,
        'versionNumber', version.version_number,
        'challengeTitle', version.title,
        'challengeSubtitle', version.subtitle,
        'mode', version.mode,
        'number', schedule.number,
        'status', schedule.status,
        'opensAt', schedule.opens_at,
        'closesAt', schedule.closes_at,
        'updatedAt', schedule.updated_at
      ) order by schedule.opens_at desc, schedule.id)
      from public.scheduled_challenges schedule
      join public.seasons season on season.id = schedule.season_id
      join public.rooms room on room.id = season.room_id
      join private.challenge_versions version on version.id = schedule.challenge_version_id
      join private.challenge_definitions definition on definition.id = version.challenge_definition_id
      where room.id = target_room_id
        and room.status = 'active'
        and version.status = 'published'
        and version.mode in ('flash', 'survival', 'pyramid')
    ), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_superadmin_room_detail (
  target_room_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  actor uuid := (select private.current_player_id());
  room_payload jsonb;
begin
  if actor is null or not exists (
    select 1
    from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'room', jsonb_build_object(
      'roomId', room.id,
      'slug', room.slug,
      'title', room.title,
      'timeZone', room.time_zone,
      'status', room.status,
      'seasons', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'seasonId', season.id,
            'title', season.title,
            'status', season.status,
            'startsAt', season.starts_at,
            'endsAt', season.ends_at
          ) order by season.starts_at desc, season.id
        )
        from public.seasons season
        where season.room_id = room.id
      ), '[]'::jsonb)
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'playerId', player.id,
          'displayName', player.display_name,
          'email', auth_user.email,
          'avatarPath', player.avatar_path,
          'role', membership.role,
          'joinedAt', membership.joined_at
        ) order by membership.joined_at, player.id
      )
      from public.room_memberships membership
      join public.players player on player.id = membership.player_id
      left join auth.users auth_user on auth_user.id = player.auth_user_id
      where membership.room_id = room.id
        and membership.status = 'active'
        and player.status = 'active'
    ), '[]'::jsonb)
  )
  into room_payload
  from public.rooms room
  where room.id = target_room_id and room.status = 'active';

  return room_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION public.lookup_superadmin_players (
  target_emails text[]
)
  RETURNS TABLE (
    email        text,
    player_id    uuid,
    display_name text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare actor uuid := private.current_player_id();
begin
  if actor is null or not exists (
    select 1 from private.platform_role_assignments assignment
    where assignment.player_id = actor and assignment.role = 'superadmin'
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return query
  select lower(auth_user.email), p.id, p.display_name
  from unnest(coalesce(target_emails, '{}'::text[])) requested(email)
  join auth.users auth_user on lower(auth_user.email) = lower(btrim(requested.email))
  join public.players p on p.auth_user_id = auth_user.id
  where p.status = 'active'
  order by lower(auth_user.email), p.id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.manage_room_member (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.manage_room_member_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.provision_player()
  RETURNS TABLE (
    player_id    uuid,
    display_name text,
    avatar_path  text,
    status       text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  auth_user uuid := (select auth.uid());
  initial_name text := btrim(coalesce((select auth.jwt()) -> 'user_metadata' ->> 'display_name', ''));
begin
  if auth_user is null
    or coalesce((select auth.jwt()) ->> 'is_anonymous', 'false') <> 'false' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if initial_name = '' or char_length(initial_name) not between 2 and 24 then
    initial_name := 'Jugador';
  end if;

  insert into public.players (auth_user_id, display_name)
  values (auth_user, initial_name)
  on conflict (auth_user_id) do nothing;

  select p.id, p.display_name, p.avatar_path, p.status
    into player_id, display_name, avatar_path, status
  from public.players p
  where p.auth_user_id = auth_user and p.status = 'active';

  if not found then
    raise exception 'player_unavailable' using errcode = '55000';
  end if;

  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.publish_superadmin_flash (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.publish_flash_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.publish_superadmin_question (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.publish_question_command(input); $function$;

CREATE OR REPLACE FUNCTION public.update_superadmin_flash_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.update_flash_draft_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.update_superadmin_question_draft (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$ select private.update_question_draft_command(input); $function$;

CREATE OR REPLACE FUNCTION public.update_superadmin_scheduled_challenge (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.update_scheduled_challenge_command(input);
$function$;

CREATE OR REPLACE FUNCTION public.update_superadmin_season (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.update_season_command(input);
$function$;

ALTER TABLE "private"."attempt_answers"
  ADD CONSTRAINT "answers_receipt_fk" FOREIGN KEY (receipt_id, attempt_id, challenge_item_id, challenge_version_id)
    REFERENCES private.answer_receipts(id, attempt_id, challenge_item_id, challenge_version_id);

ALTER TABLE "private"."answer_receipts"
  ADD CONSTRAINT "answer_receipts_challenge_item_id_challenge_version_id_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id);

ALTER TABLE "private"."attempt_answers"
  ADD CONSTRAINT "attempt_answers_challenge_item_id_challenge_version_id_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."attempt_timing_units"
  ADD CONSTRAINT "attempt_timing_units_challenge_item_id_challenge_version_i_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id);

ALTER TABLE "private"."challenge_versions"
  ADD CONSTRAINT "challenge_versions_challenge_definition_id_fkey" FOREIGN KEY (challenge_definition_id) REFERENCES private.challenge_definitions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."challenge_items"
  ADD CONSTRAINT "challenge_items_challenge_version_id_fkey" FOREIGN KEY (challenge_version_id) REFERENCES private.challenge_versions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."interaction_intervals"
  ADD CONSTRAINT "interaction_intervals_timing_unit_id_attempt_id_challenge__fkey" FOREIGN KEY (timing_unit_id, attempt_id, challenge_item_id)
    REFERENCES private.attempt_timing_units(id, attempt_id, challenge_item_id);

ALTER TABLE "private"."logic_code_attempt_events"
  ADD CONSTRAINT "logic_code_attempt_events_challenge_item_id_challenge_vers_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id);

ALTER TABLE "private"."matching_pair_events"
  ADD CONSTRAINT "matching_pair_events_challenge_item_id_challenge_version_i_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."mini_wordle_guess_events"
  ADD CONSTRAINT "mini_wordle_guess_events_challenge_item_id_challenge_versi_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."progressive_clue_reveal_events"
  ADD CONSTRAINT "progressive_clue_reveal_event_challenge_item_id_challenge__fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id);

ALTER TABLE "private"."queens_placement_events"
  ADD CONSTRAINT "queens_placement_events_challenge_item_id_challenge_versio_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."challenge_items"
  ADD CONSTRAINT "challenge_items_question_version_id_fkey" FOREIGN KEY (question_version_id) REFERENCES private.question_versions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_version_solutions"
  ADD CONSTRAINT "question_version_solutions_question_version_id_fkey" FOREIGN KEY (question_version_id) REFERENCES private.question_versions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_versions"
  ADD CONSTRAINT "question_versions_question_definition_id_fkey" FOREIGN KEY (question_definition_id) REFERENCES private.question_definitions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."word_search_selection_events"
  ADD CONSTRAINT "word_search_selection_events_challenge_item_id_challenge_v_fkey" FOREIGN KEY (challenge_item_id, challenge_version_id)
    REFERENCES private.challenge_items(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."answer_receipts"
  ADD CONSTRAINT "answer_receipts_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id);

ALTER TABLE "private"."attempt_answers"
  ADD CONSTRAINT "attempt_answers_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id)
    ON DELETE RESTRICT;

ALTER TABLE "private"."attempt_timing_units"
  ADD CONSTRAINT "attempt_timing_units_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id);

ALTER TABLE "private"."logic_code_attempt_events"
  ADD CONSTRAINT "logic_code_attempt_events_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id)
    REFERENCES public.attempts(id, challenge_version_id);

ALTER TABLE "private"."matching_pair_events"
  ADD CONSTRAINT "matching_pair_events_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id)
    ON DELETE RESTRICT;

ALTER TABLE "private"."mini_wordle_guess_events"
  ADD CONSTRAINT "mini_wordle_guess_events_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id)
    ON DELETE RESTRICT;

ALTER TABLE "private"."progressive_clue_reveal_events"
  ADD CONSTRAINT "progressive_clue_reveal_event_attempt_id_challenge_version_fkey" FOREIGN KEY (attempt_id, challenge_version_id)
    REFERENCES public.attempts(id, challenge_version_id);

ALTER TABLE "private"."queens_placement_events"
  ADD CONSTRAINT "queens_placement_events_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id)
    ON DELETE RESTRICT;

ALTER TABLE "private"."word_search_selection_events"
  ADD CONSTRAINT "word_search_selection_events_attempt_id_challenge_version__fkey" FOREIGN KEY (attempt_id, challenge_version_id)
    REFERENCES public.attempts(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."flash_point_entries"
  ADD CONSTRAINT "flash_point_entries_attempt_id_player_id_scheduled_challen_fkey" FOREIGN KEY (attempt_id, player_id, scheduled_challenge_id)
    REFERENCES public.attempts(id, player_id, scheduled_challenge_id) ON DELETE RESTRICT;

ALTER TABLE "private"."attempt_sessions"
  ADD CONSTRAINT "attempt_sessions_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES public.attempts(id) ON DELETE RESTRICT;

ALTER TABLE "public"."players"
  ADD CONSTRAINT "players_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "private"."audit_log"
  ADD CONSTRAINT "audit_log_actor_player_id_fkey" FOREIGN KEY (actor_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."challenge_definitions"
  ADD CONSTRAINT "challenge_definitions_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."challenge_versions"
  ADD CONSTRAINT "challenge_versions_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."command_requests"
  ADD CONSTRAINT "command_requests_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."flash_point_entries"
  ADD CONSTRAINT "flash_point_entries_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."media_assets"
  ADD CONSTRAINT "media_assets_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."media_assets"
  ADD CONSTRAINT "media_assets_owner_player_id_fkey" FOREIGN KEY (owner_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."platform_role_assignments"
  ADD CONSTRAINT "platform_role_assignments_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_definitions"
  ADD CONSTRAINT "question_definitions_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_versions"
  ADD CONSTRAINT "question_versions_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."room_invitations"
  ADD CONSTRAINT "room_invitations_created_by_player_id_fkey" FOREIGN KEY (created_by_player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "public"."attempts"
  ADD CONSTRAINT "attempts_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "public"."room_memberships"
  ADD CONSTRAINT "room_memberships_player_id_fkey" FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE RESTRICT;

ALTER TABLE "private"."room_invitations"
  ADD CONSTRAINT "room_invitations_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE RESTRICT;

ALTER TABLE "public"."room_memberships"
  ADD CONSTRAINT "room_memberships_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE RESTRICT;

ALTER TABLE "public"."scheduled_challenges"
  ADD CONSTRAINT "scheduled_challenges_challenge_version_id_fkey" FOREIGN KEY (challenge_version_id) REFERENCES private.challenge_versions(id) ON DELETE RESTRICT;

ALTER TABLE "public"."attempts"
  ADD CONSTRAINT "attempts_scheduled_challenge_id_challenge_version_id_fkey" FOREIGN KEY (scheduled_challenge_id, challenge_version_id)
    REFERENCES public.scheduled_challenges(id, challenge_version_id) ON DELETE RESTRICT;

ALTER TABLE "private"."flash_point_entries"
  ADD CONSTRAINT "flash_point_entries_scheduled_challenge_id_season_id_fkey" FOREIGN KEY (scheduled_challenge_id, season_id) REFERENCES public.scheduled_challenges(id, season_id)
    ON DELETE RESTRICT;

ALTER TABLE "public"."scheduled_challenges"
  ADD CONSTRAINT "scheduled_challenges_season_id_tstzrange_excl" EXCLUDE USING gist (season_id WITH =, tstzrange(opens_at, closes_at, '[)'::text) WITH &&)
    WHERE ((status <> 'cancelled'::text));

ALTER TABLE "public"."scheduled_challenges"
  ADD CONSTRAINT "scheduled_challenges_season_id_fkey" FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE RESTRICT;

ALTER TABLE "public"."seasons"
  ADD CONSTRAINT "seasons_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE RESTRICT;

CREATE VIEW "private"."effective_results" WITH (security_invoker=true) AS  SELECT a.id AS attempt_id,
    a.player_id,
    a.scheduled_challenge_id,
    sc.season_id,
    s.room_id,
    a.started_at,
    points.flash_points,
    duration.duration_ms
   FROM ((((public.attempts a
     JOIN public.scheduled_challenges sc ON ((sc.id = a.scheduled_challenge_id)))
     JOIN public.seasons s ON ((s.id = sc.season_id)))
     JOIN LATERAL ( SELECT sum(e.amount) AS flash_points
           FROM private.flash_point_entries e
          WHERE (e.attempt_id = a.id)
         HAVING bool_or((e.entry_type = 'accreditation'::text))) points ON (true))
     CROSS JOIN LATERAL ( SELECT (COALESCE(sum(aa.time_used_ms), (0)::numeric))::bigint AS duration_ms
           FROM private.attempt_answers aa
          WHERE (aa.attempt_id = a.id)) duration)
  WHERE ((a.kind = 'competitive'::text) AND (a.status = 'completed'::text) AND (sc.status <> 'cancelled'::text));

CREATE INDEX answers_attempt_time_idx ON private.attempt_answers USING btree (attempt_id, submitted_at);

CREATE INDEX answers_item_version_idx ON private.attempt_answers USING btree (challenge_item_id, challenge_version_id);

CREATE UNIQUE INDEX answers_receipt_idx ON private.attempt_answers USING btree (receipt_id);

CREATE INDEX audit_actor_time_idx ON private.audit_log USING btree (actor_player_id, created_at);

CREATE INDEX audit_entity_time_idx ON private.audit_log USING btree (entity_type, entity_id, created_at);

CREATE INDEX challenge_definitions_author_idx ON private.challenge_definitions USING btree (created_by_player_id);

CREATE UNIQUE INDEX challenge_items_question_version_unique_idx ON private.challenge_items USING btree (challenge_version_id, question_version_id);

CREATE INDEX challenge_versions_author_idx ON private.challenge_versions USING btree (created_by_player_id);

CREATE INDEX entries_attempt_player_publication_idx ON private.flash_point_entries USING btree (attempt_id, player_id, scheduled_challenge_id);

CREATE INDEX entries_creator_idx ON private.flash_point_entries USING btree (created_by_player_id);

CREATE UNIQUE INDEX entries_one_accreditation_idx ON private.flash_point_entries USING btree (attempt_id)
  WHERE (entry_type = 'accreditation'::text);

CREATE INDEX entries_publication_season_idx ON private.flash_point_entries USING btree (scheduled_challenge_id, season_id);

CREATE INDEX entries_season_player_idx ON private.flash_point_entries USING btree (season_id, player_id);

CREATE INDEX intervals_item_idx ON private.interaction_intervals USING btree (attempt_id, challenge_item_id, started_at);

CREATE UNIQUE INDEX intervals_one_open_idx ON private.interaction_intervals USING btree (attempt_id)
  WHERE (ended_at IS NULL);

CREATE INDEX intervals_unit_idx ON private.interaction_intervals USING btree (timing_unit_id, attempt_id, challenge_item_id);

CREATE INDEX invitations_creator_idx ON private.room_invitations USING btree (created_by_player_id);

CREATE INDEX invitations_room_idx ON private.room_invitations USING btree (room_id);

CREATE INDEX items_question_version_idx ON private.challenge_items USING btree (question_version_id);

CREATE INDEX logic_code_events_item_idx ON private.logic_code_attempt_events USING btree (attempt_id, challenge_item_id, SEQUENCE);

CREATE UNIQUE INDEX matching_pair_events_correct_left_idx ON private.matching_pair_events USING btree (attempt_id, challenge_item_id, left_item_id)
  WHERE correct;

CREATE UNIQUE INDEX matching_pair_events_correct_right_idx ON private.matching_pair_events USING btree (attempt_id, challenge_item_id, right_item_id)
  WHERE correct;

CREATE INDEX matching_pair_events_item_idx ON private.matching_pair_events USING btree (attempt_id, challenge_item_id, SEQUENCE);

CREATE INDEX matching_pair_events_left_idx ON private.matching_pair_events USING btree (attempt_id, challenge_item_id, left_item_id);

CREATE INDEX matching_pair_events_right_idx ON private.matching_pair_events USING btree (attempt_id, challenge_item_id, right_item_id);

CREATE INDEX media_assets_bucket_path_idx ON private.media_assets USING btree (bucket_id, object_path);

CREATE INDEX media_assets_owner_status_idx ON private.media_assets USING btree (owner_player_id, status, updated_at DESC);

CREATE INDEX mini_wordle_dictionary_lookup_idx ON private.mini_wordle_dictionary_words USING btree (dictionary_id, word_length, word);

CREATE INDEX progressive_clue_events_item_idx ON private.progressive_clue_reveal_events USING btree (attempt_id, challenge_item_id, clue_index);

CREATE INDEX queens_placement_events_cell_idx ON private.queens_placement_events USING btree (attempt_id, challenge_item_id, cell, SEQUENCE DESC);

CREATE INDEX queens_placement_events_item_idx ON private.queens_placement_events USING btree (attempt_id, challenge_item_id, SEQUENCE);

CREATE INDEX question_definitions_author_idx ON private.question_definitions USING btree (created_by_player_id);

CREATE INDEX question_versions_author_idx ON private.question_versions USING btree (created_by_player_id);

CREATE INDEX question_versions_library_idx ON private.question_versions USING btree (status, TYPE, updated_at DESC, id);

CREATE INDEX receipts_item_idx ON private.answer_receipts USING btree (challenge_item_id, challenge_version_id);

CREATE INDEX sessions_attempt_idx ON private.attempt_sessions USING btree (attempt_id);

CREATE UNIQUE INDEX sessions_one_unrevoked_idx ON private.attempt_sessions USING btree (attempt_id)
  WHERE (revoked_at IS NULL);

CREATE INDEX timing_item_version_idx ON private.attempt_timing_units USING btree (challenge_item_id, challenge_version_id);

CREATE UNIQUE INDEX word_search_selection_events_correct_target_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, matched_target_id)
  WHERE (correct AND (matched_target_id IS NOT NULL));

CREATE INDEX word_search_selection_events_item_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, SEQUENCE);

CREATE INDEX word_search_selection_events_target_idx ON private.word_search_selection_events USING btree (attempt_id, challenge_item_id, matched_target_id)
  WHERE correct;

CREATE UNIQUE INDEX attempts_one_competitive_idx ON public.attempts USING btree (player_id, scheduled_challenge_id)
  WHERE (kind = 'competitive'::text);

CREATE INDEX attempts_publication_started_idx ON public.attempts USING btree (scheduled_challenge_id, started_at DESC, id DESC);

CREATE INDEX attempts_publication_status_idx ON public.attempts USING btree (scheduled_challenge_id, status);

CREATE INDEX attempts_publication_version_idx ON public.attempts USING btree (scheduled_challenge_id, challenge_version_id);

CREATE UNIQUE INDEX memberships_one_owner_idx ON public.room_memberships USING btree (room_id)
  WHERE ((ROLE = 'owner'::text) AND (status = 'active'::text));

CREATE INDEX memberships_player_status_idx ON public.room_memberships USING btree (player_id, status, room_id);

CREATE INDEX memberships_room_status_idx ON public.room_memberships USING btree (room_id, status);

CREATE INDEX publications_season_window_idx ON public.scheduled_challenges USING btree (season_id, opens_at, closes_at);

CREATE INDEX publications_version_idx ON public.scheduled_challenges USING btree (challenge_version_id);

CREATE UNIQUE INDEX seasons_one_active_idx ON public.seasons USING btree (room_id)
  WHERE (status = 'active'::text);

CREATE INDEX seasons_room_start_idx ON public.seasons USING btree (room_id, starts_at);

CREATE TRIGGER receipts_append_only
  BEFORE DELETE OR UPDATE ON private.answer_receipts
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER answers_append_only
  BEFORE DELETE OR UPDATE ON private.attempt_answers
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER answers_guard
  BEFORE INSERT ON private.attempt_answers
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_answer();

CREATE TRIGGER timing_units_immutable
  BEFORE DELETE OR UPDATE ON private.attempt_timing_units
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER audit_append_only
  BEFORE DELETE OR UPDATE ON private.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.challenge_definitions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER items_freeze
  BEFORE INSERT OR DELETE OR UPDATE ON private.challenge_items
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_content_child();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.challenge_items
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER challenges_freeze
  BEFORE INSERT OR DELETE OR UPDATE ON private.challenge_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_version();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.challenge_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER requests_append_only
  BEFORE DELETE OR UPDATE ON private.command_requests
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER entries_append_only
  BEFORE DELETE OR UPDATE ON private.flash_point_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER entries_guard
  BEFORE INSERT ON private.flash_point_entries
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_point_entry();

CREATE TRIGGER media_assets_touch_updated_at
  BEFORE UPDATE ON private.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.platform_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.question_definitions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER solutions_freeze
  BEFORE INSERT OR DELETE OR UPDATE ON private.question_version_solutions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_content_child();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.question_version_solutions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER questions_freeze
  BEFORE INSERT OR DELETE OR UPDATE ON private.question_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_version();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.question_versions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON private.room_invitations
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER attempts_guard
  BEFORE INSERT OR UPDATE ON public.attempts
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_attempt();

CREATE TRIGGER attempts_no_delete
  BEFORE DELETE ON public.attempts
  FOR EACH ROW
  EXECUTE FUNCTION private.reject_rewrite();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.attempts
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER players_guard
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_player();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER memberships_lock
  BEFORE INSERT OR DELETE OR UPDATE ON public.room_memberships
  FOR EACH ROW
  EXECUTE FUNCTION private.lock_membership_room();

CREATE CONSTRAINT TRIGGER memberships_require_owner
  AFTER INSERT OR DELETE OR UPDATE ON public.room_memberships DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION private.require_room_owner();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.room_memberships
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER rooms_guard
  BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_room();

CREATE CONSTRAINT TRIGGER rooms_require_owner
  AFTER INSERT OR UPDATE ON public.rooms DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION private.require_room_owner();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER publications_guard
  BEFORE INSERT OR UPDATE ON public.scheduled_challenges
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_publication();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.scheduled_challenges
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE TRIGGER seasons_guard
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_season();

CREATE TRIGGER z_touch
  BEFORE UPDATE ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

CREATE POLICY "attempts_select_own" ON "public"."attempts"
  FOR SELECT
  TO "authenticated"
  USING (((kind = 'competitive'::text) AND (status <> 'invalidated'::text) AND private.can_read_own_attempt(scheduled_challenge_id, player_id)));

CREATE POLICY "players_select" ON "public"."players"
  FOR SELECT
  TO "authenticated"
  USING (private.can_read_profile(id));

CREATE POLICY "players_update_name" ON "public"."players"
  FOR UPDATE
  TO "authenticated"
  USING (((id = ( SELECT private.current_player_id() AS current_player_id)) AND (status = 'active'::text)))
  WITH CHECK (((id = ( SELECT private.current_player_id() AS current_player_id)) AND (status = 'active'::text)));

CREATE POLICY "memberships_select" ON "public"."room_memberships"
  FOR SELECT
  TO "authenticated"
  USING (((status = 'active'::text) AND private.is_room_member(room_id)));

CREATE POLICY "rooms_select" ON "public"."rooms"
  FOR SELECT
  TO "authenticated"
  USING (private.is_room_member(id));

CREATE POLICY "publications_select" ON "public"."scheduled_challenges"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.seasons s
  WHERE ((s.id = scheduled_challenges.season_id) AND (s.status <> 'draft'::text) AND private.is_room_member(s.room_id)))));

CREATE POLICY "seasons_select" ON "public"."seasons"
  FOR SELECT
  TO "authenticated"
  USING (((status <> 'draft'::text) AND private.is_room_member(room_id)));

CREATE POLICY "storage_avatars_public_read" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'avatars'::text));

CREATE POLICY "storage_question_assets_private" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (false);

COMMENT ON EXTENSION "btree_gist" IS 'support for indexing common datatypes in GiST';

COMMENT ON FUNCTION "private"."is_supported_competitive_question_extension"(uuid) IS 'Additive allowlist for server-evaluated formats shared by Flash, Survival and Pyramid.';

COMMENT ON FUNCTION "private"."is_valid_published_competitive_question_format"(uuid, text) IS 'Validates a published version against its existing editorial contract before competitive admission.';

REVOKE ALL ON FUNCTION "private"."abandon_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."abandon_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."abort_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."abort_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."abort_question_asset_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."abort_question_asset_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."accept_invitation"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."accept_invitation"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."activate_season_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."activate_season_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."add_superadmin_room_member_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."add_superadmin_room_member_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."adjust_result"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."adjust_result"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."archive_question_asset_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."archive_question_asset_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."archive_question_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."archive_question_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."assert_supported_calendar_content"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."assert_supported_calendar_content"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."can_read_own_attempt"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_own_attempt"(uuid, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."can_read_profile"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_profile"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."command_actor"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."command_actor"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."complete_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."complete_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."confirm_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."confirm_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."confirm_question_asset_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."confirm_question_asset_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."create_flash_draft_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_flash_draft_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_question_draft_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_question_draft_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_room_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_room_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_scheduled_challenge_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_scheduled_challenge_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_season_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_season_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."create_superadmin_player_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."create_superadmin_player_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."current_player_id"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."current_player_id"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."editorial_has_secret_key"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."editorial_has_secret_key"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."ensure_progressive_clue_initial"(uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."ensure_progressive_clue_initial"(uuid, uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."escape_content_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."escape_content_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."execute_command"(text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."execute_command"(text, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_answer"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_answer"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_attempt"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_attempt"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_content_child"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_content_child"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_player"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_player"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_point_entry"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_point_entry"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_publication"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_publication"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_room"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_room"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_season"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_season"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."guard_version"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."guard_version"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."handle_attempt_admin_command"(text, jsonb, uuid, public.attempts, public.scheduled_challenges, timestamp WITH time zone, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."handle_attempt_admin_command"(text, jsonb, uuid, public.attempts, public.scheduled_challenges, timestamp WITH time zone, text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."handle_attempt_command"(text, jsonb, jsonb, uuid, jsonb, timestamp WITH time zone) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."handle_attempt_command"(text, jsonb, jsonb, uuid, jsonb, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "private"."handle_invitation_command"(jsonb, jsonb, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."handle_invitation_command"(jsonb, jsonb, uuid, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."invalidate_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."invalidate_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."is_ready_question_asset"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_ready_question_asset"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_room_member"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_room_member"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."is_supported_competitive_question_extension"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_supported_competitive_question_extension"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_supported_flash_question"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_supported_flash_question"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_usable_question_asset"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_usable_question_asset"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_valid_published_competitive_question_format"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_valid_published_competitive_question_format"(uuid, text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."is_valid_pyramid_level_config"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_valid_pyramid_level_config"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."lock_command_key"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."lock_command_key"(uuid, text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."lock_membership_room"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."lock_membership_room"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."logic_code_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."logic_code_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."manage_room_member_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."manage_room_member_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."matching_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."matching_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."matching_public_payload"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."matching_public_payload"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."mini_wordle_feedback"(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."mini_wordle_feedback"(text, text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."mini_wordle_normalize"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."mini_wordle_normalize"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."mini_wordle_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."mini_wordle_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."next_attempt_item"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."next_attempt_item"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."pass_interaction"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_interaction"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."prepare_avatar_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."prepare_avatar_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."prepare_interaction"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."prepare_interaction"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."prepare_question_asset_upload_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."prepare_question_asset_upload_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."progressive_clue_effective_penalty"(integer, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."progressive_clue_effective_penalty"(integer, integer) TO "postgres";

REVOKE ALL ON FUNCTION "private"."progressive_clues_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."progressive_clues_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."progressive_clues_public_payload"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."progressive_clues_public_payload"(uuid) TO "postgres";

REVOKE ALL
  ON FUNCTION "private"."publication_effective_status"(text, text, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp
    WITH time zone)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "private"."publication_effective_status"(text, text, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp
    WITH time zone)
  TO "postgres";

REVOKE ALL
  ON FUNCTION "private"."publication_is_effectively_open"(text, text, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp
    WITH time zone, timestamp WITH time zone)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION "private"."publication_is_effectively_open"(text, text, timestamp WITH time zone, timestamp WITH time zone, timestamp WITH time zone, timestamp
    WITH time zone, timestamp WITH time zone)
  TO "postgres";

REVOKE ALL ON FUNCTION "private"."publish_flash_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."publish_flash_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."publish_question_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."publish_question_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."queens_answer"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."queens_answer"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."queens_board"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."queens_board"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."queens_cell_conflicts"(jsonb, integer, integer[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."queens_cell_conflicts"(jsonb, integer, integer[]) TO "postgres";

REVOKE ALL ON FUNCTION "private"."queens_content_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."queens_content_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."queens_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."queens_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."question_version_detail"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."question_version_detail"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."question_version_document"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."question_version_document"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."read_attempt_recovery"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_attempt_recovery"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_avatar_upload_asset"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_avatar_upload_asset"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_competitive_question_asset"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_competitive_question_asset"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_evaluation_context"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_evaluation_context"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_question_asset_upload"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_question_asset_upload"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_superadmin_editorial_context"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_superadmin_editorial_context"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."read_superadmin_question_library"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_superadmin_question_library"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."receive_answer"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."receive_answer"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."record_evaluation"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."record_evaluation"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."recover_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."recover_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."reject_rewrite"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."reject_rewrite"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."require_room_owner"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."require_room_owner"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."reveal_progressive_clue"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."reveal_progressive_clue"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."room_slug_base"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."room_slug_base"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."run_calendar_tick_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."run_calendar_tick_command"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."secret_hash"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."secret_hash"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."start_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."start_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_logic_code_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_logic_code_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_matching_pair"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_matching_pair"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_mini_wordle_guess"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_mini_wordle_guess"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_queens_placement"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_queens_placement"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_word_hashtag_swap"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_word_hashtag_swap"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."submit_word_search_selection"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_word_search_selection"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."take_over_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."take_over_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."touch_updated_at"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."touch_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."update_flash_draft_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."update_flash_draft_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."update_question_draft_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."update_question_draft_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."update_scheduled_challenge_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."update_scheduled_challenge_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."update_season_command"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."update_season_command"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."validate_flash_editorial_document"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."validate_flash_editorial_document"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."validate_flash_question_document"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."validate_flash_question_document"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."word_hashtag_content_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."word_hashtag_content_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."word_hashtag_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."word_hashtag_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."word_hashtag_solution_letters"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."word_hashtag_solution_letters"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "private"."word_search_progress"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."word_search_progress"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."zip_content_valid"(jsonb, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."zip_content_valid"(jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."activate_superadmin_season"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."activate_superadmin_season"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."add_superadmin_room_member"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."add_superadmin_room_member"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."archive_superadmin_question"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."archive_superadmin_question"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_flash_draft"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_flash_draft"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_player"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_player"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_question_draft"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_question_draft"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_room"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_room"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_scheduled_challenge"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_scheduled_challenge"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."create_superadmin_season"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."create_superadmin_season"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_challenge_ranking"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_challenge_ranking"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_flash_history"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_flash_history"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_flash_member_review"(text, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_flash_member_review"(text, uuid, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_alphabet_challenge"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_alphabet_challenge"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_alphabet_result"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_alphabet_result"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_flash_challenge"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_flash_challenge"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_flash_result"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_flash_result"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_pyramid_challenge"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_pyramid_challenge"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_pyramid_result"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_pyramid_result"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_room_cards"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_room_cards"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_survival_challenge"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_survival_challenge"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_my_survival_result"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_my_survival_result"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_room_calendar"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_room_calendar"(text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_room_detail"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_room_detail"(text) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_room_introduction"(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_room_introduction"(text, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_season_ranking"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_season_ranking"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_attempt_inspection"(uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_attempt_inspection"(uuid, uuid, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_attempt_publications"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_attempt_publications"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_calendar_context"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_calendar_context"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_challenge_catalog"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_challenge_catalog"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_challenge_detail"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_challenge_detail"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_dashboard_context"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_dashboard_context"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_editorial_context"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_editorial_context"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_portal_context"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_portal_context"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_question_library"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_question_library"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_question_version"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_question_version"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_room_attempts"(uuid, uuid, timestamp WITH time zone, uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_room_attempts"(uuid, uuid, timestamp WITH time zone, uuid, integer) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_room_calendar_context"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_room_calendar_context"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_superadmin_room_detail"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_superadmin_room_detail"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."lookup_superadmin_players"(text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."lookup_superadmin_players"(text[]) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."manage_room_member"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."manage_room_member"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."provision_player"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."provision_player"() TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."publish_superadmin_flash"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."publish_superadmin_flash"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."publish_superadmin_question"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."publish_superadmin_question"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."update_superadmin_flash_draft"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_superadmin_flash_draft"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."update_superadmin_question_draft"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_superadmin_question_draft"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."update_superadmin_scheduled_challenge"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_superadmin_scheduled_challenge"(jsonb) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."update_superadmin_season"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."update_superadmin_season"(jsonb) TO "authenticated", "postgres";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT CREATE, USAGE ON SCHEMA "private" TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."answer_receipts" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."attempt_answers" TO "postgres";

GRANT SELECT ON TABLE "private"."attempt_answers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."attempt_sessions" TO "postgres";

GRANT SELECT ON TABLE "private"."attempt_sessions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."attempt_timing_units" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."audit_log" TO "postgres";

GRANT SELECT ON TABLE "private"."audit_log" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."challenge_definitions" TO "postgres";

GRANT SELECT ON TABLE "private"."challenge_definitions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."challenge_items" TO "postgres";

GRANT SELECT ON TABLE "private"."challenge_items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."challenge_versions" TO "postgres";

GRANT SELECT ON TABLE "private"."challenge_versions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."command_requests" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."flash_point_entries" TO "postgres";

GRANT SELECT ON TABLE "private"."flash_point_entries" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."interaction_intervals" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."logic_code_attempt_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."matching_pair_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."media_assets" TO "postgres";

GRANT SELECT ON TABLE "private"."media_assets" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."mini_wordle_dictionary_words" TO "postgres";

GRANT SELECT ON TABLE "private"."mini_wordle_dictionary_words" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."mini_wordle_guess_events" TO "postgres";

GRANT SELECT ON TABLE "private"."mini_wordle_guess_events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."platform_role_assignments" TO "postgres";

GRANT SELECT ON TABLE "private"."platform_role_assignments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."progressive_clue_reveal_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."queens_placement_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_definitions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_definitions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_version_solutions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_version_solutions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_versions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_versions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."room_invitations" TO "postgres";

GRANT SELECT ON TABLE "private"."room_invitations" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."word_search_selection_events" TO "postgres";

GRANT SELECT ("completed_at") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("deadline_at") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("id") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("player_id") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("scheduled_challenge_id") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("score") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("started_at") ON TABLE "public"."attempts" TO "authenticated";

GRANT SELECT ("status") ON TABLE "public"."attempts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attempts" TO "postgres";

GRANT SELECT ON TABLE "public"."attempts" TO "service_role";

GRANT SELECT ("avatar_path") ON TABLE "public"."players" TO "authenticated";

GRANT SELECT ("display_name"), UPDATE ("display_name") ON TABLE "public"."players" TO "authenticated";

GRANT SELECT ("id") ON TABLE "public"."players" TO "authenticated";

GRANT SELECT ("status") ON TABLE "public"."players" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."players" TO "postgres";

GRANT SELECT ON TABLE "public"."players" TO "service_role";

GRANT SELECT ON TABLE "public"."room_memberships" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."room_memberships" TO "postgres";

GRANT SELECT ON TABLE "public"."room_memberships" TO "service_role";

GRANT SELECT ON TABLE "public"."rooms" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."rooms" TO "postgres";

GRANT SELECT ON TABLE "public"."rooms" TO "service_role";

GRANT SELECT ON TABLE "public"."scheduled_challenges" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."scheduled_challenges" TO "postgres";

GRANT SELECT ON TABLE "public"."scheduled_challenges" TO "service_role";

GRANT SELECT ON TABLE "public"."seasons" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."seasons" TO "postgres";

GRANT SELECT ON TABLE "public"."seasons" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."effective_results" TO "postgres";

GRANT SELECT ON TABLE "private"."effective_results" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;
