
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "announcement_reactions": {
                  Row: {
                    "announcement_id": string,"club_id": string,"created_at": string,"emoji": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"club_id": string,"created_at"?: string,"emoji": string,"user_id": string
                  }
                  Update: {
                    "announcement_id"?: string,"club_id"?: string,"created_at"?: string,"emoji"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_reactions_club_id_announcement_id_fkey"
      columns: ["club_id","announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "announcement_reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_views": {
                  Row: {
                    "announcement_id": string,"club_id": string,"user_id": string,"viewed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"club_id": string,"user_id": string,"viewed_at"?: string
                  }
                  Update: {
                    "announcement_id"?: string,"club_id"?: string,"user_id"?: string,"viewed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_views_club_id_announcement_id_fkey"
      columns: ["club_id","announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "announcement_views_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "audience": Database["public"]['Enums']["audience_kind"],"author_id": string | null,"body": string,"club_id": string,"created_at": string,"id": string,"image_path": string | null,"pinned_at": string | null,"published_at": string,"shift_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: Database["public"]['Enums']["audience_kind"],"author_id"?: string | null,"body": string,"club_id": string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"pinned_at"?: string | null,"published_at"?: string,"shift_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "audience"?: Database["public"]['Enums']["audience_kind"],"author_id"?: string | null,"body"?: string,"club_id"?: string,"created_at"?: string,"id"?: string,"image_path"?: string | null,"pinned_at"?: string | null,"published_at"?: string,"shift_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_club_id_shift_id_fkey"
      columns: ["club_id","shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["club_id","id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"club_id": string | null,"created_at": string,"entity": string | null,"entity_id": string | null,"id": number,"meta": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"club_id"?: string | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"club_id"?: string | null,"created_at"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: never,"meta"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": string,"custom_domain": string | null,"deleted_at": string | null,"id": string,"invite_code": string,"logo_path": string | null,"name": string,"onboarding_step": number,"plan_code": string,"plan_override": boolean,"plan_status": Database["public"]['Enums']["plan_status"],"primary_color": string,"settings": NonNullable<Json>,"slug": string,"timezone": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"custom_domain"?: string | null,"deleted_at"?: string | null,"id"?: string,"invite_code"?: string,"logo_path"?: string | null,"name": string,"onboarding_step"?: number,"plan_code"?: string,"plan_override"?: boolean,"plan_status"?: Database["public"]['Enums']["plan_status"],"primary_color"?: string,"settings"?: NonNullable<Json>,"slug": string,"timezone"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: string,"custom_domain"?: string | null,"deleted_at"?: string | null,"id"?: string,"invite_code"?: string,"logo_path"?: string | null,"name"?: string,"onboarding_step"?: number,"plan_code"?: string,"plan_override"?: boolean,"plan_status"?: Database["public"]['Enums']["plan_status"],"primary_color"?: string,"settings"?: NonNullable<Json>,"slug"?: string,"timezone"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_plan_code_fkey"
      columns: ["plan_code"]
isOneToOne: false
      referencedRelation: "platform_plans"
      referencedColumns: ["code"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "club_id": string,"id": string,"joined_at": string,"level": Database["public"]['Enums']["runner_level"] | null,"ref_pace_kind": Database["public"]['Enums']["pace_kind"],"ref_pace_s_per_km": number | null,"role": Database["public"]['Enums']["member_role"],"shift_id": string | null,"status": Database["public"]['Enums']["member_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"id"?: string,"joined_at"?: string,"level"?: Database["public"]['Enums']["runner_level"] | null,"ref_pace_kind"?: Database["public"]['Enums']["pace_kind"],"ref_pace_s_per_km"?: number | null,"role"?: Database["public"]['Enums']["member_role"],"shift_id"?: string | null,"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"id"?: string,"joined_at"?: string,"level"?: Database["public"]['Enums']["runner_level"] | null,"ref_pace_kind"?: Database["public"]['Enums']["pace_kind"],"ref_pace_s_per_km"?: number | null,"role"?: Database["public"]['Enums']["member_role"],"shift_id"?: string | null,"status"?: Database["public"]['Enums']["member_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_shift_fk"
      columns: ["club_id","shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"club_id": string,"created_at": string,"data": NonNullable<Json>,"id": string,"kind": string,"push_attempts": number,"push_sent_at": string | null,"push_status": Database["public"]['Enums']["push_status"],"read_at": string | null,"title": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"club_id": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"kind": string,"push_attempts"?: number,"push_sent_at"?: string | null,"push_status"?: Database["public"]['Enums']["push_status"],"read_at"?: string | null,"title": string,"url"?: string | null,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"club_id"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"kind"?: string,"push_attempts"?: number,"push_sent_at"?: string | null,"push_status"?: Database["public"]['Enums']["push_status"],"read_at"?: string | null,"title"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_plans": {
                  Row: {
                    "code": string,"features": (string)[],"max_runners": number | null,"max_staff": number | null,"name": string,"price_usd_cents": number,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"features"?: (string)[],"max_runners"?: number | null,"max_staff"?: number | null,"name": string,"price_usd_cents"?: number,"sort"?: number
                  }
                  Update: {
                    "code"?: string,"features"?: (string)[],"max_runners"?: number | null,"max_staff"?: number | null,"name"?: string,"price_usd_cents"?: number,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profile_private": {
                  Row: {
                    "birth_date": string | null,"emergency_name": string | null,"emergency_phone": string | null,"phone": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"emergency_name"?: string | null,"emergency_phone"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "birth_date"?: string | null,"emergency_name"?: string | null,"emergency_phone"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_private_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"completed_at": string | null,"created_at": string,"full_name": string,"id": string,"is_superadmin": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"completed_at"?: string | null,"created_at"?: string,"full_name"?: string,"id": string,"is_superadmin"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"completed_at"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"is_superadmin"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"club_id": string,"created_at": string,"endpoint": string,"failed_count": number,"id": string,"last_used_at": string | null,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"club_id": string,"created_at"?: string,"endpoint": string,"failed_count"?: number,"id"?: string,"last_used_at"?: string | null,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"club_id"?: string,"created_at"?: string,"endpoint"?: string,"failed_count"?: number,"id"?: string,"last_used_at"?: string | null,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_log": {
                  Row: {
                    "club_id": string,"kind": string,"ref_date": string,"sent_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"kind": string,"ref_date": string,"sent_at"?: string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"kind"?: string,"ref_date"?: string,"sent_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_log_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminder_log_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_completions": {
                  Row: {
                    "club_id": string,"comment": string | null,"completed_at": string,"feeling": number | null,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"comment"?: string | null,"completed_at"?: string,"feeling"?: number | null,"session_id": string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"comment"?: string | null,"completed_at"?: string,"feeling"?: number | null,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_completions_club_id_session_id_fkey"
      columns: ["club_id","session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "session_completions_club_id_user_id_fkey"
      columns: ["club_id","user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["club_id","user_id"]
    },{
      foreignKeyName: "session_completions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"session_templates": {
                  Row: {
                    "blocks": NonNullable<Json>,"club_id": string,"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"title": string,"type": Database["public"]['Enums']["session_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks"?: NonNullable<Json>,"club_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"title": string,"type": Database["public"]['Enums']["session_type"],"updated_at"?: string
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"club_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["session_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_templates_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_templates_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shifts": {
                  Row: {
                    "archived_at": string | null,"club_id": string,"coach_user_id": string | null,"created_at": string,"days": (number)[],"ends_at": string,"id": string,"location": string | null,"name": string,"starts_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"club_id": string,"coach_user_id"?: string | null,"created_at"?: string,"days": (number)[],"ends_at": string,"id"?: string,"location"?: string | null,"name": string,"starts_at": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"club_id"?: string,"coach_user_id"?: string | null,"created_at"?: string,"days"?: (number)[],"ends_at"?: string,"id"?: string,"location"?: string | null,"name"?: string,"starts_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shifts_club_id_coach_user_id_fkey"
      columns: ["club_id","coach_user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["club_id","user_id"]
    },{
      foreignKeyName: "shifts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_invitations": {
                  Row: {
                    "accepted_at": string | null,"club_id": string,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"role": Database["public"]['Enums']["member_role"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"club_id": string,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"club_id"?: string,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_invitations_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"training_session_targets": {
                  Row: {
                    "club_id": string,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"session_id": string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_session_targets_club_id_session_id_fkey"
      columns: ["club_id","session_id"]
isOneToOne: false
      referencedRelation: "training_sessions"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "training_session_targets_club_id_user_id_fkey"
      columns: ["club_id","user_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["club_id","user_id"]
    },{
      foreignKeyName: "training_session_targets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"training_sessions": {
                  Row: {
                    "audience": Database["public"]['Enums']["audience_kind"],"blocks": NonNullable<Json>,"club_id": string,"created_at": string,"created_by": string | null,"date": string,"id": string,"notes": string | null,"published_at": string | null,"shift_id": string | null,"template_id": string | null,"title": string,"type": Database["public"]['Enums']["session_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: Database["public"]['Enums']["audience_kind"],"blocks"?: NonNullable<Json>,"club_id": string,"created_at"?: string,"created_by"?: string | null,"date": string,"id"?: string,"notes"?: string | null,"published_at"?: string | null,"shift_id"?: string | null,"template_id"?: string | null,"title": string,"type": Database["public"]['Enums']["session_type"],"updated_at"?: string
                  }
                  Update: {
                    "audience"?: Database["public"]['Enums']["audience_kind"],"blocks"?: NonNullable<Json>,"club_id"?: string,"created_at"?: string,"created_by"?: string | null,"date"?: string,"id"?: string,"notes"?: string | null,"published_at"?: string | null,"shift_id"?: string | null,"template_id"?: string | null,"title"?: string,"type"?: Database["public"]['Enums']["session_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_sessions_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_sessions_club_id_shift_id_fkey"
      columns: ["club_id","shift_id"]
isOneToOne: false
      referencedRelation: "shifts"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "training_sessions_club_id_template_id_fkey"
      columns: ["club_id","template_id"]
isOneToOne: false
      referencedRelation: "session_templates"
      referencedColumns: ["club_id","id"]
    },{
      foreignKeyName: "training_sessions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_staff_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"admin_clubs_overview":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"effective_plan": string,"id": string,"name": string,"plan_code": string,"plan_override": boolean,"plan_status": Database["public"]['Enums']["plan_status"],"runners": number,"sessions_30d": number,"slug": string,"staff": number,"trial_ends_at": string
            }[]
                           },
"admin_set_club_plan":
{ Args: { "p_club": string,"p_override": boolean,"p_plan": string,"p_status": Database["public"]['Enums']["plan_status"],"p_trial_ends_at"?: string }; Returns: undefined
                           },
"announcement_stats":
{ Args: { "p_ids": (string)[] }; Returns: {
              "announcement_id": string,"my_reactions": (string)[],"reactions": Json,"views": number
            }[]
                           },
"can_view_announcement":
{ Args: { "p_announcement": string }; Returns: boolean
                           },
"can_view_session":
{ Args: { "p_session": string }; Returns: boolean
                           },
"claim_push_batch":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"club_color": string,"club_id": string,"club_name": string,"club_slug": string,"kind": string,"notification_id": string,"title": string,"url": string,"user_id": string
            }[]
                           },
"club_can_add":
{ Args: { "p_club": string,"p_role": Database["public"]['Enums']["member_role"] }; Returns: boolean
                           },
"club_effective_plan":
{ Args: { "p_club": string }; Returns: string
                           },
"club_has_feature":
{ Args: { "p_club": string,"p_feature": string }; Returns: boolean
                           },
"club_id_from_path":
{ Args: { "p_name": string }; Returns: string
                           },
"club_public_by_invite":
{ Args: { "p_code": string }; Returns: {
              "id": string,"logo_path": string,"name": string,"primary_color": string,"slug": string
            }[]
                           },
"club_public_by_slug":
{ Args: { "p_slug": string }; Returns: {
              "id": string,"logo_path": string,"name": string,"primary_color": string,"slug": string
            }[]
                           },
"complete_push":
{ Args: { "p_ids": (string)[],"p_status": Database["public"]['Enums']["push_status"] }; Returns: undefined
                           },
"create_club":
{ Args: { "p_color": string,"p_name": string,"p_slug": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"currency": string,
"custom_domain": string | null,
"deleted_at": string | null,
"id": string,
"invite_code": string,
"logo_path": string | null,
"name": string,
"onboarding_step": number,
"plan_code": string,
"plan_override": boolean,
"plan_status": Database["public"]['Enums']["plan_status"],
"primary_color": string,
"settings": NonNullable<Json>,
"slug": string,
"timezone": string,
"trial_ends_at": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "clubs"
        isOneToOne: true
        isSetofReturn: false
      } },
"duplicate_week":
{ Args: { "p_club": string,"p_from_monday": string,"p_to_monday": string }; Returns: number
                           },
"gen_code":
{ Args: { "p_len"?: number }; Returns: string
                           },
"invoke_app_job":
{ Args: { "p_path": string }; Returns: undefined
                           },
"is_member":
{ Args: { "p_club": string }; Returns: boolean
                           },
"is_owner":
{ Args: { "p_club": string }; Returns: boolean
                           },
"is_privileged":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_reserved_slug":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"is_slug_available":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"is_staff":
{ Args: { "p_club": string }; Returns: boolean
                           },
"is_staff_of_user":
{ Args: { "p_user": string }; Returns: boolean
                           },
"is_superadmin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_club":
{ Args: { "p_code": string }; Returns: string
                           },
"my_club_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_shift":
{ Args: { "p_club": string }; Returns: string
                           },
"my_staff_club_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"my_week":
{ Args: { "p_club": string,"p_monday": string }; Returns: {
              "completed": number,"day": string,"planned": number
            }[]
                           },
"notify_members":
{ Args: { "p_audience": Database["public"]['Enums']["audience_kind"],"p_body": string,"p_club": string,"p_data"?: Json,"p_exclude": string,"p_kind": string,"p_shift": string,"p_targets": (string)[],"p_title": string,"p_url": string }; Returns: number
                           },
"publish_session":
{ Args: { "p_session": string }; Returns: number
                           },
"regenerate_invite_code":
{ Args: { "p_club": string }; Returns: string
                           },
"shares_club":
{ Args: { "p_user": string }; Returns: boolean
                           },
"staff_invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "club_name": string,"club_slug": string,"email": string,"expired": boolean,"primary_color": string
            }[]
                           },
"upsert_push_subscription":
{ Args: { "p_auth": string,"p_club": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "audience_kind": "club"|"shift"|"runners","member_role": "owner"|"coach"|"runner","member_status": "active"|"inactive","pace_kind": "5k"|"threshold","plan_status": "trialing"|"active"|"past_due"|"canceled","push_status": "pending"|"processing"|"sent"|"failed"|"skipped","runner_level": "beginner"|"intermediate"|"advanced","session_type": "easy_run"|"intervals"|"long_run"|"fartlek"|"hills"|"strength"|"rest"
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "audience_kind": ["club", "shift", "runners"],"member_role": ["owner", "coach", "runner"],"member_status": ["active", "inactive"],"pace_kind": ["5k", "threshold"],"plan_status": ["trialing", "active", "past_due", "canceled"],"push_status": ["pending", "processing", "sent", "failed", "skipped"],"runner_level": ["beginner", "intermediate", "advanced"],"session_type": ["easy_run", "intervals", "long_run", "fartlek", "hills", "strength", "rest"]
          }
        }
} as const
