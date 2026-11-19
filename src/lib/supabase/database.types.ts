
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
            "account_topups": {
                  Row: {
                    "account_id": string,"amount": number,"created_at": string,"created_by": string | null,"id": string,"note": string | null,"occurred_on": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount": number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"occurred_on"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string,"amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"note"?: string | null,"occurred_on"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_topups_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id"]
    },{
      foreignKeyName: "account_topups_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_topups_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"accounts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"currency": Database["public"]['Enums']["currency_code"],"id": string,"is_active": boolean,"low_balance_threshold": number,"name": string,"opening_balance": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"is_active"?: boolean,"low_balance_threshold"?: number,"name": string,"opening_balance"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"is_active"?: boolean,"low_balance_threshold"?: number,"name"?: string,"opening_balance"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"ad_spend_daily": {
                  Row: {
                    "account_id": string | null,"amount": number,"amount_dzd": number | null,"created_at": string,"created_by": string | null,"currency": Database["public"]['Enums']["currency_code"],"fx_rate": number,"id": string,"kind": Database["public"]['Enums']["ad_kind"],"product_id": string,"spent_on": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount": number,"amount_dzd"?: never,"created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["ad_kind"],"product_id": string,"spent_on"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount"?: number,"amount_dzd"?: never,"created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"kind"?: Database["public"]['Enums']["ad_kind"],"product_id"?: string,"spent_on"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ad_spend_daily_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id"]
    },{
      foreignKeyName: "ad_spend_daily_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ad_spend_daily_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ad_spend_daily_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "ad_spend_daily_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "ad_spend_daily_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "ad_spend_daily_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ad_spend_daily_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"id": number,"new_row": Json | null,"old_row": Json | null,"row_id": string | null,"table_name": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"row_id"?: string | null,"table_name"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_collections": {
                  Row: {
                    "amount_dzd": number,"collected_on": string,"created_at": string,"created_by": string | null,"deposited_on": string | null,"id": string,"note": string | null,"order_id": string | null,"reference": string | null,"status": Database["public"]['Enums']["cash_status"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_dzd": number,"collected_on"?: string,"created_at"?: string,"created_by"?: string | null,"deposited_on"?: string | null,"id"?: string,"note"?: string | null,"order_id"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["cash_status"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount_dzd"?: number,"collected_on"?: string,"created_at"?: string,"created_by"?: string | null,"deposited_on"?: string | null,"id"?: string,"note"?: string | null,"order_id"?: string | null,"reference"?: string | null,"status"?: Database["public"]['Enums']["cash_status"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_collections_order_ws_fkey"
      columns: ["order_id","workspace_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "cash_collections_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "created_at": string,"id": string,"location": string | null,"name": string,"notes": string | null,"phones": (string)[],"type": Database["public"]['Enums']["supplier_type"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"location"?: string | null,"name": string,"notes"?: string | null,"phones"?: (string)[],"type": Database["public"]['Enums']["supplier_type"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"location"?: string | null,"name"?: string,"notes"?: string | null,"phones"?: (string)[],"type"?: Database["public"]['Enums']["supplier_type"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"customers": {
                  Row: {
                    "address": string | null,"commune": string | null,"created_at": string,"id": string,"name": string,"notes": string | null,"phone": string,"phone_raw": string | null,"updated_at": string,"wilaya_code": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"commune"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null,"phone": string,"phone_raw"?: string | null,"updated_at"?: string,"wilaya_code"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "address"?: string | null,"commune"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null,"phone"?: string,"phone_raw"?: string | null,"updated_at"?: string,"wilaya_code"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customers_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "customers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"exchange_rates": {
                  Row: {
                    "created_at": string,"currency": Database["public"]['Enums']["currency_code"],"id": string,"rate_dzd": number,"valid_from": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency": Database["public"]['Enums']["currency_code"],"id"?: string,"rate_dzd": number,"valid_from"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"rate_dzd"?: number,"valid_from"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exchange_rates_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"expenses": {
                  Row: {
                    "account_id": string | null,"amount": number,"amount_dzd": number | null,"category": Database["public"]['Enums']["expense_category"],"contact_id": string | null,"created_at": string,"created_by": string | null,"currency": Database["public"]['Enums']["currency_code"],"fx_rate": number,"id": string,"note": string | null,"product_id": string | null,"spent_on": string,"subcategory_option_id": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"amount": number,"amount_dzd"?: never,"category": Database["public"]['Enums']["expense_category"],"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"note"?: string | null,"product_id"?: string | null,"spent_on"?: string,"subcategory_option_id"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "account_id"?: string | null,"amount"?: number,"amount_dzd"?: never,"category"?: Database["public"]['Enums']["expense_category"],"contact_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"note"?: string | null,"product_id"?: string | null,"spent_on"?: string,"subcategory_option_id"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id"]
    },{
      foreignKeyName: "expenses_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_contact_fk"
      columns: ["contact_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "expenses_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "expenses_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "expenses_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_subcategory_option_id_fkey"
      columns: ["subcategory_option_id"]
isOneToOne: false
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expenses_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"fixed_fees": {
                  Row: {
                    "amount": number,"amount_dzd": number | null,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"fx_rate": number,"id": string,"is_active": boolean,"label": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"amount_dzd"?: never,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"is_active"?: boolean,"label": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"amount_dzd"?: never,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"fx_rate"?: number,"id"?: string,"is_active"?: boolean,"label"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fixed_fees_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"integration_configs": {
                  Row: {
                    "config": NonNullable<Json>,"is_active": boolean,"last_event_at": string | null,"provider": Database["public"]['Enums']["integration_provider"],"secret": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "config"?: NonNullable<Json>,"is_active"?: boolean,"last_event_at"?: string | null,"provider": Database["public"]['Enums']["integration_provider"],"secret"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "config"?: NonNullable<Json>,"is_active"?: boolean,"last_event_at"?: string | null,"provider"?: Database["public"]['Enums']["integration_provider"],"secret"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "integration_configs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_objectives": {
                  Row: {
                    "carried_forward": boolean,"carried_from": string | null,"content": string,"created_at": string,"id": string,"is_deferred": boolean,"is_done": boolean,"meeting_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "carried_forward"?: boolean,"carried_from"?: string | null,"content": string,"created_at"?: string,"id"?: string,"is_deferred"?: boolean,"is_done"?: boolean,"meeting_id": string,"position"?: number
                  }
                  Update: {
                    "carried_forward"?: boolean,"carried_from"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"is_deferred"?: boolean,"is_done"?: boolean,"meeting_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_objectives_carried_from_fkey"
      columns: ["carried_from"]
isOneToOne: false
      referencedRelation: "meeting_objectives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_objectives_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    }
                  ]
                },"meetings": {
                  Row: {
                    "attendees": (string)[],"created_at": string,"created_by": string | null,"id": string,"notes": string | null,"scheduled_at": string,"status": Database["public"]['Enums']["meeting_status"],"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendees"?: (string)[],"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"scheduled_at": string,"status"?: Database["public"]['Enums']["meeting_status"],"title"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "attendees"?: (string)[],"created_at"?: string,"created_by"?: string | null,"id"?: string,"notes"?: string | null,"scheduled_at"?: string,"status"?: Database["public"]['Enums']["meeting_status"],"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"option_sets": {
                  Row: {
                    "allows_multi": boolean,"created_at": string,"id": string,"key": string,"label": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allows_multi"?: boolean,"created_at"?: string,"id"?: string,"key": string,"label": string,"workspace_id": string
                  }
                  Update: {
                    "allows_multi"?: boolean,"created_at"?: string,"id"?: string,"key"?: string,"label"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_sets_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"options": {
                  Row: {
                    "archived_at": string | null,"color_token": string,"created_at": string,"created_by": string | null,"icon": string | null,"id": string,"label": string,"set_id": string,"sort_order": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color_token"?: string,"created_at"?: string,"created_by"?: string | null,"icon"?: string | null,"id"?: string,"label": string,"set_id": string,"sort_order"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"color_token"?: string,"created_at"?: string,"created_by"?: string | null,"icon"?: string | null,"id"?: string,"label"?: string,"set_id"?: string,"sort_order"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "options_set_id_fkey"
      columns: ["set_id"]
isOneToOne: false
      referencedRelation: "option_sets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "options_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"order_counters": {
                  Row: {
                    "next_seq": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "next_seq"?: number,"workspace_id": string
                  }
                  Update: {
                    "next_seq"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_counters_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"order_status_history": {
                  Row: {
                    "actor": string | null,"comment": string | null,"created_at": string,"from_status": string | null,"id": number,"order_id": string,"stage": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor"?: string | null,"comment"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"order_id": string,"stage": string,"to_status": string
                  }
                  Update: {
                    "actor"?: string | null,"comment"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"order_id"?: string,"stage"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_status_history_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"order_tags": {
                  Row: {
                    "created_at": string,"option_id": string,"order_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"option_id": string,"order_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"option_id"?: string,"order_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_tags_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_tags_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_tags_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "address": string | null,"assigned_confirmation_agent": string | null,"assigned_delivery_agent": string | null,"cancellation_reason_option_id": string | null,"commune": string | null,"confirmation_attempts": number,"confirmation_comment": string | null,"confirmation_status": Database["public"]['Enums']["confirmation_status"],"created_at": string,"created_by": string | null,"customer_id": string | null,"customer_name": string | null,"customer_phone": string | null,"delivery_fee": number | null,"delivery_fee_source": Database["public"]['Enums']["delivery_fee_source"],"delivery_status": Database["public"]['Enums']["delivery_status"],"delivery_type": Database["public"]['Enums']["delivery_type"],"duplicate_of": string | null,"excluded_reason": string | null,"external_id": string | null,"id": string,"is_duplicate_suspect": boolean,"order_number": string | null,"order_seq": number,"placed_at": string | null,"product_id": string | null,"quantity": number,"sale_price": number | null,"source": Database["public"]['Enums']["order_source"],"swapped_to_order_id": string | null,"updated_at": string,"variant": string | null,"variant_id": string | null,"webhook_event_id": string | null,"wilaya_code": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"assigned_confirmation_agent"?: string | null,"assigned_delivery_agent"?: string | null,"cancellation_reason_option_id"?: string | null,"commune"?: string | null,"confirmation_attempts"?: number,"confirmation_comment"?: string | null,"confirmation_status"?: Database["public"]['Enums']["confirmation_status"],"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"delivery_fee"?: number | null,"delivery_fee_source"?: Database["public"]['Enums']["delivery_fee_source"],"delivery_status"?: Database["public"]['Enums']["delivery_status"],"delivery_type"?: Database["public"]['Enums']["delivery_type"],"duplicate_of"?: string | null,"excluded_reason"?: string | null,"external_id"?: string | null,"id"?: string,"is_duplicate_suspect"?: boolean,"order_number"?: string | null,"order_seq"?: number,"placed_at"?: string | null,"product_id"?: string | null,"quantity"?: number,"sale_price"?: number | null,"source"?: Database["public"]['Enums']["order_source"],"swapped_to_order_id"?: string | null,"updated_at"?: string,"variant"?: string | null,"variant_id"?: string | null,"webhook_event_id"?: string | null,"wilaya_code"?: number | null,"workspace_id": string
                  }
                  Update: {
                    "address"?: string | null,"assigned_confirmation_agent"?: string | null,"assigned_delivery_agent"?: string | null,"cancellation_reason_option_id"?: string | null,"commune"?: string | null,"confirmation_attempts"?: number,"confirmation_comment"?: string | null,"confirmation_status"?: Database["public"]['Enums']["confirmation_status"],"created_at"?: string,"created_by"?: string | null,"customer_id"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"delivery_fee"?: number | null,"delivery_fee_source"?: Database["public"]['Enums']["delivery_fee_source"],"delivery_status"?: Database["public"]['Enums']["delivery_status"],"delivery_type"?: Database["public"]['Enums']["delivery_type"],"duplicate_of"?: string | null,"excluded_reason"?: string | null,"external_id"?: string | null,"id"?: string,"is_duplicate_suspect"?: boolean,"order_number"?: string | null,"order_seq"?: number,"placed_at"?: string | null,"product_id"?: string | null,"quantity"?: number,"sale_price"?: number | null,"source"?: Database["public"]['Enums']["order_source"],"swapped_to_order_id"?: string | null,"updated_at"?: string,"variant"?: string | null,"variant_id"?: string | null,"webhook_event_id"?: string | null,"wilaya_code"?: number | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_cancellation_reason_option_id_fkey"
      columns: ["cancellation_reason_option_id"]
isOneToOne: false
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customer_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_customer_id_fkey"
      columns: ["customer_id"]
isOneToOne: false
      referencedRelation: "customers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "orders_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_swapped_to_order_id_fkey"
      columns: ["swapped_to_order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_variant_fk"
      columns: ["variant_id","product_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "orders_webhook_event_id_fkey"
      columns: ["webhook_event_id"]
isOneToOne: false
      referencedRelation: "webhook_events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_costs": {
                  Row: {
                    "fx_rate": number,"product_id": string,"sourcing_cost": number,"sourcing_cost_dzd": number | null,"sourcing_currency": Database["public"]['Enums']["currency_code"],"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "fx_rate"?: number,"product_id": string,"sourcing_cost"?: number,"sourcing_cost_dzd"?: never,"sourcing_currency"?: Database["public"]['Enums']["currency_code"],"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "fx_rate"?: number,"product_id"?: string,"sourcing_cost"?: number,"sourcing_cost_dzd"?: never,"sourcing_currency"?: Database["public"]['Enums']["currency_code"],"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_costs_product_id_fkey"
      columns: ["product_id"]
isOneToOne: true
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_costs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_option_values": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"option_id": string,"position": number,"product_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"option_id": string,"position"?: number,"product_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"option_id"?: string,"position"?: number,"product_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_option_values_option_id_product_id_fkey"
      columns: ["option_id","product_id"]
isOneToOne: false
      referencedRelation: "product_options"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "product_option_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_option_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_option_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_option_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_option_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_option_values_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_options": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"position": number,"product_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"position"?: number,"product_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"position"?: number,"product_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_options_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_options_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_options_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_options_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_options_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_options_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_pricing": {
                  Row: {
                    "ad_best_usd": number | null,"ad_medium_usd": number | null,"ad_worst_usd": number | null,"final_price": number | null,"overrides": NonNullable<Json>,"product_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ad_best_usd"?: number | null,"ad_medium_usd"?: number | null,"ad_worst_usd"?: number | null,"final_price"?: number | null,"overrides"?: NonNullable<Json>,"product_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "ad_best_usd"?: number | null,"ad_medium_usd"?: number | null,"ad_worst_usd"?: number | null,"final_price"?: number | null,"overrides"?: NonNullable<Json>,"product_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_pricing_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_pricing_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_pricing_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_pricing_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_pricing_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_pricing_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_scenarios": {
                  Row: {
                    "created_at": string,"id": string,"inputs": NonNullable<Json>,"product_id": string | null,"slug": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"inputs"?: NonNullable<Json>,"product_id"?: string | null,"slug": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"inputs"?: NonNullable<Json>,"product_id"?: string | null,"slug"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_scenarios_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_scenarios_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_scenarios_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_scenarios_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "product_scenarios_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_scenarios_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variant_values": {
                  Row: {
                    "option_id": string,"product_id": string,"value_id": string,"variant_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "option_id": string,"product_id": string,"value_id": string,"variant_id": string,"workspace_id": string
                  }
                  Update: {
                    "option_id"?: string,"product_id"?: string,"value_id"?: string,"variant_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variant_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_variant_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variant_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variant_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variant_values_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_variant_values_value_id_product_id_option_id_fkey"
      columns: ["value_id","product_id","option_id"]
isOneToOne: false
      referencedRelation: "product_option_values"
      referencedColumns: ["id","product_id","option_id"]
    },{
      foreignKeyName: "product_variant_values_variant_id_product_id_fkey"
      columns: ["variant_id","product_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "product_variant_values_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variants": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"product_id": string,"sku": string | null,"stock": number,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"product_id": string,"sku"?: string | null,"stock"?: number,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"product_id"?: string,"sku"?: string | null,"stock"?: number,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_variants_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_variants_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variants_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variants_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "product_variants_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "product_variants_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category_option_id": string | null,"created_at": string,"created_by": string | null,"fabric_option_id": string | null,"id": string,"images": (string)[],"is_active": boolean,"low_stock_threshold": number,"name": string,"notes": string | null,"sale_price": number | null,"sku": string | null,"status": Database["public"]['Enums']["product_status"],"stock": number,"updated_at": string,"variants": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_option_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"fabric_option_id"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"low_stock_threshold"?: number,"name": string,"notes"?: string | null,"sale_price"?: number | null,"sku"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"stock"?: number,"updated_at"?: string,"variants"?: NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "category_option_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"fabric_option_id"?: string | null,"id"?: string,"images"?: (string)[],"is_active"?: boolean,"low_stock_threshold"?: number,"name"?: string,"notes"?: string | null,"sale_price"?: number | null,"sku"?: string | null,"status"?: Database["public"]['Enums']["product_status"],"stock"?: number,"updated_at"?: string,"variants"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_category_option_id_fkey"
      columns: ["category_option_id"]
isOneToOne: false
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_fabric_option_id_fkey"
      columns: ["fabric_option_id"]
isOneToOne: false
      referencedRelation: "options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"duty": string | null,"is_active": boolean,"role": Database["public"]['Enums']["app_role"],"updated_at": string,"user_id": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"duty"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id": string,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"duty"?: string | null,"is_active"?: boolean,"role"?: Database["public"]['Enums']["app_role"],"updated_at"?: string,"user_id"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"rules_docs": {
                  Row: {
                    "category": string | null,"content": string,"created_at": string,"id": string,"position": number,"title": string,"updated_at": string,"updated_by": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"position"?: number,"title": string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "category"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"position"?: number,"title"?: string,"updated_at"?: string,"updated_by"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rules_docs_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>,"workspace_id": string
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "count_id": string | null,"created_at": string,"created_by": string | null,"delta": number,"id": string,"note": string | null,"order_id": string | null,"product_id": string,"reason": Database["public"]['Enums']["stock_reason"],"variant_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta": number,"id"?: string,"note"?: string | null,"order_id"?: string | null,"product_id": string,"reason": Database["public"]['Enums']["stock_reason"],"variant_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "count_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"id"?: string,"note"?: string | null,"order_id"?: string | null,"product_id"?: string,"reason"?: Database["public"]['Enums']["stock_reason"],"variant_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_order_fk"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "stock_movements_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_variant_fk"
      columns: ["variant_id","product_id"]
isOneToOne: false
      referencedRelation: "product_variants"
      referencedColumns: ["id","product_id"]
    },{
      foreignKeyName: "stock_movements_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"store_pages": {
                  Row: {
                    "blocks": NonNullable<Json>,"created_at": string,"id": string,"kind": string,"product_id": string | null,"published_at": string | null,"seo": NonNullable<Json>,"slug": string,"status": string,"store_id": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"kind"?: string,"product_id"?: string | null,"published_at"?: string | null,"seo"?: NonNullable<Json>,"slug": string,"status"?: string,"store_id": string,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "blocks"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"kind"?: string,"product_id"?: string | null,"published_at"?: string | null,"seo"?: NonNullable<Json>,"slug"?: string,"status"?: string,"store_id"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_pages_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "store_pages_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "store_pages_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "store_pages_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id","workspace_id"]
    },{
      foreignKeyName: "store_pages_product_id_workspace_id_fkey"
      columns: ["product_id","workspace_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "store_pages_store_id_workspace_id_fkey"
      columns: ["store_id","workspace_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","workspace_id"]
    },{
      foreignKeyName: "store_pages_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"settings": NonNullable<Json>,"slug": string,"status": string,"theme": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"settings"?: NonNullable<Json>,"slug": string,"status"?: string,"theme"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"settings"?: NonNullable<Json>,"slug"?: string,"status"?: string,"theme"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "created_at": string,"created_by": string | null,"due_date": string | null,"id": string,"meeting_id": string | null,"owner": string | null,"priority": Database["public"]['Enums']["task_priority"],"product_id": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"meeting_id"?: string | null,"owner"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"product_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"due_date"?: string | null,"id"?: string,"meeting_id"?: string | null,"owner"?: string | null,"priority"?: Database["public"]['Enums']["task_priority"],"product_id"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stats"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_stages"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "tasks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "tasks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "product_variant_stock_v"
      referencedColumns: ["product_id"]
    },{
      foreignKeyName: "tasks_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "created_at": string,"error": string | null,"external_id": string | null,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": Database["public"]['Enums']["integration_provider"],"signature_ok": boolean,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"external_id"?: string | null,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": Database["public"]['Enums']["integration_provider"],"signature_ok"?: boolean,"workspace_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"external_id"?: string | null,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: Database["public"]['Enums']["integration_provider"],"signature_ok"?: boolean,"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "webhook_events_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"wilaya_communes": {
                  Row: {
                    "name": string,"updated_at": string,"wilaya_code": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"updated_at"?: string,"wilaya_code": number,"workspace_id": string
                  }
                  Update: {
                    "name"?: string,"updated_at"?: string,"wilaya_code"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wilaya_communes_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "wilaya_communes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"wilaya_fees": {
                  Row: {
                    "home_fee": number,"priced": boolean,"stop_shipping": boolean,"stopdesk_available": boolean,"stopdesk_fee": number,"updated_at": string,"wilaya_code": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "home_fee"?: number,"priced"?: boolean,"stop_shipping"?: boolean,"stopdesk_available"?: boolean,"stopdesk_fee"?: number,"updated_at"?: string,"wilaya_code": number,"workspace_id": string
                  }
                  Update: {
                    "home_fee"?: number,"priced"?: boolean,"stop_shipping"?: boolean,"stopdesk_available"?: boolean,"stopdesk_fee"?: number,"updated_at"?: string,"wilaya_code"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wilaya_fees_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "wilaya_fees_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"wilayas": {
                  Row: {
                    "code": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"name": string
                  }
                  Update: {
                    "code"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"zr_shipments": {
                  Row: {
                    "created_at": string,"is_return": boolean | null,"last_synced_at": string | null,"occurred_at": string | null,"order_id": string,"parcel_id": string,"pushed_at": string,"situation": string | null,"situation_at": string | null,"state": string | null,"state_slug": string | null,"state_updated_at": string | null,"tracking_number": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_return"?: boolean | null,"last_synced_at"?: string | null,"occurred_at"?: string | null,"order_id": string,"parcel_id": string,"pushed_at"?: string,"situation"?: string | null,"situation_at"?: string | null,"state"?: string | null,"state_slug"?: string | null,"state_updated_at"?: string | null,"tracking_number"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"is_return"?: boolean | null,"last_synced_at"?: string | null,"occurred_at"?: string | null,"order_id"?: string,"parcel_id"?: string,"pushed_at"?: string,"situation"?: string | null,"situation_at"?: string | null,"state"?: string | null,"state_slug"?: string | null,"state_updated_at"?: string | null,"tracking_number"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "zr_shipments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "zr_shipments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"zr_territories": {
                  Row: {
                    "code": number | null,"id": string,"level": string,"name": string,"parent_id": string | null,"synced_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: number | null,"id": string,"level": string,"name": string,"parent_id"?: string | null,"synced_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "code"?: number | null,"id"?: string,"level"?: string,"name"?: string,"parent_id"?: string | null,"synced_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "zr_territories_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string,"balance": number | null,"currency": Database["public"]['Enums']["currency_code"],"is_active": boolean,"low_balance_threshold": number,"name": string,"opening_balance": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "account_id"?: string | null,"balance"?: never,"currency"?: Database["public"]['Enums']["currency_code"] | null,"is_active"?: boolean | null,"low_balance_threshold"?: number | null,"name"?: string | null,"opening_balance"?: number | null,"workspace_id"?: string | null
                         }
                        Update: {
                           "account_id"?: string | null,"balance"?: never,"currency"?: Database["public"]['Enums']["currency_code"] | null,"is_active"?: boolean | null,"low_balance_threshold"?: number | null,"name"?: string | null,"opening_balance"?: number | null,"workspace_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "accounts_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"agent_performance": {
                  Row: {
                    "avg_decision_time": string | null,"avg_delivery_time": string | null,"avg_total_time": string | null,"confirmed": number | null,"delivered": number | null,"lost": number | null,"orders_handled": number | null,"stage": string,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"customer_stats": {
                  Row: {
                    "cancelled_orders": number | null,"commune": string | null,"confirmed_orders": number | null,"delivered_orders": number | null,"id": string,"name": string,"no_answer_orders": number | null,"phone": string,"returned_orders": number | null,"risk_score": number | null,"total_orders": number | null,"wilaya_code": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "customers_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "customers_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_stats": {
                  Row: {
                    "ad_spend_dzd": number | null,"confirmation_rate": number | null,"delivery_rate": number | null,"expenses_dzd": number | null,"id": string,"name": string,"orders_confirmed": number | null,"orders_delivered": number | null,"orders_received": number | null,"orders_returned": number | null,"revenue_dzd": number | null,"sourcing_cost_dzd": number | null,"status": Database["public"]['Enums']["product_status"],"stock": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_stock_stages": {
                  Row: {
                    "delivered": number | null,"in_stock": number,"on_road": number | null,"product_id": string,"reserved": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_stock_v": {
                  Row: {
                    "delivered": number | null,"in_stock": number,"low": boolean | null,"on_road": number | null,"product_id": string,"reserved": number | null,"sellable": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"product_variant_stock_v": {
                  Row: {
                    "count_needed": boolean | null,"not_assigned": number | null,"product_id": string,"total": number,"variant_count": number | null,"variants_total": number | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "products_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"wilaya_stats": {
                  Row: {
                    "confirmed_orders": number | null,"delivered_orders": number | null,"delivery_rate": number | null,"returned_orders": number | null,"stop_shipping_auto": boolean | null,"stop_shipping_manual": boolean | null,"total_orders": number | null,"wilaya_code": number | null,"wilaya_name": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "orders_wilaya_code_fkey"
      columns: ["wilaya_code"]
isOneToOne: false
      referencedRelation: "wilayas"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_performance": {
                  Row: {
                    "avg_decision_time": string | null,"avg_delivery_time": string | null,"avg_total_time": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "orders_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "apply_delivery_prices":
{ Args: { "p": Json }; Returns: Json
                           },
"apply_zr_state":
{ Args: { "p_is_return": boolean,"p_live"?: boolean,"p_occurred": string,"p_parcel": string,"p_situation": string,"p_slug": string,"p_state": string,"p_ws": string }; Returns: string
                           },
"audit_is_secret_key":
{ Args: { "k": string }; Returns: boolean
                           },
"audit_redact":
{ Args: { "j": Json }; Returns: Json
                           } |
{ Args: { "depth": number,"j": Json }; Returns: Json
                           },
"bootstrap_workspace":
{ Args: { "p_email": string,"p_workspace_name"?: string }; Returns: string
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"current_fx_rate":
{ Args: { "p_currency": Database["public"]['Enums']["currency_code"],"p_ws": string }; Returns: number
                           },
"current_workspace_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"dashboard_stats":
{ Args: { "p_agent"?: (string)[],"p_conf_agent"?: (string)[],"p_confirmation_status"?: (Database["public"]['Enums']["confirmation_status"])[],"p_deliv_agent"?: (string)[],"p_delivery_status"?: (Database["public"]['Enums']["delivery_status"])[],"p_from"?: string,"p_product"?: (string)[],"p_source"?: (Database["public"]['Enums']["order_source"])[],"p_to"?: string,"p_wilaya"?: (number)[] }; Returns: Json
                           },
"delivery_fee_for":
{ Args: { "p_type": string,"p_wilaya": number,"p_ws": string }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kpi_by_commune":
{ Args: { "p_from"?: string,"p_product"?: (string)[],"p_to"?: string,"p_wilaya": number }; Returns: {
              "commune": string,"commune_key": string,"extras": Json,"rates": Json
            }[]
                           },
"kpi_by_wilaya":
{ Args: { "p_from"?: string,"p_product"?: (string)[],"p_to"?: string }; Returns: {
              "extras": Json,"rates": Json,"wilaya_code": number,"wilaya_name": string
            }[]
                           },
"kpi_drill_orders":
{ Args: { "p_commune_key"?: string,"p_delivery_type"?: string,"p_from"?: string,"p_limit"?: number,"p_metric": string,"p_offset"?: number,"p_product"?: (string)[],"p_to"?: string,"p_unknown"?: boolean,"p_wilaya"?: number }; Returns: {
              "id": string,"total": number
            }[]
                           },
"kpi_group_extras":
{ Args: { "p_order_ids": (string)[] }; Returns: Json
                           },
"kpi_lines":
{ Args: { "p_filtered": boolean,"p_from": string,"p_order_ids": (string)[],"p_product": (string)[],"p_to": string }; Returns: Json
                           },
"kpi_metric":
{ Args: { "p_den": number,"p_num": number,"p_unresolved": number }; Returns: Json
                           },
"kpi_order_set":
{ Args: { "p_from"?: string,"p_product"?: (string)[],"p_to"?: string }; Returns: {
              "id": string
            }[]
                           },
"kpi_rates":
{ Args: { "p_from"?: string,"p_order_ids": (string)[],"p_to"?: string }; Returns: Json
                           },
"kpi_summary":
{ Args: { "p_from"?: string,"p_product"?: string,"p_to"?: string }; Returns: Json
                           },
"normalize_dz_phone":
{ Args: { "p": string }; Returns: string
                           },
"order_stock_target":
{ Args: { "p_confirmation": Database["public"]['Enums']["confirmation_status"],"p_linked_original": boolean,"p_qty": number,"p_replacement": boolean,"p_status": Database["public"]['Enums']["delivery_status"] }; Returns: number
                           },
"pnl_by_product":
{ Args: { "p_from"?: string,"p_to"?: string }; Returns: {
              "kpi": Json,"pnl": Json,"product_id": string
            }[]
                           },
"pnl_lines":
{ Args: { "p_filtered": boolean,"p_from": string,"p_order_ids": (string)[],"p_product": (string)[],"p_to": string }; Returns: Json
                           },
"pnl_summary":
{ Args: { "p_from"?: string,"p_product"?: string,"p_to"?: string }; Returns: Json
                           },
"save_variant_config":
{ Args: { "p_config": Json,"p_product": string }; Returns: undefined
                           },
"seed_workspace":
{ Args: { "p_ws": string }; Returns: undefined
                           },
"stock_count_variants":
{ Args: { "p_counts": Json,"p_product": string }; Returns: number
                           },
"stock_order_reasons":
{ Args: Record<PropertyKey, never>; Returns: (Database["public"]['Enums']["stock_reason"])[]
                           },
"stock_reconcile_order":
{ Args: { "p_old_confirmation"?: Database["public"]['Enums']["confirmation_status"],"p_old_status": Database["public"]['Enums']["delivery_status"],"p_order_id": string,"p_product": string,"p_reason": Database["public"]['Enums']["stock_reason"] }; Returns: undefined
                           },
"swap_order":
{ Args: { "p_address": string,"p_commune": string,"p_customer_id": string,"p_customer_name": string,"p_customer_phone": string,"p_order_id": string,"p_wilaya_code": number }; Returns: string
                           },
"transition_order_status":
{ Args: { "p_confirmation_comment"?: string,"p_confirmation_status"?: Database["public"]['Enums']["confirmation_status"],"p_delivery_status"?: Database["public"]['Enums']["delivery_status"],"p_order_id": string }; Returns: boolean
                           },
"variant_label":
{ Args: { "p_variant": string }; Returns: string
                           }
          }
          Enums: {
            "ad_kind": "test"|"scaling","app_role": "admin"|"confirmation_agent"|"delivery_agent","cash_status": "collected"|"deposited","confirmation_status": "wait_for_confirmation"|"no_answer"|"closed_phone"|"cancelled"|"confirmed","currency_code": "DZD"|"USD"|"EUR","delivery_fee_source": "payload"|"wilaya_table"|"manual","delivery_status": "wait_for_deposit"|"bureau_deposited"|"in_transit"|"out_for_delivery"|"stop_desk_waiting"|"delivered"|"cancelled"|"delayed"|"returning"|"returned"|"exchange"|"swap","delivery_type": "home"|"stopdesk","expense_category": "shooting"|"packaging"|"sampling"|"confirmation"|"delivery"|"test_ads"|"scaling_ads"|"other","integration_provider": "shopify"|"lightfunnels"|"zrexpress","meeting_status": "planned"|"held"|"cancelled","order_source": "shopify"|"lightfunnels"|"manual","product_status": "to_be_tested"|"tested"|"confirmed"|"cancelled","stock_reason": "purchase"|"correction"|"delivered"|"returned"|"order_confirmed"|"order_reverted"|"order_returned"|"order_stock_sync"|"order_swapped"|"order_shipped"|"stock_count","supplier_type": "shooting_studio"|"atelier_couture"|"emballage"|"other","task_priority": "low"|"medium"|"high","task_status": "todo"|"doing"|"blocked"|"done"
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
            "ad_kind": ["test", "scaling"],"app_role": ["admin", "confirmation_agent", "delivery_agent"],"cash_status": ["collected", "deposited"],"confirmation_status": ["wait_for_confirmation", "no_answer", "closed_phone", "cancelled", "confirmed"],"currency_code": ["DZD", "USD", "EUR"],"delivery_fee_source": ["payload", "wilaya_table", "manual"],"delivery_status": ["wait_for_deposit", "bureau_deposited", "in_transit", "out_for_delivery", "stop_desk_waiting", "delivered", "cancelled", "delayed", "returning", "returned", "exchange", "swap"],"delivery_type": ["home", "stopdesk"],"expense_category": ["shooting", "packaging", "sampling", "confirmation", "delivery", "test_ads", "scaling_ads", "other"],"integration_provider": ["shopify", "lightfunnels", "zrexpress"],"meeting_status": ["planned", "held", "cancelled"],"order_source": ["shopify", "lightfunnels", "manual"],"product_status": ["to_be_tested", "tested", "confirmed", "cancelled"],"stock_reason": ["purchase", "correction", "delivered", "returned", "order_confirmed", "order_reverted", "order_returned", "order_stock_sync", "order_swapped", "order_shipped", "stock_count"],"supplier_type": ["shooting_studio", "atelier_couture", "emballage", "other"],"task_priority": ["low", "medium", "high"],"task_status": ["todo", "doing", "blocked", "done"]
          }
        }
} as const
