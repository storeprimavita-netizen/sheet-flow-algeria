export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          type: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          id: string
          incurred_on: string
          notes: string | null
          order_id: string | null
          product_id: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          incurred_on?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          incurred_on?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string | null
          comment: string | null
          created_at: string
          id: string
          order_id: string
          stage: string
          status: string
        }
        Insert: {
          actor?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          stage: string
          status: string
        }
        Update: {
          actor?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          agent_comment: string | null
          assigned_confirmation_agent: string | null
          assigned_delivery_agent: string | null
          city: string | null
          confirmation_status: Database["public"]["Enums"]["confirmation_status"]
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          external_id: string | null
          id: string
          order_number: string | null
          placed_at: string | null
          product_id: string | null
          quantity: number
          raw_payload: Json | null
          source: string
          total_amount: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agent_comment?: string | null
          assigned_confirmation_agent?: string | null
          assigned_delivery_agent?: string | null
          city?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          external_id?: string | null
          id?: string
          order_number?: string | null
          placed_at?: string | null
          product_id?: string | null
          quantity?: number
          raw_payload?: Json | null
          source?: string
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agent_comment?: string | null
          assigned_confirmation_agent?: string | null
          assigned_delivery_agent?: string | null
          city?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          external_id?: string | null
          id?: string
          order_number?: string | null
          placed_at?: string | null
          product_id?: string | null
          quantity?: number
          raw_payload?: Json | null
          source?: string
          total_amount?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_confirmation: number
          cost_delivery: number
          cost_packaging: number
          cost_sampling: number
          cost_scaling_ads: number
          cost_shooting: number
          cost_test_ads: number
          created_at: string
          created_by: string | null
          description: string | null
          fabric: string | null
          id: string
          image_url: string | null
          is_active: boolean
          material: string | null
          name: string
          selling_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_confirmation?: number
          cost_delivery?: number
          cost_packaging?: number
          cost_sampling?: number
          cost_scaling_ads?: number
          cost_shooting?: number
          cost_test_ads?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fabric?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material?: string | null
          name: string
          selling_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_confirmation?: number
          cost_delivery?: number
          cost_packaging?: number
          cost_sampling?: number
          cost_scaling_ads?: number
          cost_shooting?: number
          cost_test_ads?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fabric?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          material?: string | null
          name?: string
          selling_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: []
      }
      team_roles: {
        Row: {
          created_at: string
          duty: string | null
          is_active: boolean
          meeting_late_minutes: number
          slack_channel_id: string | null
          slack_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duty?: string | null
          is_active?: boolean
          meeting_late_minutes?: number
          slack_channel_id?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duty?: string | null
          is_active?: boolean
          meeting_late_minutes?: number
          slack_channel_id?: string | null
          slack_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_profiles: {
        Row: {
          city: string | null
          confirmed_orders: number | null
          delivered_orders: number | null
          id: string | null
          name: string | null
          phone: string | null
          reliability_score: number | null
          total_orders: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      bootstrap_admin: { Args: { p_email: string }; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "confirmation_agent" | "delivery_agent"
      confirmation_status:
        | "wait_for_confirmation"
        | "not_answer"
        | "closed_phone"
        | "cancelled"
        | "confirmed"
      contact_type:
        | "shooting_studio"
        | "atelier_couture"
        | "emballage"
        | "customer"
        | "supplier"
      delivery_status:
        | "wait_for_deposit"
        | "bureau_deposited"
        | "in_transit"
        | "out_for_delivery"
        | "stop_desk_waiting"
        | "delivered"
        | "cancelled"
        | "delayed"
        | "returning"
        | "returned"
      expense_category:
        | "shooting"
        | "packaging"
        | "sampling"
        | "confirmation"
        | "delivery"
        | "test_ads"
        | "scaling_ads"
        | "other"
      product_status: "to_be_tested" | "tested" | "confirmed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "confirmation_agent", "delivery_agent"],
      confirmation_status: [
        "wait_for_confirmation",
        "not_answer",
        "closed_phone",
        "cancelled",
        "confirmed",
      ],
      contact_type: [
        "shooting_studio",
        "atelier_couture",
        "emballage",
        "customer",
        "supplier",
      ],
      delivery_status: [
        "wait_for_deposit",
        "bureau_deposited",
        "in_transit",
        "out_for_delivery",
        "stop_desk_waiting",
        "delivered",
        "cancelled",
        "delayed",
        "returning",
        "returned",
      ],
      expense_category: [
        "shooting",
        "packaging",
        "sampling",
        "confirmation",
        "delivery",
        "test_ads",
        "scaling_ads",
        "other",
      ],
      product_status: ["to_be_tested", "tested", "confirmed", "cancelled"],
    },
  },
} as const
