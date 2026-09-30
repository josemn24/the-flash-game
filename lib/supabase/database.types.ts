
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "attempts": {
                  Row: {
                    "attempt_number": number,"challenge_version_id": string,"client_state_schema_version": number,"completed_at": string | null,"created_at": string,"deadline_at": string | null,"id": string,"kind": string,"last_activity_at": string | null,"lock_version": number,"outcome": string | null,"player_id": string,"progress_payload": Json | null,"scheduled_challenge_id": string,"score": number | null,"started_at": string,"status": string,"terminal_reason": string | null,"updated_at": string
                  }
                  Insert: {
                    "attempt_number"?: number,"challenge_version_id": string,"client_state_schema_version": number,"completed_at"?: string | null,"created_at"?: string,"deadline_at"?: string | null,"id"?: string,"kind": string,"last_activity_at"?: string | null,"lock_version"?: number,"outcome"?: string | null,"player_id": string,"progress_payload"?: Json | null,"scheduled_challenge_id": string,"score"?: number | null,"started_at"?: string,"status"?: string,"terminal_reason"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempt_number"?: number,"challenge_version_id"?: string,"client_state_schema_version"?: number,"completed_at"?: string | null,"created_at"?: string,"deadline_at"?: string | null,"id"?: string,"kind"?: string,"last_activity_at"?: string | null,"lock_version"?: number,"outcome"?: string | null,"player_id"?: string,"progress_payload"?: Json | null,"scheduled_challenge_id"?: string,"score"?: number | null,"started_at"?: string,"status"?: string,"terminal_reason"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_scheduled_challenge_id_challenge_version_id_fkey"
      columns: ["scheduled_challenge_id","challenge_version_id"]
isOneToOne: false
      referencedRelation: "scheduled_challenges"
      referencedColumns: ["id","challenge_version_id"]
    }
                  ]
                },"players": {
                  Row: {
                    "anonymized_at": string | null,"auth_user_id": string | null,"avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "anonymized_at"?: string | null,"auth_user_id"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "anonymized_at"?: string | null,"auth_user_id"?: string | null,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"room_memberships": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"joined_at": string,"player_id": string,"role": string,"room_id": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"joined_at"?: string,"player_id": string,"role": string,"room_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"joined_at"?: string,"player_id"?: string,"role"?: string,"room_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_memberships_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_memberships_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"id": string,"slug": string,"status": string,"time_zone": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"slug": string,"status"?: string,"time_zone"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"id"?: string,"slug"?: string,"status"?: string,"time_zone"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"scheduled_challenges": {
                  Row: {
                    "cancelled_at": string | null,"challenge_version_id": string,"closes_at": string,"created_at": string,"id": string,"number": number,"opens_at": string,"results_locked_at": string | null,"season_id": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "cancelled_at"?: string | null,"challenge_version_id": string,"closes_at": string,"created_at"?: string,"id"?: string,"number": number,"opens_at": string,"results_locked_at"?: string | null,"season_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"challenge_version_id"?: string,"closes_at"?: string,"created_at"?: string,"id"?: string,"number"?: number,"opens_at"?: string,"results_locked_at"?: string | null,"season_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scheduled_challenges_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "created_at": string,"ends_at": string,"id": string,"room_id": string,"starts_at": string,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"ends_at": string,"id"?: string,"room_id": string,"starts_at": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"id"?: string,"room_id"?: string,"starts_at"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seasons_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_superadmin_season":
{ Args: { "input": Json }; Returns: Json
                           },
"add_superadmin_room_member":
{ Args: { "input": Json }; Returns: Json
                           },
"archive_superadmin_challenge_version":
{ Args: { "input": Json }; Returns: Json
                           },
"archive_superadmin_question":
{ Args: { "input": Json }; Returns: Json
                           },
"cancel_superadmin_scheduled_challenge":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_challenge_revision":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_flash_draft":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_player":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_question_draft":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_room":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_scheduled_challenge":
{ Args: { "input": Json }; Returns: Json
                           },
"create_superadmin_season":
{ Args: { "input": Json }; Returns: Json
                           },
"get_challenge_ranking":
{ Args: { "target_publication_id": string }; Returns: {
              "avatar_path": string,"display_name": string,"duration_ms": number,"flash_points": number,"player_id": string,"position": number
            }[]
                           },
"get_my_alphabet_challenge":
{ Args: { "target_publication_id": string,"target_room_slug": string }; Returns: {
              "alphabet_letter": string,"challenge_description": string,"challenge_id": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"global_time_limit_ms": number,"item_points": number,"item_position": number,"own_attempt_completed_at": string,"own_attempt_deadline_at": string,"own_attempt_id": string,"own_attempt_lock_version": number,"own_attempt_score": number,"own_attempt_started_at": string,"own_attempt_status": string,"payload_schema_version": number,"publication_closes_at": string,"publication_id": string,"publication_opens_at": string,"publication_status": string,"question_count": number,"question_type": string,"question_version_id": string,"room_id": string,"room_slug": string,"room_title": string,"time_limit_ms": number
            }[]
                           },
"get_my_alphabet_result":
{ Args: { "target_attempt_id": string }; Returns: {
              "alphabet_letter": string,"answer": Json,"answer_status": string,"attempt_completed_at": string,"attempt_id": string,"attempt_lock_version": number,"attempt_score": number,"attempt_started_at": string,"attempt_status": string,"challenge_description": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_subtitle": string,"challenge_title": string,"item_position": number,"payload_schema_version": number,"points": number,"presented_at": string,"public_payload": Json,"question_type": string,"question_version_id": string,"result_details": Json,"scheduled_challenge_id": string,"solution_payload": Json,"submitted_at": string,"time_used_ms": number
            }[]
                           },
"get_my_flash_challenge":
{ Args: { "target_publication_id": string,"target_room_slug": string }; Returns: {
              "challenge_description": string,"challenge_id": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"item_points": number,"item_position": number,"own_attempt_completed_at": string,"own_attempt_deadline_at": string,"own_attempt_id": string,"own_attempt_lock_version": number,"own_attempt_score": number,"own_attempt_started_at": string,"own_attempt_status": string,"payload_schema_version": number,"publication_closes_at": string,"publication_id": string,"publication_opens_at": string,"publication_status": string,"question_count": number,"question_type": string,"question_version_id": string,"room_id": string,"room_slug": string,"room_title": string,"time_limit_ms": number
            }[]
                           },
"get_my_flash_result":
{ Args: { "target_attempt_id": string }; Returns: {
              "answer": Json,"answer_status": string,"attempt_completed_at": string,"attempt_id": string,"attempt_lock_version": number,"attempt_score": number,"attempt_started_at": string,"attempt_status": string,"challenge_description": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_subtitle": string,"challenge_title": string,"item_position": number,"payload_schema_version": number,"points": number,"presented_at": string,"public_payload": Json,"question_type": string,"question_version_id": string,"result_details": Json,"scheduled_challenge_id": string,"solution_payload": Json,"submitted_at": string,"time_used_ms": number
            }[]
                           },
"get_my_pyramid_challenge":
{ Args: { "target_publication_id": string,"target_room_slug": string }; Returns: {
              "briefing_description": string,"briefing_format": string,"briefing_title": string,"challenge_description": string,"challenge_id": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"challenge_version_number": number,"item_points": number,"item_position": number,"level_id": string,"level_label": string,"own_attempt_completed_at": string,"own_attempt_deadline_at": string,"own_attempt_id": string,"own_attempt_lock_version": number,"own_attempt_score": number,"own_attempt_started_at": string,"own_attempt_status": string,"payload_schema_version": number,"publication_closes_at": string,"publication_id": string,"publication_opens_at": string,"publication_status": string,"question_count": number,"question_type": string,"question_version_id": string,"room_id": string,"room_slug": string,"room_title": string,"time_limit_ms": number
            }[]
                           },
"get_my_pyramid_result":
{ Args: { "target_attempt_id": string }; Returns: {
              "answer": Json,"answer_status": string,"attempt_completed_at": string,"attempt_id": string,"attempt_lock_version": number,"attempt_outcome": string,"attempt_score": number,"attempt_started_at": string,"attempt_status": string,"challenge_description": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_subtitle": string,"challenge_title": string,"item_position": number,"payload_schema_version": number,"points": number,"presented_at": string,"public_payload": Json,"question_type": string,"question_version_id": string,"result_details": Json,"scheduled_challenge_id": string,"solution_payload": Json,"submitted_at": string,"time_used_ms": number
            }[]
                           },
"get_my_room_cards":
{ Args: Record<PropertyKey, never>; Returns: {
              "challenge_max_score": number,"challenge_mode": string,"challenge_subtitle": string,"challenge_title": string,"closes_at": string,"competitive_playable": boolean,"current_flash_points": number,"current_position": number,"member_count": number,"member_previews": Json,"membership_role": string,"opens_at": string,"publication_id": string,"publication_status": string,"question_count": number,"room_description": string,"room_id": string,"room_slug": string,"room_title": string,"season_ends_at": string,"season_id": string,"season_starts_at": string,"season_status": string,"season_title": string
            }[]
                           },
"get_my_survival_challenge":
{ Args: { "target_publication_id": string,"target_room_slug": string }; Returns: {
              "challenge_description": string,"challenge_id": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"initial_lives": number,"item_points": number,"item_position": number,"own_attempt_completed_at": string,"own_attempt_deadline_at": string,"own_attempt_id": string,"own_attempt_lock_version": number,"own_attempt_score": number,"own_attempt_started_at": string,"own_attempt_status": string,"payload_schema_version": number,"publication_closes_at": string,"publication_id": string,"publication_opens_at": string,"publication_status": string,"question_count": number,"question_type": string,"question_version_id": string,"room_id": string,"room_slug": string,"room_title": string,"time_limit_ms": number
            }[]
                           },
"get_my_survival_result":
{ Args: { "target_attempt_id": string }; Returns: {
              "answer": Json,"answer_status": string,"attempt_completed_at": string,"attempt_id": string,"attempt_lock_version": number,"attempt_outcome": string,"attempt_score": number,"attempt_started_at": string,"attempt_status": string,"challenge_description": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_subtitle": string,"challenge_title": string,"item_position": number,"payload_schema_version": number,"points": number,"presented_at": string,"public_payload": Json,"question_type": string,"question_version_id": string,"result_details": Json,"scheduled_challenge_id": string,"solution_payload": Json,"submitted_at": string,"time_used_ms": number
            }[]
                           },
"get_room_calendar":
{ Args: { "target_room_slug": string }; Returns: {
              "availability_status": string,"can_continue": boolean,"can_start": boolean,"challenge_mode": string,"challenge_subtitle": string,"challenge_title": string,"closes_at": string,"membership_role": string,"opens_at": string,"own_attempt_status": string,"publication_id": string,"publication_number": number,"publication_status": string,"question_count": number,"room_id": string,"room_slug": string,"room_title": string,"season_id": string,"season_status": string,"season_title": string,"time_zone": string
            }[]
                           },
"get_room_detail":
{ Args: { "target_room_slug": string }; Returns: {
              "challenge_max_score": number,"challenge_mode": string,"challenge_subtitle": string,"challenge_title": string,"closes_at": string,"competitive_playable": boolean,"current_flash_points": number,"current_position": number,"member_count": number,"member_previews": Json,"membership_role": string,"opens_at": string,"publication_id": string,"publication_status": string,"question_count": number,"room_description": string,"room_id": string,"room_slug": string,"room_title": string,"season_ends_at": string,"season_id": string,"season_starts_at": string,"season_status": string,"season_title": string
            }[]
                           },
"get_room_history":
{ Args: { "target_publication_id"?: string,"target_room_slug": string }; Returns: {
              "avatar_path": string,"challenge_description": string,"challenge_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"display_name": string,"duration_ms": number,"flash_points": number,"played_at": string,"player_count": number,"player_id": string,"position": number,"publication_closes_at": string,"publication_id": string,"publication_number": number,"publication_opens_at": string,"publication_status": string,"question_count": number,"room_id": string,"room_slug": string,"room_title": string,"season_id": string,"season_title": string,"started_at": string,"viewer_role": string
            }[]
                           },
"get_room_introduction":
{ Args: { "target_publication_id": string,"target_room_slug": string }; Returns: {
              "availability_status": string,"can_start": boolean,"challenge_max_score": number,"challenge_mode": string,"challenge_subtitle": string,"challenge_title": string,"closes_at": string,"competitive_playable": boolean,"membership_role": string,"opens_at": string,"publication_id": string,"publication_status": string,"question_count": number,"room_id": string,"room_slug": string,"room_title": string
            }[]
                           },
"get_room_member_review":
{ Args: { "target_player_id": string,"target_publication_id": string,"target_room_slug": string }; Returns: {
              "answer": Json,"answer_status": string,"attempt_completed_at": string,"attempt_duration_ms": number,"attempt_id": string,"attempt_lock_version": number,"attempt_outcome": string,"attempt_score": number,"attempt_started_at": string,"attempt_status": string,"avatar_path": string,"briefing_description": string,"briefing_format": string,"briefing_title": string,"challenge_description": string,"challenge_id": string,"challenge_item_id": string,"challenge_max_score": number,"challenge_mode": string,"challenge_slug": string,"challenge_subtitle": string,"challenge_title": string,"challenge_version_id": string,"display_name": string,"has_persisted_answer": boolean,"initial_lives": number,"item_points": number,"item_position": number,"level_id": string,"level_label": string,"payload_schema_version": number,"player_id": string,"points": number,"presented_at": string,"public_payload": Json,"publication_closes_at": string,"publication_id": string,"publication_status": string,"question_count": number,"question_type": string,"question_version_id": string,"result_details": Json,"room_id": string,"room_slug": string,"room_title": string,"season_id": string,"season_title": string,"solution_payload": Json,"submitted_at": string,"time_limit_ms": number,"time_used_ms": number,"viewer_role": string
            }[]
                           },
"get_season_ranking":
{ Args: { "target_season_id": string }; Returns: {
              "avatar_path": string,"display_name": string,"flash_points": number,"is_former_member": boolean,"player_id": string,"position": number
            }[]
                           },
"get_superadmin_attempt_inspection":
{ Args: { "target_attempt_id": string,"target_room_id": string,"target_scheduled_challenge_id": string }; Returns: Json
                           },
"get_superadmin_attempt_publications":
{ Args: { "target_room_id": string }; Returns: Json
                           },
"get_superadmin_calendar_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_superadmin_challenge_catalog":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_superadmin_challenge_detail":
{ Args: { "target_challenge_definition_id": string }; Returns: Json
                           },
"get_superadmin_challenge_version_comparison":
{ Args: { "from_challenge_version_id": string,"to_challenge_version_id": string }; Returns: Json
                           },
"get_superadmin_dashboard_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_superadmin_editorial_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_superadmin_portal_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_superadmin_question_library":
{ Args: { "input"?: Json }; Returns: Json
                           },
"get_superadmin_question_version":
{ Args: { "question_version_id": string }; Returns: Json
                           },
"get_superadmin_room_attempts":
{ Args: { "cursor_attempt_id": string,"cursor_started_at": string,"page_size": number,"target_room_id": string,"target_scheduled_challenge_id": string }; Returns: Json
                           },
"get_superadmin_room_calendar_context":
{ Args: { "target_room_id": string }; Returns: Json
                           },
"get_superadmin_room_detail":
{ Args: { "target_room_id": string }; Returns: Json
                           },
"lookup_superadmin_players":
{ Args: { "target_emails": (string)[] }; Returns: {
              "display_name": string,"email": string,"player_id": string
            }[]
                           },
"manage_room_member":
{ Args: { "input": Json }; Returns: Json
                           },
"provision_player":
{ Args: Record<PropertyKey, never>; Returns: {
              "avatar_path": string,"display_name": string,"player_id": string,"status": string
            }[]
                           },
"publish_superadmin_flash":
{ Args: { "input": Json }; Returns: Json
                           },
"publish_superadmin_question":
{ Args: { "input": Json }; Returns: Json
                           },
"update_superadmin_flash_draft":
{ Args: { "input": Json }; Returns: Json
                           },
"update_superadmin_question_draft":
{ Args: { "input": Json }; Returns: Json
                           },
"update_superadmin_scheduled_challenge":
{ Args: { "input": Json }; Returns: Json
                           },
"update_superadmin_season":
{ Args: { "input": Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

