export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ad_spend_daily: {
        Row: {
          amount: number
          amount_dzd: number | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          fx_rate: number
          id: string
          kind: Database["public"]["Enums"]["ad_kind"]
          product_id: string
          spent_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          amount_dzd?: number | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          kind?: Database["public"]["Enums"]["ad_kind"]
          product_id: string
          spent_on?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          amount_dzd?: number | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          kind?: Database["public"]["Enums"]["ad_kind"]
          product_id?: string
          spent_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_spend_daily_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: number
          new_row: Json | null
          old_row: Json | null
          row_id: string | null
          table_name: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_id?: string | null
          table_name: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: never
          new_row?: Json | null
          old_row?: Json | null
          row_id?: string | null
          table_name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_collections: {
        Row: {
          amount_dzd: number
          collected_on: string
          created_at: string
          created_by: string | null
          deposited_on: string | null
          id: string
          note: string | null
          order_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["cash_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount_dzd: number
          collected_on?: string
          created_at?: string
          created_by?: string | null
          deposited_on?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["cash_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount_dzd?: number
          collected_on?: string
          created_at?: string
          created_by?: string | null
          deposited_on?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["cash_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_collections_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          notes: string | null
          phones: string[]
          type: Database["public"]["Enums"]["supplier_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phones?: string[]
          type: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phones?: string[]
          type?: Database["public"]["Enums"]["supplier_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          commune: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
          phone_raw: string | null
          updated_at: string
          wilaya_code: number | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          commune?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          phone_raw?: string | null
          updated_at?: string
          wilaya_code?: number | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          commune?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          phone_raw?: string | null
          updated_at?: string
          wilaya_code?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          rate_dzd: number
          valid_from: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate_dzd: number
          valid_from?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          rate_dzd?: number
          valid_from?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          amount_dzd: number | null
          category: Database["public"]["Enums"]["expense_category"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          fx_rate: number
          id: string
          note: string | null
          product_id: string | null
          spent_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          amount_dzd?: number | null
          category: Database["public"]["Enums"]["expense_category"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          note?: string | null
          product_id?: string | null
          spent_on?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          amount_dzd?: number | null
          category?: Database["public"]["Enums"]["expense_category"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          note?: string | null
          product_id?: string | null
          spent_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_contact_fk"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_fees: {
        Row: {
          amount: number
          amount_dzd: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          fx_rate: number
          id: string
          is_active: boolean
          label: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          amount_dzd?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          amount_dzd?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          fx_rate?: number
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_fees_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          config: Json
          is_active: boolean
          last_event_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          secret: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          is_active?: boolean
          last_event_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          secret?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          is_active?: boolean
          last_event_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          secret?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_objectives: {
        Row: {
          content: string
          created_at: string
          id: string
          is_done: boolean
          meeting_id: string
          position: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_done?: boolean
          meeting_id: string
          position?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_done?: boolean
          meeting_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "meeting_objectives_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendees: string[]
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attendees?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attendees?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor: string | null
          comment: string | null
          created_at: string
          from_status: string | null
          id: number
          order_id: string
          stage: string
          to_status: string
        }
        Insert: {
          actor?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: never
          order_id: string
          stage: string
          to_status: string
        }
        Update: {
          actor?: string | null
          comment?: string | null
          created_at?: string
          from_status?: string | null
          id?: never
          order_id?: string
          stage?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
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
          assigned_confirmation_agent: string | null
          assigned_delivery_agent: string | null
          commune: string | null
          confirmation_attempts: number
          confirmation_comment: string | null
          confirmation_status: Database["public"]["Enums"]["confirmation_status"]
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          delivery_fee_source: Database["public"]["Enums"]["delivery_fee_source"]
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          duplicate_of: string | null
          external_id: string | null
          id: string
          is_duplicate_suspect: boolean
          order_number: string | null
          placed_at: string | null
          product_id: string | null
          quantity: number
          sale_price: number | null
          source: Database["public"]["Enums"]["order_source"]
          updated_at: string
          variant: string | null
          webhook_event_id: string | null
          wilaya_code: number | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          assigned_confirmation_agent?: string | null
          assigned_delivery_agent?: string | null
          commune?: string | null
          confirmation_attempts?: number
          confirmation_comment?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_fee_source?: Database["public"]["Enums"]["delivery_fee_source"]
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          duplicate_of?: string | null
          external_id?: string | null
          id?: string
          is_duplicate_suspect?: boolean
          order_number?: string | null
          placed_at?: string | null
          product_id?: string | null
          quantity?: number
          sale_price?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          updated_at?: string
          variant?: string | null
          webhook_event_id?: string | null
          wilaya_code?: number | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          assigned_confirmation_agent?: string | null
          assigned_delivery_agent?: string | null
          commune?: string | null
          confirmation_attempts?: number
          confirmation_comment?: string | null
          confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          delivery_fee_source?: Database["public"]["Enums"]["delivery_fee_source"]
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          duplicate_of?: string | null
          external_id?: string | null
          id?: string
          is_duplicate_suspect?: boolean
          order_number?: string | null
          placed_at?: string | null
          product_id?: string | null
          quantity?: number
          sale_price?: number | null
          source?: Database["public"]["Enums"]["order_source"]
          updated_at?: string
          variant?: string | null
          webhook_event_id?: string | null
          wilaya_code?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          fx_rate: number
          product_id: string
          sourcing_cost: number
          sourcing_cost_dzd: number | null
          sourcing_currency: Database["public"]["Enums"]["currency_code"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          fx_rate?: number
          product_id: string
          sourcing_cost?: number
          sourcing_cost_dzd?: number | null
          sourcing_currency?: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          fx_rate?: number
          product_id?: string
          sourcing_cost?: number
          sourcing_cost_dzd?: number | null
          sourcing_currency?: Database["public"]["Enums"]["currency_code"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_scenarios: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          product_id: string | null
          slug: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs?: Json
          product_id?: string | null
          slug: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          product_id?: string | null
          slug?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_scenarios_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_scenarios_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_scenarios_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          fabric: string | null
          id: string
          images: string[]
          is_active: boolean
          name: string
          notes: string | null
          sale_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          updated_at: string
          variants: Json
          workspace_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          fabric?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          name: string
          notes?: string | null
          sale_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
          variants?: Json
          workspace_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          fabric?: string | null
          id?: string
          images?: string[]
          is_active?: boolean
          name?: string
          notes?: string | null
          sale_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          updated_at?: string
          variants?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          duty: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          duty?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          duty?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rules_docs: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title: string
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rules_docs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
          workspace_id: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
          workspace_id: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          reason: Database["public"]["Enums"]["stock_reason"]
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          reason: Database["public"]["Enums"]["stock_reason"]
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          reason?: Database["public"]["Enums"]["stock_reason"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          signature_ok: boolean
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          signature_ok?: boolean
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          signature_ok?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wilaya_fees: {
        Row: {
          home_fee: number
          stop_shipping: boolean
          stopdesk_fee: number
          updated_at: string
          wilaya_code: number
          workspace_id: string
        }
        Insert: {
          home_fee?: number
          stop_shipping?: boolean
          stopdesk_fee?: number
          updated_at?: string
          wilaya_code: number
          workspace_id: string
        }
        Update: {
          home_fee?: number
          stop_shipping?: boolean
          stopdesk_fee?: number
          updated_at?: string
          wilaya_code?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wilaya_fees_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wilaya_fees_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wilayas: {
        Row: {
          code: number
          name: string
        }
        Insert: {
          code: number
          name: string
        }
        Update: {
          code?: number
          name?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      agent_performance: {
        Row: {
          avg_decision_time: string | null
          confirmed: number | null
          delivered: number | null
          lost: number | null
          orders_handled: number | null
          stage: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_stats: {
        Row: {
          cancelled_orders: number | null
          commune: string | null
          confirmed_orders: number | null
          delivered_orders: number | null
          id: string | null
          name: string | null
          no_answer_orders: number | null
          phone: string | null
          returned_orders: number | null
          risk_score: number | null
          total_orders: number | null
          wilaya_code: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stats: {
        Row: {
          ad_spend_dzd: number | null
          confirmation_rate: number | null
          delivery_rate: number | null
          expenses_dzd: number | null
          id: string | null
          name: string | null
          orders_confirmed: number | null
          orders_delivered: number | null
          orders_received: number | null
          orders_returned: number | null
          revenue_dzd: number | null
          sourcing_cost_dzd: number | null
          status: Database["public"]["Enums"]["product_status"] | null
          stock: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      wilaya_stats: {
        Row: {
          confirmed_orders: number | null
          delivered_orders: number | null
          delivery_rate: number | null
          returned_orders: number | null
          stop_shipping_auto: boolean | null
          stop_shipping_manual: boolean | null
          total_orders: number | null
          wilaya_code: number | null
          wilaya_name: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_wilaya_code_fkey"
            columns: ["wilaya_code"]
            isOneToOne: false
            referencedRelation: "wilayas"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bootstrap_workspace: {
        Args: { p_email: string; p_workspace_name?: string }
        Returns: string
      }
      current_app_role: { Args: never; Returns: string }
      current_fx_rate: {
        Args: {
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_ws: string
        }
        Returns: number
      }
      current_workspace_id: { Args: never; Returns: string }
      dashboard_stats: {
        Args: {
          p_agent?: string[]
          p_conf_agent?: string[]
          p_confirmation_status?: Database["public"]["Enums"]["confirmation_status"][]
          p_deliv_agent?: string[]
          p_delivery_status?: Database["public"]["Enums"]["delivery_status"][]
          p_from?: string
          p_product?: string[]
          p_source?: Database["public"]["Enums"]["order_source"][]
          p_to?: string
          p_wilaya?: number[]
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      normalize_dz_phone: { Args: { p: string }; Returns: string }
      seed_workspace: { Args: { p_ws: string }; Returns: undefined }
      transition_order_status: {
        Args: {
          p_confirmation_comment?: string
          p_confirmation_status?: Database["public"]["Enums"]["confirmation_status"]
          p_delivery_status?: Database["public"]["Enums"]["delivery_status"]
          p_order_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      ad_kind: "test" | "scaling"
      app_role: "admin" | "confirmation_agent" | "delivery_agent"
      cash_status: "collected" | "deposited"
      confirmation_status:
        | "wait_for_confirmation"
        | "no_answer"
        | "closed_phone"
        | "cancelled"
        | "confirmed"
      currency_code: "DZD" | "USD" | "EUR"
      delivery_fee_source: "payload" | "wilaya_table" | "manual"
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
      delivery_type: "home" | "stopdesk"
      expense_category:
        | "shooting"
        | "packaging"
        | "sampling"
        | "confirmation"
        | "delivery"
        | "test_ads"
        | "scaling_ads"
        | "other"
      integration_provider: "shopify" | "lightfunnels"
      meeting_status: "planned" | "held" | "cancelled"
      order_source: "shopify" | "lightfunnels" | "manual"
      product_status: "to_be_tested" | "tested" | "confirmed" | "cancelled"
      stock_reason: "purchase" | "correction" | "delivered" | "returned"
      supplier_type:
        | "shooting_studio"
        | "atelier_couture"
        | "emballage"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ad_kind: ["test", "scaling"],
      app_role: ["admin", "confirmation_agent", "delivery_agent"],
      cash_status: ["collected", "deposited"],
      confirmation_status: [
        "wait_for_confirmation",
        "no_answer",
        "closed_phone",
        "cancelled",
        "confirmed",
      ],
      currency_code: ["DZD", "USD", "EUR"],
      delivery_fee_source: ["payload", "wilaya_table", "manual"],
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
      delivery_type: ["home", "stopdesk"],
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
      integration_provider: ["shopify", "lightfunnels"],
      meeting_status: ["planned", "held", "cancelled"],
      order_source: ["shopify", "lightfunnels", "manual"],
      product_status: ["to_be_tested", "tested", "confirmed", "cancelled"],
      stock_reason: ["purchase", "correction", "delivered", "returned"],
      supplier_type: [
        "shooting_studio",
        "atelier_couture",
        "emballage",
        "other",
      ],
    },
  },
} as const

