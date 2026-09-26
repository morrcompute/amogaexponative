export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          username: string | null;
          display_name?: string | null;
          avatar: string | null;
          avatar_url?: string | null;
          email: string | null;
          company: string | null;
          mobile: string | null;
          fcm_token: string | null;
          status: string | null;
          online: boolean;
          offline: boolean;
          last_seen: string | null;
          lastSeen?: string | null;
          onboarded?: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          name?: string | null;
          username?: string | null;
          display_name?: string | null;
          avatar?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          company?: string | null;
          mobile?: string | null;
          fcm_token?: string | null;
          status?: string | null;
          online?: boolean;
          offline?: boolean;
          last_seen?: string | null;
          lastSeen?: string | null;
          onboarded?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          username?: string | null;
          display_name?: string | null;
          avatar?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          company?: string | null;
          mobile?: string | null;
          fcm_token?: string | null;
          status?: string | null;
          online?: boolean;
          offline?: boolean;
          last_seen?: string | null;
          lastSeen?: string | null;
          onboarded?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };


      conversations: {
        Row: {
          id: string;
          type: 'direct' | 'group' | 'channel_group' | 'message_group';
          name: string | null;
          image: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: 'direct' | 'group' | 'channel_group' | 'message_group';
          name?: string | null;
          image?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'direct' | 'group' | 'channel_group' | 'message_group';
          name?: string | null;
          image?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: string;
          unread_count: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          role?: string;
          unread_count?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          role?: string;
          unread_count?: number;
          joined_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          owner_user_id: string;
          sender_user_id: string | null;
          message: string | null;
          message_type: string;
          direction: 'Sent' | 'Received';
          sent: boolean;
          received: boolean;
          created_at: string;
          file_url: string | null;
          file_name: string | null;
          file_size: number | null;
          mime_type: string | null;
          duration: number | null;
          thumbnail: string | null;
          thumb: boolean;
          favorite: boolean;
          flag: boolean;
          star: boolean;
          pin: boolean;
          archive: boolean;
          deleted: boolean;
          action_this: boolean;
          reply: boolean;
          forward: boolean;
          deleted_at: string | null;
          deleted_by: string | null;
          replyemoji: string | null;
          replyto_message_id: string | null;
          replyto_user_id: string | null;
          parent_message_id: string | null;
          forwardemoji: string | null;
          forwardto_message_id: string | null;
          forwardto_user_id: string | null;
          sender_message_id: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          owner_user_id: string;
          sender_user_id?: string | null;
          message?: string | null;
          message_type?: string;
          direction: 'Sent' | 'Received';
          sent?: boolean;
          received?: boolean;
          created_at?: string;
          file_url?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          duration?: number | null;
          thumbnail?: string | null;
          thumb?: boolean;
          favorite?: boolean;
          flag?: boolean;
          star?: boolean;
          pin?: boolean;
          archive?: boolean;
          deleted?: boolean;
          action_this?: boolean;
          reply?: boolean;
          forward?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          replyemoji?: string | null;
          replyto_message_id?: string | null;
          replyto_user_id?: string | null;
          parent_message_id?: string | null;
          forwardemoji?: string | null;
          forwardto_message_id?: string | null;
          forwardto_user_id?: string | null;
          sender_message_id?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          owner_user_id?: string;
          sender_user_id?: string | null;
          message?: string | null;
          message_type?: string;
          direction?: 'Sent' | 'Received';
          sent?: boolean;
          received?: boolean;
          created_at?: string;
          file_url?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          mime_type?: string | null;
          duration?: number | null;
          thumbnail?: string | null;
          thumb?: boolean;
          favorite?: boolean;
          flag?: boolean;
          star?: boolean;
          pin?: boolean;
          archive?: boolean;
          deleted?: boolean;
          action_this?: boolean;
          reply?: boolean;
          forward?: boolean;
          deleted_at?: string | null;
          deleted_by?: string | null;
          replyemoji?: string | null;
          replyto_message_id?: string | null;
          replyto_user_id?: string | null;
          parent_message_id?: string | null;
          forwardemoji?: string | null;
          forwardto_message_id?: string | null;
          forwardto_user_id?: string | null;
          sender_message_id?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          owner_id: string;
          contact_user_id: string;
          nickname: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          contact_user_id: string;
          nickname?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          contact_user_id?: string;
          nickname?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_group: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          users: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          users?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          users?: Json;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          text: string;
          is_complete: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          text: string;
          is_complete?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          text?: string;
          is_complete?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_push_tokens: {
        Row: {
          id?: string;
          user_id: string | null;
          user_email: string;
          expo_push_token: string;
          device_type: string | null;
          device_name: string | null;
          is_active: boolean;
          created_at?: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_email?: string;
          expo_push_token: string;
          device_type?: string | null;
          device_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_email?: string;
          expo_push_token?: string;
          device_type?: string | null;
          device_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_conversation_member: {
        Args: {
          convo_id: string;
          user_uuid: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
        Database['public']['Views'])
    ? (Database['public']['Tables'] &
        Database['public']['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
    ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database['public']['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
    ? Database['public']['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof Database['public']['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof Database['public']['CompositeTypes']
    ? Database['public']['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationMember = Database['public']['Tables']['conversation_members']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type Contact = Database['public']['Tables']['contacts']['Row'];
export type ChatGroup = Database['public']['Tables']['chat_group']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
