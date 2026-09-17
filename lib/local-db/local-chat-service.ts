import { getLocalDatabase } from './sqlite-db';
import type {
  LocalConversationRecord,
  LocalChatMessageRecord,
  LocalContactRecord,
} from './types';

export class LocalChatService {
  /**
   * Save or update a single conversation in local database
   */
  static async saveConversation(convo: LocalConversationRecord): Promise<void> {
    const db = await getLocalDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `
      INSERT INTO local_conversations (
        id, type, name, image, created_by, created_at, updated_at,
        unread_count, last_message_text, last_message_time,
        other_member_json, members_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        name = COALESCE(excluded.name, local_conversations.name),
        image = COALESCE(excluded.image, local_conversations.image),
        updated_at = excluded.updated_at,
        unread_count = excluded.unread_count,
        last_message_text = COALESCE(excluded.last_message_text, local_conversations.last_message_text),
        last_message_time = COALESCE(excluded.last_message_time, local_conversations.last_message_time),
        other_member_json = COALESCE(excluded.other_member_json, local_conversations.other_member_json),
        members_count = COALESCE(excluded.members_count, local_conversations.members_count)
    `,
      [
        convo.id,
        convo.type,
        convo.name || null,
        convo.image || null,
        convo.created_by || null,
        convo.created_at || now,
        convo.updated_at || now,
        convo.unread_count || 0,
        convo.last_message_text || null,
        convo.last_message_time || now,
        convo.other_member_json || null,
        convo.members_count || 2,
      ]
    );
  }

  /**
   * Bulk save conversations from Supabase / Remote sync
   */
  static async saveConversations(convos: LocalConversationRecord[]): Promise<void> {
    for (const c of convos) {
      await this.saveConversation(c);
    }
  }

  /**
   * Fetch all cached local conversations sorted by latest activity
   */
  static async getConversations(_userId?: string): Promise<LocalConversationRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_conversations ORDER BY updated_at DESC`
    );
    return (rows || []).map((row: any) => ({
      ...row,
      unread_count: Number(row.unread_count || 0),
      members_count: Number(row.members_count || 2),
    }));
  }

  /**
   * Get single conversation by ID
   */
  static async getConversation(convoId: string): Promise<LocalConversationRecord | null> {
    const db = await getLocalDatabase();
    const row = await db.getFirstAsync(
      `SELECT * FROM local_conversations WHERE id = ? LIMIT 1`,
      [convoId]
    );
    if (!row) return null;
    return {
      ...row,
      unread_count: Number(row.unread_count || 0),
      members_count: Number(row.members_count || 2),
    };
  }

  /**
   * Save a single chat message locally and update the parent conversation's preview snippet
   */
  static async saveMessage(msg: LocalChatMessageRecord): Promise<void> {
    const db = await getLocalDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `
      INSERT INTO local_chat_messages (
        id, conversation_id, owner_user_id, sender_user_id,
        message, message_type, direction, sent, received,
        created_at, file_url, file_name, file_size, mime_type,
        duration, thumbnail, is_read, is_starred, is_pinned,
        is_deleted, sync_status, replyto_message_id, replyto_user_id,
        replyto_content, replyemoji, forwardto_message_id, sender_message_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        message = excluded.message,
        direction = excluded.direction,
        sent = excluded.sent,
        received = excluded.received,
        file_url = COALESCE(excluded.file_url, local_chat_messages.file_url),
        file_name = COALESCE(excluded.file_name, local_chat_messages.file_name),
        file_size = COALESCE(excluded.file_size, local_chat_messages.file_size),
        is_read = excluded.is_read,
        is_starred = excluded.is_starred,
        is_pinned = excluded.is_pinned,
        is_deleted = excluded.is_deleted,
        sync_status = excluded.sync_status
    `,
      [
        msg.id,
        msg.conversation_id,
        msg.owner_user_id,
        msg.sender_user_id,
        msg.message || '',
        msg.message_type || 'text',
        msg.direction,
        msg.sent ? 1 : 0,
        msg.received ? 1 : 0,
        msg.created_at || now,
        msg.file_url || null,
        msg.file_name || null,
        msg.file_size || null,
        msg.mime_type || null,
        msg.duration || null,
        msg.thumbnail || null,
        msg.is_read ? 1 : 0,
        msg.is_starred ? 1 : 0,
        msg.is_pinned ? 1 : 0,
        msg.is_deleted ? 1 : 0,
        msg.sync_status || 'synced',
        msg.replyto_message_id || null,
        msg.replyto_user_id || null,
        msg.replyto_content || null,
        msg.replyemoji || null,
        msg.forwardto_message_id || null,
        msg.sender_message_id || null,
      ]
    );

    // Update parent conversation preview if this is an active, non-deleted message
    if (!msg.is_deleted) {
      await db.runAsync(
        `
        UPDATE local_conversations
        SET last_message_text = ?,
            last_message_time = ?,
            updated_at = ?
        WHERE id = ?
      `,
        [msg.message || `[${msg.message_type || 'File'}]`, msg.created_at || now, msg.created_at || now, msg.conversation_id]
      );
    }
  }

  /**
   * Bulk save messages from Supabase or background sync
   */
  static async saveMessages(msgs: LocalChatMessageRecord[]): Promise<void> {
    for (const m of msgs) {
      await this.saveMessage(m);
    }
  }

  /**
   * Fetch conversation messages sorted chronologically (created_at ASC)
   */
  static async getMessages(
    conversationId: string,
    _userId?: string,
    limit: number = 100
  ): Promise<LocalChatMessageRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `
      SELECT * FROM local_chat_messages
      WHERE conversation_id = ? AND is_deleted = 0
      ORDER BY created_at ASC
      LIMIT ?
    `,
      [conversationId, limit]
    );

    return (rows || []).map((row: any) => ({
      ...row,
      sent: Boolean(row.sent),
      received: Boolean(row.received),
      is_read: Boolean(row.is_read),
      is_starred: Boolean(row.is_starred),
      is_pinned: Boolean(row.is_pinned),
      is_deleted: Boolean(row.is_deleted),
    }));
  }

  /**
   * Mark message or sync state
   */
  static async updateMessageStatus(
    messageId: string,
    updates: Partial<LocalChatMessageRecord>
  ): Promise<void> {
    const db = await getLocalDatabase();
    if (updates.sync_status) {
      await db.runAsync(
        `UPDATE local_chat_messages SET sync_status = ? WHERE id = ?`,
        [updates.sync_status, messageId]
      );
    }
    if (updates.is_read !== undefined) {
      await db.runAsync(
        `UPDATE local_chat_messages SET is_read = ? WHERE id = ?`,
        [updates.is_read ? 1 : 0, messageId]
      );
    }
  }

  /**
   * Soft delete a message locally
   */
  static async deleteMessage(messageId: string): Promise<void> {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE local_chat_messages SET is_deleted = 1 WHERE id = ?`,
      [messageId]
    );
  }

  /**
   * Save a local contact
   */
  static async saveContact(contact: LocalContactRecord): Promise<void> {
    const db = await getLocalDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `
      INSERT INTO local_contacts (
        id, owner_id, contact_user_id, name, nickname,
        email, mobile, avatar, avatar_url, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        nickname = excluded.nickname,
        email = excluded.email,
        mobile = excluded.mobile,
        avatar = excluded.avatar,
        avatar_url = excluded.avatar_url,
        status = excluded.status
    `,
      [
        contact.id,
        contact.owner_id,
        contact.contact_user_id,
        contact.name || null,
        contact.nickname || null,
        contact.email || null,
        contact.mobile || null,
        contact.avatar || null,
        contact.avatar_url || null,
        contact.status || 'offline',
        contact.created_at || now,
      ]
    );
  }

  /**
   * Get all local contacts for a user
   */
  static async getContacts(ownerId: string): Promise<LocalContactRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_contacts WHERE owner_id = ? ORDER BY name ASC`,
      [ownerId]
    );
    return rows || [];
  }
}
