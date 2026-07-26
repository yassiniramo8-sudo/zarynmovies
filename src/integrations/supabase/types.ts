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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ad_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          ad_id: string | null
          created_at: string
          details: Json | null
          id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          ad_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          ad_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      ad_global_settings: {
        Row: {
          ad_intensity: number
          ads_enabled: boolean
          affiliate_ads_enabled: boolean
          created_at: string
          debug_mode: boolean
          emergency_hide: boolean
          google_ads_enabled: boolean
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ad_intensity?: number
          ads_enabled?: boolean
          affiliate_ads_enabled?: boolean
          created_at?: string
          debug_mode?: boolean
          emergency_hide?: boolean
          google_ads_enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ad_intensity?: number
          ads_enabled?: boolean
          affiliate_ads_enabled?: boolean
          created_at?: string
          debug_mode?: boolean
          emergency_hide?: boolean
          google_ads_enabled?: boolean
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ad_placement_settings: {
        Row: {
          created_at: string
          enabled: boolean
          intensity: number
          note: string | null
          placement: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          intensity?: number
          note?: string | null
          placement: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          intensity?: number
          note?: string | null
          placement?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          ab_group: string | null
          active: boolean
          ad_type: string
          clicks_count: number
          content_html: string | null
          created_at: string
          created_by: string | null
          device_targeting: string[]
          end_at: string | null
          hide_for_vip: boolean
          id: string
          image_url: string | null
          impressions_count: number
          language: string | null
          link_url: string | null
          max_clicks: number | null
          max_impressions: number | null
          placement: string
          priority: number
          sort_order: number
          start_at: string | null
          target_content_id: string | null
          target_content_type: string | null
          target_pages: string[] | null
          title: string
          trigger_config: Json
          updated_at: string
          user_type: string
        }
        Insert: {
          ab_group?: string | null
          active?: boolean
          ad_type?: string
          clicks_count?: number
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          device_targeting?: string[]
          end_at?: string | null
          hide_for_vip?: boolean
          id?: string
          image_url?: string | null
          impressions_count?: number
          language?: string | null
          link_url?: string | null
          max_clicks?: number | null
          max_impressions?: number | null
          placement?: string
          priority?: number
          sort_order?: number
          start_at?: string | null
          target_content_id?: string | null
          target_content_type?: string | null
          target_pages?: string[] | null
          title: string
          trigger_config?: Json
          updated_at?: string
          user_type?: string
        }
        Update: {
          ab_group?: string | null
          active?: boolean
          ad_type?: string
          clicks_count?: number
          content_html?: string | null
          created_at?: string
          created_by?: string | null
          device_targeting?: string[]
          end_at?: string | null
          hide_for_vip?: boolean
          id?: string
          image_url?: string | null
          impressions_count?: number
          language?: string | null
          link_url?: string | null
          max_clicks?: number | null
          max_impressions?: number | null
          placement?: string
          priority?: number
          sort_order?: number
          start_at?: string | null
          target_content_id?: string | null
          target_content_type?: string | null
          target_pages?: string[] | null
          title?: string
          trigger_config?: Json
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
      ai_chat_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_moderation_log: {
        Row: {
          action: string
          comment_id: string | null
          confidence: number | null
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          action?: string
          comment_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          action?: string
          comment_id?: string | null
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_moderation_log_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_site_logs: {
        Row: {
          auto_fixed: boolean | null
          category: string
          created_at: string
          description: string | null
          id: string
          log_type: string
          title: string
        }
        Insert: {
          auto_fixed?: boolean | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          log_type?: string
          title: string
        }
        Update: {
          auto_fixed?: boolean | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          log_type?: string
          title?: string
        }
        Relationships: []
      }
      anime: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          download_servers: Json | null
          episode_number: number | null
          gallery_images: string[] | null
          genre: string[] | null
          group_id: string | null
          id: string
          pinned: boolean | null
          poster_url: string | null
          rating: number | null
          title: string
          trailer_url: string | null
          trending: boolean | null
          updated_at: string
          vip_only: boolean
          watch_servers: Json | null
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_servers?: Json | null
          episode_number?: number | null
          gallery_images?: string[] | null
          genre?: string[] | null
          group_id?: string | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          watch_servers?: Json | null
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_servers?: Json | null
          episode_number?: number | null
          gallery_images?: string[] | null
          genre?: string[] | null
          group_id?: string | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title?: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          watch_servers?: Json | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anime_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "anime_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      anime_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          poster_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          poster_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          poster_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      archived_users: {
        Row: {
          archived_at: string
          archived_by: string | null
          avatar_url: string | null
          email: string | null
          id: string
          original_user_id: string
          reason: string | null
          subscription_expired_at: string | null
          subscription_plan: string | null
          username: string | null
          was_vip: boolean | null
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          avatar_url?: string | null
          email?: string | null
          id?: string
          original_user_id: string
          reason?: string | null
          subscription_expired_at?: string | null
          subscription_plan?: string | null
          username?: string | null
          was_vip?: boolean | null
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          avatar_url?: string | null
          email?: string | null
          id?: string
          original_user_id?: string
          reason?: string | null
          subscription_expired_at?: string | null
          subscription_plan?: string | null
          username?: string | null
          was_vip?: boolean | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          category: string | null
          content: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          featured: boolean
          id: string
          published_at: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      backgrounds: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          title?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          like_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          like_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          like_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          content_id: string
          content_type: string
          created_at: string
          highlight_color: string | null
          highlighted: boolean | null
          id: string
          parent_id: string | null
          pinned: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          content_id: string
          content_type: string
          created_at?: string
          highlight_color?: string | null
          highlighted?: boolean | null
          id?: string
          parent_id?: string | null
          pinned?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          content_id?: string
          content_type?: string
          created_at?: string
          highlight_color?: string | null
          highlighted?: boolean | null
          id?: string
          parent_id?: string | null
          pinned?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          admin_reply: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          replied_at: string | null
          replied_by: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          replied_at?: string | null
          replied_by?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      content_downloads: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          download_link: string | null
          id: string
          user_id: string | null
          user_ip: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          download_link?: string | null
          id?: string
          user_id?: string | null
          user_ip?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          download_link?: string | null
          id?: string
          user_id?: string | null
          user_ip?: string | null
        }
        Relationships: []
      }
      content_translations: {
        Row: {
          content: string | null
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          genre: string[] | null
          id: string
          language: string
          title: string
        }
        Insert: {
          content?: string | null
          content_id: string
          content_type: string
          created_at?: string
          description?: string | null
          genre?: string[] | null
          id?: string
          language: string
          title: string
        }
        Update: {
          content?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          genre?: string[] | null
          id?: string
          language?: string
          title?: string
        }
        Relationships: []
      }
      content_views: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string | null
          user_ip: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_ip?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_ip?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          body: string
          created_at: string
          id: string
          recipients_count: number | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          target_audience: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipients_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          target_audience?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipients_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          target_audience?: string
          updated_at?: string
        }
        Relationships: []
      }
      entertainment_api_keys: {
        Row: {
          api_key: string
          auto_use: boolean
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          source_name: string
          updated_at: string
        }
        Insert: {
          api_key: string
          auto_use?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          source_name: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          auto_use?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          description: string | null
          download_servers: Json | null
          episode_number: number
          id: string
          series_id: string
          thumbnail_url: string | null
          title: string
          trailer_url: string | null
          updated_at: string
          visible: boolean
          watch_servers: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          download_servers?: Json | null
          episode_number?: number
          id?: string
          series_id: string
          thumbnail_url?: string | null
          title: string
          trailer_url?: string | null
          updated_at?: string
          visible?: boolean
          watch_servers?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          download_servers?: Json | null
          episode_number?: number
          id?: string
          series_id?: string
          thumbnail_url?: string | null
          title?: string
          trailer_url?: string | null
          updated_at?: string
          visible?: boolean
          watch_servers?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          ai_generated: boolean | null
          categories: string[] | null
          created_at: string
          created_by: string | null
          description_ar: string | null
          description_en: string | null
          id: string
          match_date: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_slug: string | null
          seo_title: string | null
          source: string | null
          source_channel: string | null
          status: string
          summary_type: string
          tags: string[] | null
          teams: string[] | null
          thumbnail_url: string | null
          title_ar: string | null
          title_en: string
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          categories?: string[] | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          match_date?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_slug?: string | null
          seo_title?: string | null
          source?: string | null
          source_channel?: string | null
          status?: string
          summary_type?: string
          tags?: string[] | null
          teams?: string[] | null
          thumbnail_url?: string | null
          title_ar?: string | null
          title_en: string
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          categories?: string[] | null
          created_at?: string
          created_by?: string | null
          description_ar?: string | null
          description_en?: string | null
          id?: string
          match_date?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_slug?: string | null
          seo_title?: string | null
          source?: string | null
          source_channel?: string | null
          status?: string
          summary_type?: string
          tags?: string[] | null
          teams?: string[] | null
          thumbnail_url?: string | null
          title_ar?: string | null
          title_en?: string
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      home_collection_items: {
        Row: {
          collection_id: string
          content_id: string
          content_type: string
          created_at: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          collection_id: string
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          collection_id?: string
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "home_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      home_collections: {
        Row: {
          active: boolean
          banner_url: string | null
          created_at: string
          description_i18n: Json
          id: string
          logo_url: string | null
          slug: string
          sort_order: number
          theme_color: string | null
          title_i18n: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          banner_url?: string | null
          created_at?: string
          description_i18n?: Json
          id?: string
          logo_url?: string | null
          slug: string
          sort_order?: number
          theme_color?: string | null
          title_i18n?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          banner_url?: string | null
          created_at?: string
          description_i18n?: Json
          id?: string
          logo_url?: string | null
          slug?: string
          sort_order?: number
          theme_color?: string | null
          title_i18n?: Json
          updated_at?: string
        }
        Relationships: []
      }
      home_footer_links: {
        Row: {
          active: boolean
          created_at: string
          group_key: string
          href: string
          icon: string | null
          id: string
          label_i18n: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_key: string
          href: string
          icon?: string | null
          id?: string
          label_i18n?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_key?: string
          href?: string
          icon?: string | null
          id?: string
          label_i18n?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      home_section_items: {
        Row: {
          active: boolean
          content_id: string
          content_type: string
          created_at: string
          id: string
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_section_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "home_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      home_sections: {
        Row: {
          created_at: string
          created_by: string | null
          description_i18n: Json
          enabled: boolean
          id: string
          key: string
          settings: Json
          sort_order: number
          title_i18n: Json
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description_i18n?: Json
          enabled?: boolean
          id?: string
          key: string
          settings?: Json
          sort_order?: number
          title_i18n?: Json
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description_i18n?: Json
          enabled?: boolean
          id?: string
          key?: string
          settings?: Json
          sort_order?: number
          title_i18n?: Json
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string
          page_key: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          page_key: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string
          page_key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      likes: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      movies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          download_servers: Json | null
          gallery_images: string[] | null
          genre: string[] | null
          id: string
          pinned: boolean | null
          poster_url: string | null
          rating: number | null
          title: string
          trailer_url: string | null
          trending: boolean | null
          updated_at: string
          vip_only: boolean
          watch_servers: Json | null
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_servers?: Json | null
          gallery_images?: string[] | null
          genre?: string[] | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          watch_servers?: Json | null
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          download_servers?: Json | null
          gallery_images?: string[] | null
          genre?: string[] | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title?: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          watch_servers?: Json | null
          year?: number | null
        }
        Relationships: []
      }
      news_sources: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          fetch_interval_hours: number
          id: string
          language: string | null
          last_fetched_at: string | null
          name: string
          sort_order: number
          source_type: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          fetch_interval_hours?: number
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          name: string
          sort_order?: number
          source_type?: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          fetch_interval_hours?: number
          id?: string
          language?: string | null
          last_fetched_at?: string | null
          name?: string
          sort_order?: number
          source_type?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      news_translations: {
        Row: {
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          language: string
          news_id: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          language: string
          news_id: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          language?: string
          news_id?: string
          title?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          link: string | null
          message: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      page_settings: {
        Row: {
          category: string
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          label: string
          redirect_to: string | null
          route_key: string
          show_in_footer: boolean
          show_in_nav: boolean
          show_in_sidebar: boolean
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          label: string
          redirect_to?: string | null
          route_key: string
          show_in_footer?: boolean
          show_in_nav?: boolean
          show_in_sidebar?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          label?: string
          redirect_to?: string | null
          route_key?: string
          show_in_footer?: boolean
          show_in_nav?: boolean
          show_in_sidebar?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          instructions: string | null
          name: string
          qr_image_url: string | null
          sort_order: number
          wallet_info: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          qr_image_url?: string | null
          sort_order?: number
          wallet_info?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          qr_image_url?: string | null
          sort_order?: number
          wallet_info?: string | null
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          options: Json
          poll_type: string
          question: string
          question_ar: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          options?: Json
          poll_type?: string
          question: string
          question_ar?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          options?: Json
          poll_type?: string
          question?: string
          question_ar?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          language_preference: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          language_preference?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          language_preference?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          max_uses: number | null
          user_id: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          max_uses?: number | null
          user_id: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          max_uses?: number | null
          user_id?: string
          uses?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_type: string
          reward_value: number
          rewarded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_type?: string
          reward_value?: number
          rewarded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_type?: string
          reward_value?: number
          rewarded?: boolean
        }
        Relationships: []
      }
      series: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          gallery_images: string[] | null
          genre: string[] | null
          id: string
          pinned: boolean | null
          poster_url: string | null
          rating: number | null
          title: string
          trailer_url: string | null
          trending: boolean | null
          updated_at: string
          vip_only: boolean
          visible: boolean
          year: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_images?: string[] | null
          genre?: string[] | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          visible?: boolean
          year?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_images?: string[] | null
          genre?: string[] | null
          id?: string
          pinned?: boolean | null
          poster_url?: string | null
          rating?: number | null
          title?: string
          trailer_url?: string | null
          trending?: boolean | null
          updated_at?: string
          vip_only?: boolean
          visible?: boolean
          year?: number | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      sitemap_urls: {
        Row: {
          active: boolean
          changefreq: string
          content_id: string | null
          content_type: string | null
          created_at: string
          id: string
          language: string | null
          last_modified: string
          priority: number
          title: string | null
          updated_at: string
          url: string
          url_type: string
        }
        Insert: {
          active?: boolean
          changefreq?: string
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_modified?: string
          priority?: number
          title?: string | null
          updated_at?: string
          url: string
          url_type?: string
        }
        Update: {
          active?: boolean
          changefreq?: string
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          id?: string
          language?: string | null
          last_modified?: string
          priority?: number
          title?: string | null
          updated_at?: string
          url?: string
          url_type?: string
        }
        Relationships: []
      }
      sports_news: {
        Row: {
          ai_generated: boolean | null
          category: string | null
          content: string | null
          content_ar: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          excerpt_ar: string | null
          id: string
          image_url: string | null
          published_at: string | null
          source_name: string | null
          source_url: string | null
          status: string
          tags: string[] | null
          title: string
          title_ar: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          category?: string | null
          content?: string | null
          content_ar?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          excerpt_ar?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          title_ar?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          category?: string | null
          content?: string | null
          content_ar?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          excerpt_ar?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          title_ar?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          features: Json
          id: string
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          name: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          features?: Json
          id?: string
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          payment_method_id: string
          plan_id: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          payment_method_id: string
          plan_id: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          payment_method_id?: string
          plan_id?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ad_settings: {
        Row: {
          adblock_enforcement: boolean
          ads_enabled: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adblock_enforcement?: boolean
          ads_enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adblock_enforcement?: boolean
          ads_enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          ban_type: string
          banned_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          ban_type: string
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          ban_type?: string
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notification_settings: {
        Row: {
          id: string
          notifications_paused: boolean
          pause_until: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          id?: string
          notifications_paused?: boolean
          pause_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          id?: string
          notifications_paused?: boolean
          pause_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_ratings: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          payment_method: string | null
          plan_id: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          payment_method?: string | null
          plan_id: string
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          payment_method?: string | null
          plan_id?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_history: {
        Row: {
          content_id: string
          content_type: string
          id: string
          user_id: string
          watched_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          id?: string
          user_id: string
          watched_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          id?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      watch_later: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_average_rating: {
        Args: { _content_id: string; _content_type: string }
        Returns: number
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ad_click: { Args: { _ad_id: string }; Returns: undefined }
      increment_ad_impression: { Args: { _ad_id: string }; Returns: undefined }
    }
    Enums: {
      app_permission:
        | "manage_movies"
        | "manage_anime"
        | "manage_articles"
        | "manage_backgrounds"
        | "moderate_comments"
        | "manage_users"
      app_role: "super_admin" | "admin" | "moderator" | "user"
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
      app_permission: [
        "manage_movies",
        "manage_anime",
        "manage_articles",
        "manage_backgrounds",
        "moderate_comments",
        "manage_users",
      ],
      app_role: ["super_admin", "admin", "moderator", "user"],
    },
  },
} as const
