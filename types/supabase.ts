export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      credits: {
        Row: {
          created_at: string
          credits: number
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      images: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "images_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      models: {
        Row: {
          created_at: string
          id: number
          modelId: string | null
          name: string | null
          status: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          modelId?: string | null
          name?: string | null
          status?: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: string | null
          name?: string | null
          status?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      model_cleanup_log: {
        Row: {
          bytes_freed: number
          cleanup_reason: string | null
          cleanup_type: string
          created_at: string
          files_deleted: string[]
          id: string
          model_id: number | null
          performed_by: string | null
        }
        Insert: {
          bytes_freed?: number
          cleanup_reason?: string | null
          cleanup_type: string
          created_at?: string
          files_deleted?: string[]
          id?: string
          model_id?: number | null
          performed_by?: string | null
        }
        Update: {
          bytes_freed?: number
          cleanup_reason?: string | null
          cleanup_type?: string
          created_at?: string
          files_deleted?: string[]
          id?: string
          model_id?: number | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_cleanup_log_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_cleanup_log_performed_by_fkey"
            columns: ["performed_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      model_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          download_url: string | null
          error_message: string | null
          export_format: string
          export_status: string
          expires_at: string
          file_size: number | null
          id: string
          model_id: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          export_format?: string
          export_status?: string
          expires_at?: string
          file_size?: number | null
          id?: string
          model_id: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          export_format?: string
          export_status?: string
          expires_at?: string
          file_size?: number | null
          id?: string
          model_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_exports_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_exports_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      model_shares: {
        Row: {
          access_level: string
          created_at: string
          download_count: number
          expires_at: string | null
          id: string
          is_public: boolean
          last_accessed: string | null
          max_downloads: number | null
          model_id: number
          share_token: string | null
          shared_by: string
          shared_with: string | null
        }
        Insert: {
          access_level?: string
          created_at?: string
          download_count?: number
          expires_at?: string | null
          id?: string
          is_public?: boolean
          last_accessed?: string | null
          max_downloads?: number | null
          model_id: number
          share_token?: string | null
          shared_by: string
          shared_with?: string | null
        }
        Update: {
          access_level?: string
          created_at?: string
          download_count?: number
          expires_at?: string | null
          id?: string
          is_public?: boolean
          last_accessed?: string | null
          max_downloads?: number | null
          model_id?: number
          share_token?: string | null
          shared_by?: string
          shared_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_shares_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_shares_shared_by_fkey"
            columns: ["shared_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_shares_shared_with_fkey"
            columns: ["shared_with"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      model_weights: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_hash: string
          file_path: string
          file_size: number
          id: string
          is_active: boolean
          metadata: Json
          model_id: number
          quality_metrics: Json
          storage_provider: string
          training_config: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_hash: string
          file_path: string
          file_size: number
          id?: string
          is_active?: boolean
          metadata?: Json
          model_id: number
          quality_metrics?: Json
          storage_provider?: string
          training_config?: Json
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_hash?: string
          file_path?: string
          file_size?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          model_id?: number
          quality_metrics?: Json
          storage_provider?: string
          training_config?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "model_weights_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_weights_model_id_fkey"
            columns: ["model_id"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      samples: {
        Row: {
          created_at: string
          id: number
          modelId: number
          uri: string
        }
        Insert: {
          created_at?: string
          id?: number
          modelId: number
          uri: string
        }
        Update: {
          created_at?: string
          id?: number
          modelId?: number
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "samples_modelId_fkey"
            columns: ["modelId"]
            referencedRelation: "models"
            referencedColumns: ["id"]
          }
        ]
      }
      generation_jobs: {
        Row: {
          id: string
          user_id: string
          status: string
          progress: number
          progress_message: string | null
          reference_images: string[]
          num_outputs: number
          style_intensity: number | null
          output_images: string[] | null
          detected_features: Json | null
          generation_time_seconds: number | null
          estimated_cost_usd: number | null
          error_message: string | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          progress?: number
          progress_message?: string | null
          reference_images: string[]
          num_outputs?: number
          style_intensity?: number | null
          output_images?: string[] | null
          detected_features?: Json | null
          generation_time_seconds?: number | null
          estimated_cost_usd?: number | null
          error_message?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          progress?: number
          progress_message?: string | null
          reference_images?: string[]
          num_outputs?: number
          style_intensity?: number | null
          output_images?: string[] | null
          detected_features?: Json | null
          generation_time_seconds?: number | null
          estimated_cost_usd?: number | null
          error_message?: string | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      seedream_uploads: {
        Row: {
          id: string
          user_id: string
          images: Json
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          user_id: string
          images: Json
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          images?: Json
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seedream_uploads_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      seedream_jobs: {
        Row: {
          id: string
          user_id: string
          upload_id: string
          style_id: string
          num_outputs: number
          customizations: Json | null
          replicate_prediction_id: string | null
          status: string
          progress: number
          error_message: string | null
          output_images: Json | null
          generation_time_seconds: number | null
          estimated_cost_usd: number | null
          created_at: string
          started_at: string | null
          completed_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          upload_id: string
          style_id: string
          num_outputs?: number
          customizations?: Json | null
          replicate_prediction_id?: string | null
          status?: string
          progress?: number
          error_message?: string | null
          output_images?: Json | null
          generation_time_seconds?: number | null
          estimated_cost_usd?: number | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          upload_id?: string
          style_id?: string
          num_outputs?: number
          customizations?: Json | null
          replicate_prediction_id?: string | null
          status?: string
          progress?: number
          error_message?: string | null
          output_images?: Json | null
          generation_time_seconds?: number | null
          estimated_cost_usd?: number | null
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seedream_jobs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seedream_jobs_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "seedream_uploads"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_model_exports: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_model_shares: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_model_weights: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
