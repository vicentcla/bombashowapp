export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      arrangements: {
        Row: {
          created_at: string;
          duration_seconds: number;
          id: string;
          sort_order: number;
          tags: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number;
          id?: string;
          sort_order?: number;
          tags?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number;
          id?: string;
          sort_order?: number;
          tags?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lyrics: {
        Row: {
          arrangement_id: string | null;
          content: string;
          created_at: string;
          id: string;
          kind: string;
          plain_text: string;
          street_song_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          arrangement_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          kind: string;
          plain_text?: string;
          street_song_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          arrangement_id?: string | null;
          content?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          plain_text?: string;
          street_song_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lyrics_arrangement_id_fkey";
            columns: ["arrangement_id"];
            isOneToOne: false;
            referencedRelation: "arrangements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lyrics_street_song_id_fkey";
            columns: ["street_song_id"];
            isOneToOne: false;
            referencedRelation: "street_songs";
            referencedColumns: ["id"];
          },
        ];
      };
      play_events: {
        Row: {
          arrangement_id: string | null;
          created_by: string | null;
          id: string;
          period_id: string | null;
          played_at: string;
          scope: string;
          street_song_id: string | null;
        };
        Insert: {
          arrangement_id?: string | null;
          created_by?: string | null;
          id?: string;
          period_id?: string | null;
          played_at?: string;
          scope: string;
          street_song_id?: string | null;
        };
        Update: {
          arrangement_id?: string | null;
          created_by?: string | null;
          id?: string;
          period_id?: string | null;
          played_at?: string;
          scope?: string;
          street_song_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "play_events_arrangement_id_fkey";
            columns: ["arrangement_id"];
            isOneToOne: false;
            referencedRelation: "arrangements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "play_events_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "reset_periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "play_events_street_song_id_fkey";
            columns: ["street_song_id"];
            isOneToOne: false;
            referencedRelation: "street_songs";
            referencedColumns: ["id"];
          },
        ];
      };
      notices: {
        Row: {
          body: string;
          created_at: string;
          created_by: string;
          id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          status?: string;
        };
        Relationships: [];
      };
      reset_periods: {
        Row: {
          ended_at: string | null;
          id: string;
          label: string | null;
          scope: string;
          started_at: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          label?: string | null;
          scope: string;
          started_at?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          label?: string | null;
          scope?: string;
          started_at?: string;
        };
        Relationships: [];
      };
      role_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      setlist_items: {
        Row: {
          arrangement_id: string | null;
          created_at: string;
          id: string;
          manual_duration_seconds: number | null;
          manual_title: string | null;
          position: number;
          setlist_id: string;
        };
        Insert: {
          arrangement_id?: string | null;
          created_at?: string;
          id?: string;
          manual_duration_seconds?: number | null;
          manual_title?: string | null;
          position?: number;
          setlist_id: string;
        };
        Update: {
          arrangement_id?: string | null;
          created_at?: string;
          id?: string;
          manual_duration_seconds?: number | null;
          manual_title?: string | null;
          position?: number;
          setlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "setlist_items_arrangement_id_fkey";
            columns: ["arrangement_id"];
            isOneToOne: false;
            referencedRelation: "arrangements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "setlist_items_setlist_id_fkey";
            columns: ["setlist_id"];
            isOneToOne: false;
            referencedRelation: "setlists";
            referencedColumns: ["id"];
          },
        ];
      };
      setlists: {
        Row: {
          created_at: string;
          event_date: string | null;
          id: string;
          name: string;
          notes: string | null;
        };
        Insert: {
          created_at?: string;
          event_date?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
        };
        Update: {
          created_at?: string;
          event_date?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      social_comments: {
        Row: {
          body: string;
          created_at: string;
          end_offset: number | null;
          id: string;
          post_id: string;
          snippet: string | null;
          start_offset: number | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          end_offset?: number | null;
          id?: string;
          post_id: string;
          snippet?: string | null;
          start_offset?: number | null;
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          end_offset?: number | null;
          id?: string;
          post_id?: string;
          snippet?: string | null;
          start_offset?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "social_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      social_posts: {
        Row: {
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          network: string;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          network?: string;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          network?: string;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      social_templates: {
        Row: {
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          network: string;
          updated_at: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name: string;
          network?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          network?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      street_songs: {
        Row: {
          created_at: string;
          id: string;
          sort_order: number;
          tags: string[];
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          tags?: string[];
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          tags?: string[];
          title?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_profile_email: { Args: { _user_id: string }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "miembro" | "superadmin";
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "miembro", "superadmin"],
    },
  },
} as const;
