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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_details: Json | null
          action_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_details?: Json | null
          action_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_details?: Json | null
          action_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deductions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          deduction_type: string
          driver_id: string
          id: string
          reason: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          deduction_type: string
          driver_id: string
          id?: string
          reason: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          deduction_type?: string
          driver_id?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "deductions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatchers: {
        Row: {
          active: boolean
          admin_commission_percentage: number
          contact_email: string
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          rate_per_parcel: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          admin_commission_percentage?: number
          contact_email: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          rate_per_parcel?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          admin_commission_percentage?: number
          contact_email?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          rate_per_parcel?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          document_type: string
          driver_id: string
          file_name: string
          file_url: string
          id: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          document_type: string
          driver_id: string
          file_name: string
          file_url: string
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          document_type?: string
          driver_id?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_training_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          driver_id: string
          id: string
          notes: string | null
          training_item_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          training_item_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          training_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_training_progress_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_training_progress_training_item_id_fkey"
            columns: ["training_item_id"]
            isOneToOne: false
            referencedRelation: "training_items"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean | null
          address: string | null
          contact_phone: string | null
          created_at: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          license_number: string | null
          name: string
          onboarded_at: string | null
          onboarded_by: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          license_number?: string | null
          name: string
          onboarded_at?: string | null
          onboarded_by?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          contact_phone?: string | null
          created_at?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          license_number?: string | null
          name?: string
          onboarded_at?: string | null
          onboarded_by?: string | null
        }
        Relationships: []
      }
      earnings: {
        Row: {
          created_at: string | null
          driver_id: string
          gross_amount: number
          id: string
          route_count: number | null
          updated_at: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          gross_amount?: number
          id?: string
          route_count?: number | null
          updated_at?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          gross_amount?: number
          id?: string
          route_count?: number | null
          updated_at?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          cost: number
          created_at: string | null
          driver_id: string
          id: string
          reason: string
          receipt_image_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["expense_status"]
        }
        Insert: {
          cost: number
          created_at?: string | null
          driver_id: string
          id?: string
          reason: string
          receipt_image_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
        }
        Update: {
          cost?: number
          created_at?: string | null
          driver_id?: string
          id?: string
          reason?: string
          receipt_image_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
        }
        Relationships: []
      }
      incidents: {
        Row: {
          created_at: string | null
          description: string
          driver_id: string
          id: string
          photo_url: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          driver_id: string
          id?: string
          photo_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          driver_id?: string
          id?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          admin_alerts: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          id: string
          incident_alerts: boolean | null
          push_notifications: boolean | null
          route_change_alerts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_alerts?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          incident_alerts?: boolean | null
          push_notifications?: boolean | null
          route_change_alerts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_alerts?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          incident_alerts?: boolean | null
          push_notifications?: boolean | null
          route_change_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      onboarding_sessions: {
        Row: {
          address: string | null
          completed: boolean | null
          completed_at: string | null
          contact_phone: string | null
          created_at: string | null
          current_step: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string | null
          id: string
          lease_start_date: string | null
          license_document_url: string | null
          license_expiry: string | null
          license_number: string | null
          preferred_vehicle_type: string | null
          proof_of_address_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          right_to_work_url: string | null
          status: string
          updated_at: string | null
          user_id: string
          vehicle_insurance_url: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_ownership_type: string
          vehicle_registration: string | null
          vehicle_registration_url: string | null
          vehicle_year: number | null
        }
        Insert: {
          address?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_step?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id?: string
          lease_start_date?: string | null
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          preferred_vehicle_type?: string | null
          proof_of_address_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_to_work_url?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          vehicle_insurance_url?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_ownership_type: string
          vehicle_registration?: string | null
          vehicle_registration_url?: string | null
          vehicle_year?: number | null
        }
        Update: {
          address?: string | null
          completed?: boolean | null
          completed_at?: string | null
          contact_phone?: string | null
          created_at?: string | null
          current_step?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string | null
          id?: string
          lease_start_date?: string | null
          license_document_url?: string | null
          license_expiry?: string | null
          license_number?: string | null
          preferred_vehicle_type?: string | null
          proof_of_address_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          right_to_work_url?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          vehicle_insurance_url?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_ownership_type?: string
          vehicle_registration?: string | null
          vehicle_registration_url?: string | null
          vehicle_year?: number | null
        }
        Relationships: []
      }
      pay_statements: {
        Row: {
          created_at: string | null
          driver_id: string
          gross_earnings: number
          id: string
          net_payout: number
          paid_at: string | null
          payment_reference: string | null
          period_end: string
          period_start: string
          status: string
          total_deductions: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          gross_earnings?: number
          id?: string
          net_payout?: number
          paid_at?: string | null
          payment_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          total_deductions?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          gross_earnings?: number
          id?: string
          net_payout?: number
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_deductions?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_statements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          address: string
          amazon_rate_per_parcel: number | null
          created_at: string | null
          customer_name: string
          delivery_notes: string | null
          dispatcher_id: string | null
          driver_id: string
          id: string
          package_type: string | null
          parcel_count_total: number | null
          parcels_delivered: number | null
          postcodes_covered: string[] | null
          scheduled_date: string
          status: string | null
          time_window: string
          updated_at: string | null
        }
        Insert: {
          address: string
          amazon_rate_per_parcel?: number | null
          created_at?: string | null
          customer_name: string
          delivery_notes?: string | null
          dispatcher_id?: string | null
          driver_id: string
          id?: string
          package_type?: string | null
          parcel_count_total?: number | null
          parcels_delivered?: number | null
          postcodes_covered?: string[] | null
          scheduled_date?: string
          status?: string | null
          time_window: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          amazon_rate_per_parcel?: number | null
          created_at?: string | null
          customer_name?: string
          delivery_notes?: string | null
          dispatcher_id?: string | null
          driver_id?: string
          id?: string
          package_type?: string | null
          parcel_count_total?: number | null
          parcels_delivered?: number | null
          postcodes_covered?: string[] | null
          scheduled_date?: string
          status?: string | null
          time_window?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_dispatcher_id_fkey"
            columns: ["dispatcher_id"]
            isOneToOne: false
            referencedRelation: "dispatchers"
            referencedColumns: ["id"]
          },
        ]
      }
      training_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_order: number
          required: boolean | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_order?: number
          required?: boolean | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_order?: number
          required?: boolean | null
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      complete_onboarding: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      get_available_roles: {
        Args: never
        Returns: {
          role_name: string
        }[]
      }
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          roles: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: {
          p_action_details?: Json
          p_action_type: string
          p_resource_id?: string
          p_resource_type?: string
        }
        Returns: string
      }
      log_document_access: {
        Args: { p_document_type: string; p_session_id: string }
        Returns: undefined
      }
      remove_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "driver" | "onboarding" | "finance"
      expense_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "dispatcher", "driver", "onboarding", "finance"],
      expense_status: ["pending", "approved", "rejected"],
    },
  },
} as const
