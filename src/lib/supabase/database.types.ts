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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
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
