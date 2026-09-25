SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

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
  CONSTRAINT "interaction_intervals_end_reason_check" CHECK ((end_reason = ANY (ARRAY['answer'::text, 'pass'::text, 'timeout'::text, 'abandon'::text]))),
  CONSTRAINT "interaction_intervals_pkey" PRIMARY KEY (id)
);

ALTER TABLE "private"."interaction_intervals"
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

CREATE OR REPLACE FUNCTION private.adjust_result (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('adjust', input)
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
  instant timestamptz;
  key text := input->>'idempotencyKey';
  safe_input jsonb := input;
  cached private.command_requests%rowtype;
  a public.attempts%rowtype;
  cv private.challenge_versions%rowtype;
  sc public.scheduled_challenges%rowtype;
  member public.room_memberships%rowtype;
  invitation private.room_invitations%rowtype;
  unit private.attempt_timing_units%rowtype;
  segment private.interaction_intervals%rowtype;
  receipt private.answer_receipts%rowtype;
  session_row private.attempt_sessions%rowtype;
  item private.challenge_items%rowtype;
  result jsonb;
  previous jsonb;
  allowed text[];
  required text[];
  target uuid;
  expected bigint;
  points integer;
  balance integer;
  presented timestamptz;
  effective timestamptz;
  used_ms bigint;
  late boolean;
  resumed boolean := false;
  control_required boolean := false;
  is_admin boolean;
  target_status text;
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
  perform pg_advisory_xact_lock(hashtextextended('flash-command:' || actor || ':' || key, 0));
  select * into cached from private.command_requests where actor_id = actor and idempotency_key = key;
  if found and (cached.operation <> op or cached.input <> safe_input) then
    raise exception 'idempotency_conflict' using errcode = '40001';
  end if;
  is_admin := exists (select 1 from private.platform_role_assignments where player_id = actor);
  if op in ('invalidate','adjust') and not is_admin then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if op = 'accept_invitation' then
    -- Room before invitation/membership is the shared lock order for membership writers.
    select room_id into target from private.room_invitations where token_hash = safe_input->>'invitationToken';
    perform 1 from public.rooms where id = target and status = 'active' for update;
    if not found then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    select * into invitation from private.room_invitations where token_hash = safe_input->>'invitationToken' for update;
    select * into member from public.room_memberships where room_id = target and player_id = actor for update;
    if member.status = 'banned' then raise exception 'invitation_unavailable' using errcode = '42501'; end if;
    if cached.result is not null then return cached.result; end if;
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
  elsif op = 'start' then
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
    if cached.result is not null then return cached.result; end if;
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
          op in ('complete','abandon') and cached.result is not null and a.status in ('completed','abandoned')
        )) then raise exception 'session_revoked' using errcode = '42501'; end if;
        -- The global game deadline stops new gameplay, not authenticated timeout/evaluation cleanup.
      end if;
    end if;
    if cached.result is not null then return cached.result; end if;
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
        select jsonb_build_object('challengeItemId', item.id, 'questionType', q.type,
          'payloadSchemaVersion', q.payload_schema_version,
          'publicPayload', case when instant < unit.deadline_at then q.public_payload else null end,
          'presentedAt', segment.started_at, 'deadlineAt', unit.deadline_at, 'timedOut', instant >= unit.deadline_at)
          into result from private.question_versions q where q.id = item.question_version_id;
      when 'receive', 'pass' then
        select * into segment from private.interaction_intervals where attempt_id = a.id and ended_at is null;
        if not found or segment.challenge_item_id <> (input->>'challengeItemId')::uuid then
          raise exception 'interaction_not_presented' using errcode = '55000';
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
          values(a.id, segment.challenge_item_id, a.challenge_version_id, input->'answer', received, presented,
            effective, used_ms, late, (input->>'clientTimeUsedMs')::bigint) returning * into receipt;
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
          input->>'status', receipt.answer, input->'resultDetails', (input->>'points')::integer,
          receipt.presented_at, receipt.effective_submitted_at, receipt.time_used_ms, key);
        result := jsonb_build_object('receiptId', receipt.id, 'status', input->>'status', 'points', (input->>'points')::integer);
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
          if cv.mode in ('flash','alphabet','narrative') and private.next_attempt_item(a.id) is not null then
            raise exception 'incomplete_challenge' using errcode = '55000';
          end if;
          -- Mode evaluator decides early termination in survival/pyramid and normalized final score.
          points := (input->>'score')::integer;
          target_status := 'completed';
        else
          target_status := 'abandoned'; points := null;
          update private.interaction_intervals x set ended_at = greatest(x.started_at, least(instant, u.deadline_at)), end_reason = 'abandon'
            from private.attempt_timing_units u where x.attempt_id = a.id and x.ended_at is null and u.id = x.timing_unit_id;
        end if;
        update public.attempts set status = target_status, score = points, completed_at = instant,
          outcome = input->>'outcome', progress_payload = null, lock_version = lock_version + 1 where id = a.id returning * into a;
        update private.attempt_sessions set revoked_at = instant where attempt_id = a.id and revoked_at is null;
        if op = 'complete' then
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type, amount, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'accreditation', points, 'complete:' || a.id);
        end if;
        result := jsonb_build_object('status', a.status, 'score', a.score);
      when 'invalidate', 'adjust' then
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
          points := (input->>'score')::integer;
          if points not between 0 and 100 then raise exception 'invalid_score' using errcode = '22023'; end if;
          insert into private.flash_point_entries(season_id, player_id, scheduled_challenge_id, attempt_id, entry_type,
            amount, reason, created_by_player_id, idempotency_key)
          values(sc.season_id, a.player_id, sc.id, a.id, 'adjustment', points - balance, input->>'reason', actor, 'adjust:' || actor || ':' || key);
          update public.attempts set lock_version = lock_version + 1 where id = a.id returning * into a;
          -- Corrections preserve the immutable original score/status.
          result := jsonb_build_object('status', a.status, 'effectiveScore', points);
        end if;
    end case;
    if op not in ('complete','abandon','invalidate','adjust') then
      update public.attempts set lock_version = lock_version + 1, last_activity_at = instant
        where id = a.id returning * into a;
    end if;
    result := result || jsonb_build_object('attemptId', a.id, 'lockVersion', a.lock_version);
  end if;
  insert into private.audit_log(actor_player_id, action, entity_type, entity_id, reason, request_id, before_payload, after_payload)
  values(actor, op, case when op = 'accept_invitation' then 'invitation' else 'attempt' end,
    target, input->>'reason', key, previous,
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
        where sc.id = new.scheduled_challenge_id and sc.status = 'open'
          and s.status = 'active' and r.status = 'active'
          and s.starts_at <= new.started_at and new.started_at < s.ends_at
          and sc.opens_at <= new.started_at and new.started_at < sc.closes_at
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

CREATE OR REPLACE FUNCTION private.prepare_interaction (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('prepare', input)
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
    'receiptId', r.id, 'answer', r.answer, 'receivedAt', r.received_at,
    'timeUsedMs', r.time_used_ms, 'timedOut', r.timed_out,
    'questionType', q.type, 'payloadSchemaVersion', q.payload_schema_version,
    'publicPayload', q.public_payload,
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

CREATE OR REPLACE FUNCTION private.take_over_attempt (
  input jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select private.execute_command('takeover', input)
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

ALTER TABLE "private"."challenge_items"
  ADD CONSTRAINT "challenge_items_question_version_id_fkey" FOREIGN KEY (question_version_id) REFERENCES private.question_versions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_version_solutions"
  ADD CONSTRAINT "question_version_solutions_question_version_id_fkey" FOREIGN KEY (question_version_id) REFERENCES private.question_versions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."question_versions"
  ADD CONSTRAINT "question_versions_question_definition_id_fkey" FOREIGN KEY (question_definition_id) REFERENCES private.question_definitions(id) ON DELETE RESTRICT;

ALTER TABLE "private"."answer_receipts"
  ADD CONSTRAINT "answer_receipts_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id);

ALTER TABLE "private"."attempt_answers"
  ADD CONSTRAINT "attempt_answers_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id)
    ON DELETE RESTRICT;

ALTER TABLE "private"."attempt_timing_units"
  ADD CONSTRAINT "attempt_timing_units_attempt_id_challenge_version_id_fkey" FOREIGN KEY (attempt_id, challenge_version_id) REFERENCES public.attempts(id, challenge_version_id);

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

CREATE INDEX question_definitions_author_idx ON private.question_definitions USING btree (created_by_player_id);

CREATE INDEX question_versions_author_idx ON private.question_versions USING btree (created_by_player_id);

CREATE INDEX receipts_item_idx ON private.answer_receipts USING btree (challenge_item_id, challenge_version_id);

CREATE INDEX sessions_attempt_idx ON private.attempt_sessions USING btree (attempt_id);

CREATE UNIQUE INDEX sessions_one_unrevoked_idx ON private.attempt_sessions USING btree (attempt_id)
  WHERE (revoked_at IS NULL);

CREATE INDEX timing_item_version_idx ON private.attempt_timing_units USING btree (challenge_item_id, challenge_version_id);

CREATE UNIQUE INDEX attempts_one_competitive_idx ON public.attempts USING btree (player_id, scheduled_challenge_id)
  WHERE (kind = 'competitive'::text);

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

COMMENT ON EXTENSION "btree_gist" IS 'support for indexing common datatypes in GiST';

REVOKE ALL ON FUNCTION "private"."abandon_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."abandon_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."accept_invitation"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."accept_invitation"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."adjust_result"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."adjust_result"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."can_read_own_attempt"(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_own_attempt"(uuid, uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."can_read_profile"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_profile"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."command_actor"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."command_actor"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."complete_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."complete_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."current_player_id"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."current_player_id"() TO "authenticated", "postgres";

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

REVOKE ALL ON FUNCTION "private"."invalidate_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."invalidate_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."is_room_member"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."is_room_member"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "private"."lock_membership_room"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."lock_membership_room"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."next_attempt_item"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."next_attempt_item"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "private"."pass_interaction"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."pass_interaction"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."prepare_interaction"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."prepare_interaction"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."read_evaluation_context"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."read_evaluation_context"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."receive_answer"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."receive_answer"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."record_evaluation"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."record_evaluation"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."reject_rewrite"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."reject_rewrite"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."require_room_owner"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."require_room_owner"() TO "postgres";

REVOKE ALL ON FUNCTION "private"."secret_hash"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."secret_hash"(text) TO "postgres";

REVOKE ALL ON FUNCTION "private"."start_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."start_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."take_over_attempt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."take_over_attempt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "private"."touch_updated_at"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."touch_updated_at"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_challenge_ranking"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_challenge_ranking"(uuid) TO "authenticated", "postgres";

REVOKE ALL ON FUNCTION "public"."get_season_ranking"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."get_season_ranking"(uuid) TO "authenticated", "postgres";

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

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."platform_role_assignments" TO "postgres";

GRANT SELECT ON TABLE "private"."platform_role_assignments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_definitions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_definitions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_version_solutions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_version_solutions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."question_versions" TO "postgres";

GRANT SELECT ON TABLE "private"."question_versions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "private"."room_invitations" TO "postgres";

GRANT SELECT ON TABLE "private"."room_invitations" TO "service_role";

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
