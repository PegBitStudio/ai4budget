/**
 * Supabase Database Types
 *
 * Manually generated to match the schema in supabase/migrations/001_initial_schema.sql.
 * These types provide full type safety for Supabase client queries.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          date: string;
          description: string;
          category: string;
          type: string;
          source: string | null;
          is_manual_category: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          date: string;
          description: string;
          category?: string;
          type: string;
          source?: string | null;
          is_manual_category?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          date?: string;
          description?: string;
          category?: string;
          type?: string;
          source?: string | null;
          is_manual_category?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          period_type: string;
          period_start: string;
          period_end: string;
          total_income: number;
          allocations: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_type: string;
          period_start: string;
          period_end: string;
          total_income: number;
          allocations?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_type?: string;
          period_start?: string;
          period_end?: string;
          total_income?: number;
          allocations?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          target_amount: number;
          deadline: string | null;
          current_amount: number;
          monthly_contribution: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_amount: number;
          deadline?: string | null;
          current_amount?: number;
          monthly_contribution?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_amount?: number;
          deadline?: string | null;
          current_amount?: number;
          monthly_contribution?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_goals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      commitments: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          amount: number;
          frequency: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          description: string;
          amount: number;
          frequency: string;
          category?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          description?: string;
          amount?: number;
          frequency?: string;
          category?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commitments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      spending_alerts: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          type: string;
          amount_spent: number;
          budgeted_amount: number;
          period_start: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category: string;
          type: string;
          amount_spent: number;
          budgeted_amount: number;
          period_start: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category?: string;
          type?: string;
          amount_spent?: number;
          budgeted_amount?: number;
          period_start?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "spending_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      classification_rules: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          description: string;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          description?: string;
          category?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_rules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases for common usage
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Named row types for direct imports
export type TransactionRow = Tables<"transactions">;
export type BudgetRow = Tables<"budgets">;
export type SavingsGoalRow = Tables<"savings_goals">;
export type CommitmentRow = Tables<"commitments">;
export type SpendingAlertRow = Tables<"spending_alerts">;
export type ClassificationRuleRow = Tables<"classification_rules">;
