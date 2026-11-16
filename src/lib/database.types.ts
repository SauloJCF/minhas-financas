
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
            "accounts": {
                  Row: {
                    "archived": boolean,"color": string,"created_at": string,"icon": string,"id": string,"initial_balance": number,"initial_balance_date": string,"name": string,"type": Database["public"]['Enums']["account_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"color": string,"created_at"?: string,"icon": string,"id"?: string,"initial_balance"?: number,"initial_balance_date"?: string,"name": string,"type": Database["public"]['Enums']["account_type"],"user_id"?: string
                  }
                  Update: {
                    "archived"?: boolean,"color"?: string,"created_at"?: string,"icon"?: string,"id"?: string,"initial_balance"?: number,"initial_balance_date"?: string,"name"?: string,"type"?: Database["public"]['Enums']["account_type"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "archived": boolean,"color": string,"created_at": string,"icon": string,"id": string,"name": string,"type": Database["public"]['Enums']["transaction_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"color": string,"created_at"?: string,"icon": string,"id"?: string,"name": string,"type": Database["public"]['Enums']["transaction_type"],"user_id"?: string
                  }
                  Update: {
                    "archived"?: boolean,"color"?: string,"created_at"?: string,"icon"?: string,"id"?: string,"name"?: string,"type"?: Database["public"]['Enums']["transaction_type"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transaction_series": {
                  Row: {
                    "created_at": string,"frequency": Database["public"]['Enums']["series_frequency"],"id": string,"installment_count": number | null,"kind": Database["public"]['Enums']["series_kind"],"start_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"frequency": Database["public"]['Enums']["series_frequency"],"id"?: string,"installment_count"?: number | null,"kind": Database["public"]['Enums']["series_kind"],"start_date": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"frequency"?: Database["public"]['Enums']["series_frequency"],"id"?: string,"installment_count"?: number | null,"kind"?: Database["public"]['Enums']["series_kind"],"start_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"amount": number,"category_id": string,"created_at": string,"description": string,"due_date": string,"group_id": string | null,"id": string,"installment_number": number | null,"notes": string | null,"paid_at": string | null,"type": Database["public"]['Enums']["transaction_type"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount": number,"category_id": string,"created_at"?: string,"description": string,"due_date": string,"group_id"?: string | null,"id"?: string,"installment_number"?: number | null,"notes"?: string | null,"paid_at"?: string | null,"type": Database["public"]['Enums']["transaction_type"],"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"amount"?: number,"category_id"?: string,"created_at"?: string,"description"?: string,"due_date"?: string,"group_id"?: string | null,"id"?: string,"installment_number"?: number | null,"notes"?: string | null,"paid_at"?: string | null,"type"?: Database["public"]['Enums']["transaction_type"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_account_fkey"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts_with_balance"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_category_fkey"
      columns: ["category_id","user_id","type"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id","type"]
    },{
      foreignKeyName: "transactions_series_fkey"
      columns: ["group_id","user_id"]
isOneToOne: false
      referencedRelation: "transaction_series"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"transfers": {
                  Row: {
                    "amount": number,"created_at": string,"date": string,"from_account_id": string,"id": string,"notes": string | null,"to_account_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"date": string,"from_account_id": string,"id"?: string,"notes"?: string | null,"to_account_id": string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"date"?: string,"from_account_id"?: string,"id"?: string,"notes"?: string | null,"to_account_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transfers_from_account_fkey"
      columns: ["from_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transfers_from_account_fkey"
      columns: ["from_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts_with_balance"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transfers_to_account_fkey"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transfers_to_account_fkey"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts_with_balance"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            "account_statement": {
                  Row: {
                    "account_id": string | null,"amount": number | null,"created_at": string | null,"date": string | null,"description": string | null,"id": string | null,"kind": string | null,"other_account_id": string | null,"settled": boolean | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"accounts_with_balance": {
                  Row: {
                    "archived": boolean,"color": string,"created_at": string,"current_balance": number | null,"forecast_balance": number | null,"icon": string,"id": string,"initial_balance": number,"initial_balance_date": string,"name": string,"type": Database["public"]['Enums']["account_type"],"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "create_default_categories":
{ Args: { "target_user_id": string }; Returns: undefined
                           },
"create_installments":
{ Args: { "p_account_id": string,"p_amount": number,"p_category_id": string,"p_count": number,"p_description": string,"p_due_date": string,"p_notes": string,"p_paid_at": string,"p_type": Database["public"]['Enums']["transaction_type"] }; Returns: string
                           },
"create_recurrence":
{ Args: { "p_account_id": string,"p_amount": number,"p_category_id": string,"p_description": string,"p_due_date": string,"p_frequency": Database["public"]['Enums']["series_frequency"],"p_notes": string,"p_paid_at": string,"p_type": Database["public"]['Enums']["transaction_type"] }; Returns: string
                           },
"extend_recurrence":
{ Args: { "p_series_id": string }; Returns: undefined
                           },
"series_due_date":
{ Args: { "frequency": Database["public"]['Enums']["series_frequency"],"occurrence": number,"start_date": string }; Returns: string
                           }
          }
          Enums: {
            "account_type": "corrente"|"poupanca"|"dinheiro"|"cartao"|"investimento","series_frequency": "weekly"|"monthly"|"yearly","series_kind": "recurrence"|"installment","transaction_type": "income"|"expense"
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
            "account_type": ["corrente", "poupanca", "dinheiro", "cartao", "investimento"],"series_frequency": ["weekly", "monthly", "yearly"],"series_kind": ["recurrence", "installment"],"transaction_type": ["income", "expense"]
          }
        }
} as const
