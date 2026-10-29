export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      articles: {
        Row: {
          body: string;
          category: string;
          cover_url: string | null;
          created_at: string;
          excerpt: string;
          id: string;
          level: Database["public"]["Enums"]["workout_level"] | null;
          members_only: boolean;
          published_at: string | null;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          category?: string;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string;
          id?: string;
          level?: Database["public"]["Enums"]["workout_level"] | null;
          members_only?: boolean;
          published_at?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          category?: string;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string;
          id?: string;
          level?: Database["public"]["Enums"]["workout_level"] | null;
          members_only?: boolean;
          published_at?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          diff: Json | null;
          id: number;
          target_id: string | null;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          target_id?: string | null;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          diff?: Json | null;
          id?: never;
          target_id?: string | null;
          target_type?: string;
        };
        Relationships: [];
      };
      challenge_days: {
        Row: {
          challenge_id: string;
          day: number;
          task: string;
          workout_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          day: number;
          task: string;
          workout_id?: string | null;
        };
        Update: {
          challenge_id?: string;
          day?: number;
          task?: string;
          workout_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_days_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_days_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_participants: {
        Row: {
          challenge_id: string;
          created_at: string;
          joined_on: string;
          show_on_board: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          created_at?: string;
          joined_on: string;
          show_on_board?: boolean;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          created_at?: string;
          joined_on?: string;
          show_on_board?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_ticks: {
        Row: {
          challenge_id: string;
          day: number;
          ticked_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          day: number;
          ticked_at?: string;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          day?: number;
          ticked_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_ticks_challenge_id_user_id_fkey";
            columns: ["challenge_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "challenge_participants";
            referencedColumns: ["challenge_id", "user_id"];
          },
        ];
      };
      challenges: {
        Row: {
          created_at: string;
          days: number;
          description: string;
          id: string;
          published: boolean;
          start_date: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          days: number;
          description?: string;
          id?: string;
          published?: boolean;
          start_date: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          days?: number;
          description?: string;
          id?: string;
          published?: boolean;
          start_date?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      check_ins: {
        Row: {
          created_at: string;
          energy: number | null;
          hips_cm: number | null;
          id: string;
          mood: number | null;
          note: string | null;
          user_id: string;
          waist_cm: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          energy?: number | null;
          hips_cm?: number | null;
          id?: string;
          mood?: number | null;
          note?: string | null;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          created_at?: string;
          energy?: number | null;
          hips_cm?: number | null;
          id?: string;
          mood?: number | null;
          note?: string | null;
          user_id?: string;
          waist_cm?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "check_ins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_notes: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["note_kind"];
          snooze_until: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["note_kind"];
          snooze_until?: string | null;
          user_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["note_kind"];
          snooze_until?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_comments: {
        Row: {
          body: string;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          id: string;
          post_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_comments_hidden_by_fkey";
            columns: ["hidden_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_hearts: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_hearts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_hearts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_posts: {
        Row: {
          body: string;
          completion_id: string | null;
          created_at: string;
          hidden_at: string | null;
          hidden_by: string | null;
          id: string;
          photo_path: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          completion_id?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          photo_path?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          completion_id?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          hidden_by?: string | null;
          id?: string;
          photo_path?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_posts_completion_id_fkey";
            columns: ["completion_id"];
            isOneToOne: false;
            referencedRelation: "workout_completions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_posts_hidden_by_fkey";
            columns: ["hidden_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_reports: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          post_id: string | null;
          reason: string;
          resolved_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reason: string;
          resolved_at?: string | null;
          user_id: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          post_id?: string | null;
          reason?: string;
          resolved_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "community_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "community_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      food_entries: {
        Row: {
          batch_id: string;
          carbs_g: number;
          created_at: string;
          eaten_on: string;
          fat_g: number;
          grams: number | null;
          id: string;
          kcal: number;
          meal: Database["public"]["Enums"]["meal_slot"];
          name: string;
          position: number;
          protein_g: number;
          source: Database["public"]["Enums"]["food_source"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          carbs_g: number;
          created_at?: string;
          eaten_on: string;
          fat_g: number;
          grams?: number | null;
          id?: string;
          kcal: number;
          meal: Database["public"]["Enums"]["meal_slot"];
          name: string;
          position: number;
          protein_g: number;
          source: Database["public"]["Enums"]["food_source"];
          user_id: string;
        };
        Update: {
          batch_id?: string;
          carbs_g?: number;
          created_at?: string;
          eaten_on?: string;
          fat_g?: number;
          grams?: number | null;
          id?: string;
          kcal?: number;
          meal?: Database["public"]["Enums"]["meal_slot"];
          name?: string;
          position?: number;
          protein_g?: number;
          source?: Database["public"]["Enums"]["food_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_vouchers: {
        Row: {
          amount_cents: number;
          buyer_email: string | null;
          code: string;
          created_at: string;
          currency: string;
          expires_at: string;
          id: string;
          issued_by: string | null;
          kind: string;
          message: string | null;
          months: number;
          note: string | null;
          recipient_name: string | null;
          redeemed_at: string | null;
          redeemed_by: string | null;
          stripe_session_id: string | null;
          voided_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_cents?: number;
          buyer_email?: string | null;
          code: string;
          created_at?: string;
          currency?: string;
          expires_at?: string;
          id?: string;
          issued_by?: string | null;
          kind: string;
          message?: string | null;
          months: number;
          note?: string | null;
          recipient_name?: string | null;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          stripe_session_id?: string | null;
          voided_at?: string | null;
        };
        Update: {
          amount_cents?: number;
          buyer_email?: string | null;
          code?: string;
          created_at?: string;
          currency?: string;
          expires_at?: string;
          id?: string;
          issued_by?: string | null;
          kind?: string;
          message?: string | null;
          months?: number;
          note?: string | null;
          recipient_name?: string | null;
          redeemed_at?: string | null;
          redeemed_by?: string | null;
          stripe_session_id?: string | null;
          voided_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gift_vouchers_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gift_vouchers_redeemed_by_fkey";
            columns: ["redeemed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          ip_hash: string | null;
          marketing_consent_at: string | null;
          name: string;
          source: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          ip_hash?: string | null;
          marketing_consent_at?: string | null;
          name: string;
          source: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          ip_hash?: string | null;
          marketing_consent_at?: string | null;
          name?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      live_attendance: {
        Row: {
          joined_at: string;
          session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          joined_at?: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_attendance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "live_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_attendance_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      live_sessions: {
        Row: {
          created_at: string;
          description: string;
          duration_min: number;
          id: string;
          join_url: string;
          published: boolean;
          recording_url: string | null;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string;
          duration_min?: number;
          id?: string;
          join_url: string;
          published?: boolean;
          recording_url?: string | null;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          duration_min?: number;
          id?: string;
          join_url?: string;
          published?: boolean;
          recording_url?: string | null;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meal_draft_calls: {
        Row: {
          admin_id: string;
          called_at: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          admin_id: string;
          called_at?: string;
          id?: never;
        };
        Update: {
          admin_id?: string;
          called_at?: string;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "meal_draft_calls_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      meals: {
        Row: {
          allergens: string[];
          carbs_g: number;
          cook_min: number | null;
          created_at: string;
          description: string;
          fat_g: number;
          fits_pescatarian: boolean;
          fits_vegan: boolean;
          fits_vegetarian: boolean;
          id: string;
          ingredients: NonNullable<Json>;
          kcal: number;
          meal_types: Database["public"]["Enums"]["meal_slot"][];
          photo_url: string | null;
          prep_min: number | null;
          protein_g: number;
          published: boolean;
          servings: number;
          steps: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allergens?: string[];
          carbs_g: number;
          cook_min?: number | null;
          created_at?: string;
          description?: string;
          fat_g: number;
          fits_pescatarian?: boolean;
          fits_vegan?: boolean;
          fits_vegetarian?: boolean;
          id?: string;
          ingredients: NonNullable<Json>;
          kcal: number;
          meal_types: Database["public"]["Enums"]["meal_slot"][];
          photo_url?: string | null;
          prep_min?: number | null;
          protein_g: number;
          published?: boolean;
          servings?: number;
          steps?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          allergens?: string[];
          carbs_g?: number;
          cook_min?: number | null;
          created_at?: string;
          description?: string;
          fat_g?: number;
          fits_pescatarian?: boolean;
          fits_vegan?: boolean;
          fits_vegetarian?: boolean;
          id?: string;
          ingredients?: NonNullable<Json>;
          kcal?: number;
          meal_types?: Database["public"]["Enums"]["meal_slot"][];
          photo_url?: string | null;
          prep_min?: number | null;
          protein_g?: number;
          published?: boolean;
          servings?: number;
          steps?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_swaps: {
        Row: {
          created_at: string;
          meal_id: string;
          menu_date: string;
          slot: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          meal_id: string;
          menu_date: string;
          slot: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          meal_id?: string;
          menu_date?: string;
          slot?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_swaps_meal_id_fkey";
            columns: ["meal_id"];
            isOneToOne: false;
            referencedRelation: "meals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_swaps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      nutrition_ai_calls: {
        Row: {
          called_at: string;
          id: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          called_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          called_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nutrition_ai_calls_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          error: string | null;
          event_id: string;
          id: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          received_at: string;
          type: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          error?: string | null;
          event_id: string;
          id?: string;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          received_at?: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          error?: string | null;
          event_id?: string;
          id?: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          received_at?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          active: boolean;
          currency: string;
          id: string;
          interval: Database["public"]["Enums"]["plan_interval"];
          name: string;
          price_cents: number;
          provider_price_ids: NonNullable<Json>;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          currency?: string;
          id?: string;
          interval: Database["public"]["Enums"]["plan_interval"];
          name: string;
          price_cents: number;
          provider_price_ids?: NonNullable<Json>;
          sort?: number;
        };
        Update: {
          active?: boolean;
          currency?: string;
          id?: string;
          interval?: Database["public"]["Enums"]["plan_interval"];
          name?: string;
          price_cents?: number;
          provider_price_ids?: NonNullable<Json>;
          sort?: number;
        };
        Relationships: [];
      };
      points_ledger: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          points: number;
          reason: string | null;
          ref: string;
          source: Database["public"]["Enums"]["points_source"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          points: number;
          reason?: string | null;
          ref: string;
          source: Database["public"]["Enums"]["points_source"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          points?: number;
          reason?: string | null;
          ref?: string;
          source?: Database["public"]["Enums"]["points_source"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null;
          allergens: string[];
          avoid_foods: string | null;
          birth_year: number | null;
          diet: Database["public"]["Enums"]["diet_type"] | null;
          email: string;
          fbclid: string | null;
          first_utm: Json | null;
          gclid: string | null;
          goal: string | null;
          health_data_consent_at: string | null;
          height_cm: number | null;
          id: string;
          joined_at: string;
          last_seen_at: string | null;
          level: Database["public"]["Enums"]["workout_level"];
          marketing_consent: boolean;
          meals_per_day: number | null;
          name: string;
          nutrition_answered_at: string | null;
          onboarding_done: boolean;
          phone: string | null;
          phone_call_consent: boolean;
          problems: string[];
          push_hour: number | null;
          push_reminded_on: string | null;
          role: Database["public"]["Enums"]["user_role"];
          starter_week_done_at: string | null;
          studio_client: boolean;
          target_weight_kg: number | null;
          time_per_session: string | null;
          timezone: string;
          updated_at: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          allergens?: string[];
          avoid_foods?: string | null;
          birth_year?: number | null;
          diet?: Database["public"]["Enums"]["diet_type"] | null;
          email: string;
          fbclid?: string | null;
          first_utm?: Json | null;
          gclid?: string | null;
          goal?: string | null;
          health_data_consent_at?: string | null;
          height_cm?: number | null;
          id: string;
          joined_at?: string;
          last_seen_at?: string | null;
          level?: Database["public"]["Enums"]["workout_level"];
          marketing_consent?: boolean;
          meals_per_day?: number | null;
          name?: string;
          nutrition_answered_at?: string | null;
          onboarding_done?: boolean;
          phone?: string | null;
          phone_call_consent?: boolean;
          problems?: string[];
          push_hour?: number | null;
          push_reminded_on?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          starter_week_done_at?: string | null;
          studio_client?: boolean;
          target_weight_kg?: number | null;
          time_per_session?: string | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null;
          allergens?: string[];
          avoid_foods?: string | null;
          birth_year?: number | null;
          diet?: Database["public"]["Enums"]["diet_type"] | null;
          email?: string;
          fbclid?: string | null;
          first_utm?: Json | null;
          gclid?: string | null;
          goal?: string | null;
          health_data_consent_at?: string | null;
          height_cm?: number | null;
          id?: string;
          joined_at?: string;
          last_seen_at?: string | null;
          level?: Database["public"]["Enums"]["workout_level"];
          marketing_consent?: boolean;
          meals_per_day?: number | null;
          name?: string;
          nutrition_answered_at?: string | null;
          onboarding_done?: boolean;
          phone?: string | null;
          phone_call_consent?: boolean;
          problems?: string[];
          push_hour?: number | null;
          push_reminded_on?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          starter_week_done_at?: string | null;
          studio_client?: boolean;
          target_weight_kg?: number | null;
          time_per_session?: string | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      progress_photos: {
        Row: {
          created_at: string;
          id: string;
          path: string;
          taken_on: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          path: string;
          taken_on: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          path?: string;
          taken_on?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "progress_photos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      push_sends: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          recipients: number;
          title: string;
          url: string | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          recipients?: number;
          title: string;
          url?: string | null;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          recipients?: number;
          title?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_sends_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rewards_given: {
        Row: {
          given_at: string;
          given_by: string | null;
          level: number;
          note: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          given_at?: string;
          given_by?: string | null;
          level: number;
          note?: string | null;
          user_id: string;
        };
        Update: {
          given_at?: string;
          given_by?: string | null;
          level?: number;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rewards_given_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      security_flags: {
        Row: {
          enabled: boolean;
          key: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          enabled: boolean;
          key: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      studio_bookings: {
        Row: {
          cancelled_at: string | null;
          cancelled_by: string | null;
          card_id: string | null;
          created_at: string;
          id: string;
          over_limit: boolean;
          session_id: string;
          source: string;
          status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          card_id?: string | null;
          created_at?: string;
          id?: string;
          over_limit?: boolean;
          session_id: string;
          source: string;
          status?: string;
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          card_id?: string | null;
          created_at?: string;
          id?: string;
          over_limit?: boolean;
          session_id?: string;
          source?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_bookings_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_bookings_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "studio_card_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_bookings_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "studio_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_bookings_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "studio_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_card_adjustments: {
        Row: {
          card_id: string;
          created_at: string;
          created_by: string | null;
          delta: number;
          id: string;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          created_at?: string;
          created_by?: string | null;
          delta: number;
          id?: string;
          reason: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          created_by?: string | null;
          delta?: number;
          id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_card_adjustments_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "studio_card_status";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_card_adjustments_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "studio_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_card_adjustments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_cards: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_on: string;
          id: string;
          kind: string;
          starts_on: string;
          used_before: number;
          user_id: string;
          visits: number;
          voided_at: string | null;
          warned_expiry_at: string | null;
          warned_low_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_on: string;
          id?: string;
          kind: string;
          starts_on: string;
          used_before?: number;
          user_id: string;
          visits: number;
          voided_at?: string | null;
          warned_expiry_at?: string | null;
          warned_low_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_on?: string;
          id?: string;
          kind?: string;
          starts_on?: string;
          used_before?: number;
          user_id?: string;
          visits?: number;
          voided_at?: string | null;
          warned_expiry_at?: string | null;
          warned_low_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "studio_cards_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "studio_cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_sessions: {
        Row: {
          cancelled_at: string | null;
          capacity: number;
          created_at: string;
          duration_min: number;
          id: string;
          slot_id: string | null;
          starts_at: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          capacity: number;
          created_at?: string;
          duration_min: number;
          id?: string;
          slot_id?: string | null;
          starts_at: string;
          title: string;
        };
        Update: {
          cancelled_at?: string | null;
          capacity?: number;
          created_at?: string;
          duration_min?: number;
          id?: string;
          slot_id?: string | null;
          starts_at?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "studio_sessions_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "studio_slots";
            referencedColumns: ["id"];
          },
        ];
      };
      studio_slots: {
        Row: {
          active: boolean;
          capacity: number;
          created_at: string;
          duration_min: number;
          id: string;
          start_time: string;
          title: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          capacity: number;
          created_at?: string;
          duration_min?: number;
          id?: string;
          start_time: string;
          title: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          created_at?: string;
          duration_min?: number;
          id?: string;
          start_time?: string;
          title?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_interval: Database["public"]["Enums"]["plan_interval"] | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          current_period_end: string | null;
          grace_until: string | null;
          plan_id: string | null;
          price_cents: number | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id: string | null;
          provider_event_at: string | null;
          provider_sub_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          billing_interval?: Database["public"]["Enums"]["plan_interval"] | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          grace_until?: string | null;
          plan_id?: string | null;
          price_cents?: number | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id?: string | null;
          provider_event_at?: string | null;
          provider_sub_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          billing_interval?: Database["public"]["Enums"]["plan_interval"] | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          grace_until?: string | null;
          plan_id?: string | null;
          price_cents?: number | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id?: string | null;
          provider_event_at?: string | null;
          provider_sub_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      visits: {
        Row: {
          anon_id: string;
          created_at: string;
          device: string;
          id: number;
          path: string;
          referrer: string | null;
          user_id: string | null;
          utm: Json | null;
        };
        ComputedFields: never;
        Insert: {
          anon_id: string;
          created_at?: string;
          device: string;
          id?: never;
          path: string;
          referrer?: string | null;
          user_id?: string | null;
          utm?: Json | null;
        };
        Update: {
          anon_id?: string;
          created_at?: string;
          device?: string;
          id?: never;
          path?: string;
          referrer?: string | null;
          user_id?: string | null;
          utm?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_completions: {
        Row: {
          completed_at: string;
          feeling: Database["public"]["Enums"]["feeling"] | null;
          id: string;
          local_date: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          completed_at?: string;
          feeling?: Database["public"]["Enums"]["feeling"] | null;
          id?: string;
          local_date?: string;
          user_id?: string;
          workout_id: string;
        };
        Update: {
          completed_at?: string;
          feeling?: Database["public"]["Enums"]["feeling"] | null;
          id?: string;
          local_date?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_completions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_completions_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_media: {
        Row: {
          provider: Database["public"]["Enums"]["video_provider"];
          video_url: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          provider: Database["public"]["Enums"]["video_provider"];
          video_url: string;
          workout_id: string;
        };
        Update: {
          provider?: Database["public"]["Enums"]["video_provider"];
          video_url?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_media_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: true;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_watches: {
        Row: {
          user_id: string;
          watched_at: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          user_id?: string;
          watched_at?: string;
          workout_id: string;
        };
        Update: {
          user_id?: string;
          watched_at?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_watches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_watches_workout_id_fkey";
            columns: ["workout_id"];
            isOneToOne: false;
            referencedRelation: "workouts";
            referencedColumns: ["id"];
          },
        ];
      };
      workouts: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          duration_min: number;
          focus: string[];
          id: string;
          kind: Database["public"]["Enums"]["workout_kind"];
          level: Database["public"]["Enums"]["workout_level"] | null;
          min_member_level: number | null;
          notified_at: string | null;
          notify: boolean;
          publish_at: string | null;
          starter_order: number | null;
          thumbnail_url: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_min: number;
          focus?: string[];
          id?: string;
          kind?: Database["public"]["Enums"]["workout_kind"];
          level?: Database["public"]["Enums"]["workout_level"] | null;
          min_member_level?: number | null;
          notified_at?: string | null;
          notify?: boolean;
          publish_at?: string | null;
          starter_order?: number | null;
          thumbnail_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          duration_min?: number;
          focus?: string[];
          id?: string;
          kind?: Database["public"]["Enums"]["workout_kind"];
          level?: Database["public"]["Enums"]["workout_level"] | null;
          min_member_level?: number | null;
          notified_at?: string | null;
          notify?: boolean;
          publish_at?: string | null;
          starter_order?: number | null;
          thumbnail_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workouts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      studio_card_status: {
        Row: {
          adjusted: number | null;
          booked: number | null;
          created_at: string | null;
          ends_on: string | null;
          id: string | null;
          kind: string | null;
          remaining: number | null;
          starts_on: string | null;
          used_before: number | null;
          user_id: string | null;
          visits: number | null;
          voided_at: string | null;
          warned_expiry_at: string | null;
          warned_low_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "studio_cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      active_payment_provider: { Args: Record<PropertyKey, never>; Returns: string };
      add_progress_photo: { Args: { p_path: string; p_taken_on: string }; Returns: string };
      admin_adjust_points: {
        Args: { p_points: number; p_reason: string; p_user_id: string };
        Returns: string;
      };
      admin_client_stats: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string };
        Returns: {
          current_period_end: string;
          done_30: number;
          done_7: number;
          done_regular_14: number;
          email: string;
          has_access: boolean;
          joined_at: string;
          last_done_at: string;
          last_seen_at: string;
          level: Database["public"]["Enums"]["workout_level"];
          minutes_30: number;
          minutes_7: number;
          name: string;
          onboarding_done: boolean;
          paid_without_workout: boolean;
          phone: string;
          phone_call_consent: boolean;
          published_14: number;
          snoozed_until: string;
          sub_provider: Database["public"]["Enums"]["payment_provider"];
          sub_status: Database["public"]["Enums"]["subscription_status"];
          total_count: number;
          total_done: number;
          user_id: string;
        }[];
      };
      admin_dashboard: { Args: { p_now?: string; p_own_host?: string }; Returns: Json };
      admin_delete_challenge: { Args: { p_id: string }; Returns: undefined };
      admin_delete_comment: { Args: { p_id: string }; Returns: undefined };
      admin_delete_post: { Args: { p_id: string }; Returns: string };
      admin_dismiss_report: { Args: { p_id: string }; Returns: undefined };
      admin_grant_manual: { Args: { p_days: number; p_user_id: string }; Returns: string };
      admin_mfa_required: { Args: Record<PropertyKey, never>; Returns: boolean };
      admin_moderate_comment: { Args: { p_hidden: boolean; p_id: string }; Returns: undefined };
      admin_moderate_post: { Args: { p_hidden: boolean; p_id: string }; Returns: undefined };
      admin_reorder_starters: { Args: { p_ids: string[] }; Returns: undefined };
      admin_save_challenge: {
        Args: {
          p_days: number;
          p_description: string;
          p_id: string;
          p_published: boolean;
          p_start: string;
          p_tasks: Json;
          p_title: string;
        };
        Returns: string;
      };
      apply_subscription_event: {
        Args: {
          p_cancel_at_period_end: boolean;
          p_canceled_at: string;
          p_customer_id: string;
          p_event_at: string;
          p_interval: Database["public"]["Enums"]["plan_interval"];
          p_period_end: string;
          p_plan_id: string;
          p_price_cents: number;
          p_provider: Database["public"]["Enums"]["payment_provider"];
          p_status: Database["public"]["Enums"]["subscription_status"];
          p_sub_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      attend_live: { Args: { p_session_id: string }; Returns: undefined };
      award_community_points: {
        Args: {
          p_points: number;
          p_ref: string;
          p_source: Database["public"]["Enums"]["points_source"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      can_watch: { Args: { p_workout_id: string }; Returns: boolean };
      challenge_board: {
        Args: { p_id: string };
        Returns: {
          display_name: string;
          is_me: boolean;
          rank: number;
          ticked: number;
        }[];
      };
      challenge_counts: {
        Args: { p_ids: string[] };
        Returns: {
          challenge_id: string;
          participants: number;
        }[];
      };
      claim_meal_draft_call: { Args: Record<PropertyKey, never>; Returns: boolean };
      claim_nutrition_ai_call: { Args: Record<PropertyKey, never>; Returns: boolean };
      community_display_name: { Args: { p_name: string }; Returns: string };
      community_feed: { Args: { p_before: string; p_limit: number }; Returns: Json };
      community_link: { Args: Record<PropertyKey, never>; Returns: string };
      community_photo_readable: { Args: { p_name: string }; Returns: boolean };
      community_post: { Args: { p_id: string }; Returns: Json };
      community_reports: { Args: Record<PropertyKey, never>; Returns: Json };
      create_comment: { Args: { p_body: string; p_post_id: string }; Returns: string };
      create_post: {
        Args: { p_body: string; p_completion_id: string; p_photo_path: string };
        Returns: string;
      };
      delete_own_comment: { Args: { p_id: string }; Returns: undefined };
      delete_own_post: { Args: { p_id: string }; Returns: string };
      delete_progress_photo: { Args: { p_id: string }; Returns: undefined };
      gift_code: { Args: Record<PropertyKey, never>; Returns: string };
      has_active_access: { Args: { uid: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      issue_gift_voucher: {
        Args: { p_months: number; p_note: string; p_recipient_name: string };
        Returns: string;
      };
      join_challenge: { Args: { p_id: string }; Returns: undefined };
      level_for_points: { Args: { p: number }; Returns: number };
      meal_ingredients_valid: { Args: { p_items: Json }; Returns: boolean };
      meal_types_valid: {
        Args: { p_types: Database["public"]["Enums"]["meal_slot"][] };
        Returns: boolean;
      };
      member_points: {
        Args: { uid: string };
        Returns: {
          level: number;
          points: number;
        }[];
      };
      my_access: { Args: Record<PropertyKey, never>; Returns: boolean };
      next_drop_at: {
        Args: { p_level: Database["public"]["Enums"]["workout_level"] };
        Returns: string;
      };
      next_drop_for_me: { Args: Record<PropertyKey, never>; Returns: string };
      public_free_workout: {
        Args: Record<PropertyKey, never>;
        Returns: {
          duration_min: number;
          id: string;
          thumbnail_url: string;
          title: string;
          video_url: string;
        }[];
      };
      public_site_links: { Args: Record<PropertyKey, never>; Returns: Json };
      push_cron_status: { Args: Record<PropertyKey, never>; Returns: Json };
      redeem_gift_voucher: { Args: { p_code: string }; Returns: string };
      report_content: {
        Args: { p_comment_id: string; p_post_id: string; p_reason: string };
        Returns: undefined;
      };
      run_push_cron: { Args: Record<PropertyKey, never>; Returns: undefined };
      run_warm_ping: { Args: Record<PropertyKey, never>; Returns: undefined };
      studio_adjust_card: {
        Args: { p_card_id: string; p_delta: number; p_reason: string };
        Returns: undefined;
      };
      studio_admin_add: { Args: { p_session_id: string; p_user_id: string }; Returns: Json };
      studio_admin_remove: { Args: { p_booking_id: string }; Returns: undefined };
      studio_book: { Args: { p_session_id: string }; Returns: Json };
      studio_cancel: { Args: { p_booking_id: string }; Returns: undefined };
      studio_cancel_session: { Args: { p_session_id: string }; Returns: string[] };
      studio_ensure_sessions: { Args: { p_days?: number; p_today?: string }; Returns: undefined };
      studio_grant_card: {
        Args: { p_kind: string; p_starts_on: string; p_used_before?: number; p_user_id: string };
        Returns: Json;
      };
      studio_pick_card: { Args: { p_day: string; p_user: string }; Returns: string };
      studio_reset_slot_sessions: { Args: { p_slot_id: string }; Returns: undefined };
      studio_schedule: {
        Args: { p_from: string; p_to: string };
        Returns: {
          booked: number;
          cancelled: boolean;
          capacity: number;
          duration_min: number;
          id: string;
          starts_at: string;
          title: string;
        }[];
      };
      studio_void_card: { Args: { p_card_id: string }; Returns: undefined };
      submit_lead: {
        Args: {
          p_email: string;
          p_ip_hash: string;
          p_marketing: boolean;
          p_name: string;
          p_source: string;
        };
        Returns: boolean;
      };
      toggle_heart: { Args: { p_post_id: string }; Returns: Json };
      void_gift_voucher: { Args: { p_id: string }; Returns: undefined };
      warm_cron_status: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      activity_level: "sedentary" | "light" | "moderate" | "active";
      diet_type: "omnivore" | "vegetarian" | "vegan" | "pescatarian";
      feeling: "easy" | "right" | "hard";
      food_source: "ai" | "manual" | "recent" | "menu" | "preset";
      meal_slot: "breakfast" | "lunch" | "dinner" | "snack" | "drinks";
      note_kind: "call" | "message" | "note" | "snooze";
      payment_provider: "stripe" | "revolut" | "manual";
      plan_interval: "month" | "year";
      points_source: "workout" | "checkin" | "challenge" | "live" | "post" | "comment" | "admin";
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "none";
      user_role: "client" | "admin";
      video_provider: "youtube" | "vimeo" | "bunny";
      workout_kind: "free" | "starter" | "regular";
      workout_level: "beginner" | "advanced" | "pro";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_level: ["sedentary", "light", "moderate", "active"],
      diet_type: ["omnivore", "vegetarian", "vegan", "pescatarian"],
      feeling: ["easy", "right", "hard"],
      food_source: ["ai", "manual", "recent", "menu", "preset"],
      meal_slot: ["breakfast", "lunch", "dinner", "snack", "drinks"],
      note_kind: ["call", "message", "note", "snooze"],
      payment_provider: ["stripe", "revolut", "manual"],
      plan_interval: ["month", "year"],
      points_source: ["workout", "checkin", "challenge", "live", "post", "comment", "admin"],
      subscription_status: ["active", "trialing", "past_due", "canceled", "none"],
      user_role: ["client", "admin"],
      video_provider: ["youtube", "vimeo", "bunny"],
      workout_kind: ["free", "starter", "regular"],
      workout_level: ["beginner", "advanced", "pro"],
    },
  },
} as const;
