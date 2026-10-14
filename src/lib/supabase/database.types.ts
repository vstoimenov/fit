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
      profiles: {
        Row: {
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
          name: string;
          onboarding_done: boolean;
          phone: string | null;
          phone_call_consent: boolean;
          problems: string[];
          role: Database["public"]["Enums"]["user_role"];
          starter_week_done_at: string | null;
          target_weight_kg: number | null;
          time_per_session: string | null;
          timezone: string;
          updated_at: string;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
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
          name?: string;
          onboarding_done?: boolean;
          phone?: string | null;
          phone_call_consent?: boolean;
          problems?: string[];
          role?: Database["public"]["Enums"]["user_role"];
          starter_week_done_at?: string | null;
          target_weight_kg?: number | null;
          time_per_session?: string | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Update: {
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
          name?: string;
          onboarding_done?: boolean;
          phone?: string | null;
          phone_call_consent?: boolean;
          problems?: string[];
          role?: Database["public"]["Enums"]["user_role"];
          starter_week_done_at?: string | null;
          target_weight_kg?: number | null;
          time_per_session?: string | null;
          timezone?: string;
          updated_at?: string;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          current_period_end: string | null;
          grace_until: string | null;
          plan_id: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id: string | null;
          provider_sub_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          current_period_end?: string | null;
          grace_until?: string | null;
          plan_id?: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id?: string | null;
          provider_sub_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          current_period_end?: string | null;
          grace_until?: string | null;
          plan_id?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_customer_id?: string | null;
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
      [_ in never]: never;
    };
    Functions: {
      can_watch: { Args: { p_workout_id: string }; Returns: boolean };
      has_active_access: { Args: { uid: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_access: { Args: Record<PropertyKey, never>; Returns: boolean };
      next_drop_at: {
        Args: { p_level: Database["public"]["Enums"]["workout_level"] };
        Returns: string;
      };
    };
    Enums: {
      feeling: "easy" | "right" | "hard";
      payment_provider: "stripe" | "revolut" | "manual";
      plan_interval: "month" | "year";
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
      feeling: ["easy", "right", "hard"],
      payment_provider: ["stripe", "revolut", "manual"],
      plan_interval: ["month", "year"],
      subscription_status: ["active", "trialing", "past_due", "canceled", "none"],
      user_role: ["client", "admin"],
      video_provider: ["youtube", "vimeo", "bunny"],
      workout_kind: ["free", "starter", "regular"],
      workout_level: ["beginner", "advanced", "pro"],
    },
  },
} as const;
