import * as Crypto from 'expo-crypto';
import { getLocalDatabase } from './sqlite-db';
import type { AppNotificationRecord } from './types';
import { supabase } from '@/lib/supabase';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(val?: string | null): string | null {
  if (!val || typeof val !== 'string') return null;
  const trimmed = val.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function generateV4Uuid(): string {
  if (typeof Crypto.randomUUID === 'function') {
    try {
      const u = Crypto.randomUUID();
      if (UUID_REGEX.test(u)) {
        return u;
      }
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class LocalNotificationService {
  /**
   * Create a new notification and persist it to both Local SQLite and Supabase PostgreSQL.
   */
  static async createNotification(
    data: Partial<AppNotificationRecord>
  ): Promise<AppNotificationRecord> {
    const db = await getLocalDatabase();
    const nowIso = new Date().toISOString();
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const notifUuid = ensureValidUuid(data.app_notification_uuid) || generateV4Uuid();

    const record: AppNotificationRecord = {
      app_notification_uuid: notifUuid,
      status: data.status ?? 'sent',
      user_email_account_id: data.user_email_account_id ?? null,
      subject: data.subject ?? '(No Subject)',
      sender_email: data.sender_email ?? data.from_email ?? data.from_user_email ?? null,
      sender_name: data.sender_name ?? data.from_user_name ?? data.full_name ?? null,
      full_name: data.full_name ?? data.sender_name ?? data.from_fullname ?? null,
      sender_mobile: data.sender_mobile ?? data.from_mobile ?? data.from_user_mobile ?? null,
      recipient_mobiles: data.recipient_mobiles ?? data.to_mobile ?? data.to_user_mobile ?? null,
      cc_emails: data.cc_emails ?? null,
      bcc_emails: data.bcc_emails ?? null,
      body: data.body ?? '',
      is_read: data.is_read !== undefined ? (data.is_read ? 1 : 0) : 1,
      is_starred: data.is_starred !== undefined ? (data.is_starred ? 1 : 0) : 0,
      is_important: data.is_important !== undefined ? (data.is_important ? 1 : 0) : 0,
      is_draft: data.is_draft !== undefined ? (data.is_draft ? 1 : 0) : 0,
      is_deleted: 0,
      has_attachments: data.has_attachments !== undefined ? (data.has_attachments ? 1 : 0) : 0,
      created_user: data.created_user ?? data.user_name ?? data.sender_name ?? null,
      created_user_id: data.created_user_id ?? data.user_uuid ?? null,
      received_datetime: data.received_datetime ?? nowIso,
      created_datetime: data.created_datetime ?? nowIso,
      updated_datetime: data.updated_datetime ?? nowIso,
      ccusers_json:
        typeof data.ccusers_json === 'object'
          ? JSON.stringify(data.ccusers_json)
          : (data.ccusers_json ?? '[]'),
      bccusers_json:
        typeof data.bccusers_json === 'object'
          ? JSON.stringify(data.bccusers_json)
          : (data.bccusers_json ?? '[]'),
      from_email: data.from_email ?? data.sender_email ?? null,
      to_email: data.to_email ?? data.to_user_email ?? null,
      from_user_name: data.from_user_name ?? data.sender_name ?? null,
      to_user_name: data.to_user_name ?? data.to_fullname ?? null,
      from_mobile: data.from_mobile ?? data.sender_mobile ?? null,
      to_mobile: data.to_mobile ?? data.recipient_mobiles ?? null,
      from_user_uuid: ensureValidUuid(data.from_user_uuid || data.user_uuid),
      to_user_uuid: ensureValidUuid(data.to_user_uuid),
      from_fullname: data.from_fullname ?? data.full_name ?? data.sender_name ?? null,
      to_fullname: data.to_fullname ?? data.to_user_name ?? null,
      email_files_json:
        typeof data.email_files_json === 'object'
          ? JSON.stringify(data.email_files_json)
          : typeof data.attachments === 'string'
            ? data.attachments
            : typeof data.attachments === 'object'
              ? JSON.stringify(data.attachments)
              : (data.email_files_json ?? '[]'),
      is_archive: data.is_archive !== undefined ? (data.is_archive ? 1 : 0) : 0,
      is_like: data.is_like !== undefined ? (data.is_like ? 1 : 0) : 0,
      is_dislike: data.is_dislike !== undefined ? (data.is_dislike ? 1 : 0) : 0,
      is_flag: data.is_flag !== undefined ? (data.is_flag ? 1 : 0) : 0,
      is_favourite: data.is_favourite !== undefined ? (data.is_favourite ? 1 : 0) : 0,
      user_uuid: ensureValidUuid(data.user_uuid),
      created_user_uuid: ensureValidUuid(data.created_user_uuid || data.user_uuid),
      updated_user_uuid: ensureValidUuid(data.updated_user_uuid || data.user_uuid),
      user_name: data.user_name ?? data.sender_name ?? null,
      user_email: data.user_email ?? data.sender_email ?? null,
      user_mobile: data.user_mobile ?? data.sender_mobile ?? null,
      from_user_email: data.from_user_email ?? data.from_email ?? data.sender_email ?? null,
      from_user_mobile: data.from_user_mobile ?? data.from_mobile ?? data.sender_mobile ?? null,
      to_user_email: data.to_user_email ?? data.to_email ?? null,
      to_user_mobile: data.to_user_mobile ?? data.to_mobile ?? data.recipient_mobiles ?? null,
      month_name: data.month_name ?? currentMonth,
      folder_name: data.folder_name ?? (data.is_draft ? 'Drafts' : 'Sent'),
      is_sync: 0,
      ...data,
    };

    // 1. Save to Local SQLite DB
    await db.runAsync(
      `
      INSERT INTO app_notification (
        app_notification_uuid, status, user_email_account_id, subject, sender_email,
        sender_name, full_name, sender_mobile, recipient_mobiles, cc_emails,
        bcc_emails, body, is_read, is_starred, is_important,
        is_draft, is_deleted, has_attachments, created_user, created_user_id,
        received_datetime, created_datetime, updated_datetime, ccusers_json, bccusers_json,
        from_email, to_email, from_user_name, to_user_name, from_mobile,
        to_mobile, from_user_uuid, to_user_uuid, from_fullname, to_fullname,
        email_files_json, is_archive, is_like, is_dislike, is_flag,
        is_favourite, user_uuid, created_user_uuid, updated_user_uuid, user_name,
        user_email, user_mobile, from_user_email, from_user_mobile, to_user_email,
        to_user_mobile, month_name, folder_name, is_sync
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
      ON CONFLICT(app_notification_uuid) DO UPDATE SET
        subject = excluded.subject,
        body = excluded.body,
        is_read = excluded.is_read,
        is_starred = excluded.is_starred,
        is_important = excluded.is_important,
        is_draft = excluded.is_draft,
        is_deleted = excluded.is_deleted,
        status = excluded.status,
        updated_datetime = excluded.updated_datetime
      `,
      [
        record.app_notification_uuid,
        record.status,
        record.user_email_account_id,
        record.subject,
        record.sender_email,
        record.sender_name,
        record.full_name,
        record.sender_mobile,
        record.recipient_mobiles,
        record.cc_emails,
        record.bcc_emails,
        record.body,
        record.is_read ? 1 : 0,
        record.is_starred ? 1 : 0,
        record.is_important ? 1 : 0,
        record.is_draft ? 1 : 0,
        record.is_deleted ? 1 : 0,
        record.has_attachments ? 1 : 0,
        record.created_user,
        record.created_user_id,
        record.received_datetime,
        record.created_datetime,
        record.updated_datetime,
        typeof record.ccusers_json === 'object' ? JSON.stringify(record.ccusers_json) : record.ccusers_json,
        typeof record.bccusers_json === 'object' ? JSON.stringify(record.bccusers_json) : record.bccusers_json,
        record.from_email,
        record.to_email,
        record.from_user_name,
        record.to_user_name,
        record.from_mobile,
        record.to_mobile,
        record.from_user_uuid,
        record.to_user_uuid,
        record.from_fullname,
        record.to_fullname,
        typeof record.email_files_json === 'object' ? JSON.stringify(record.email_files_json) : record.email_files_json,
        record.is_archive ? 1 : 0,
        record.is_like ? 1 : 0,
        record.is_dislike ? 1 : 0,
        record.is_flag ? 1 : 0,
        record.is_favourite ? 1 : 0,
        record.user_uuid,
        record.created_user_uuid,
        record.updated_user_uuid,
        record.user_name,
        record.user_email,
        record.user_mobile,
        record.from_user_email,
        record.from_user_mobile,
        record.to_user_email,
        record.to_user_mobile,
        record.month_name,
        record.folder_name,
        0,
      ]
    );

    // 2. Fetch the saved record to get the auto-increment ID
    const savedRecord = await db.getFirstAsync<AppNotificationRecord>(
      `SELECT * FROM app_notification WHERE app_notification_uuid = ? LIMIT 1`,
      [notifUuid]
    );

    // 3. Supabase Sync
    try {
      await this.syncToSupabase(record);
    } catch (err) {
      console.warn('Supabase notification sync notice:', err);
    }

    return savedRecord || record;
  }

  /**
   * Sync a single notification record to Supabase
   */
  static async syncToSupabase(record: AppNotificationRecord): Promise<boolean> {
    try {
      const payload: Record<string, any> = {
        app_notification_uuid: ensureValidUuid(record.app_notification_uuid) || generateV4Uuid(),
        status: record.status || 'sent',
        user_email_account_id: record.user_email_account_id,
        subject: record.subject,
        sender_email: record.sender_email,
        sender_name: record.sender_name,
        full_name: record.full_name,
        sender_mobile: record.sender_mobile,
        recipient_mobiles: record.recipient_mobiles,
        cc_emails: record.cc_emails,
        bcc_emails: record.bcc_emails,
        body: record.body,
        is_read: Boolean(record.is_read),
        is_starred: Boolean(record.is_starred),
        is_important: Boolean(record.is_important),
        is_draft: Boolean(record.is_draft),
        is_deleted: Boolean(record.is_deleted),
        has_attachments: Boolean(record.has_attachments),
        created_user: record.created_user,
        created_user_id: record.created_user_id,
        received_datetime: record.received_datetime,
        created_datetime: record.created_datetime,
        updated_datetime: record.updated_datetime,
        ccusers_json: typeof record.ccusers_json === 'string' ? JSON.parse(record.ccusers_json || '[]') : (record.ccusers_json || []),
        bccusers_json: typeof record.bccusers_json === 'string' ? JSON.parse(record.bccusers_json || '[]') : (record.bccusers_json || []),
        from_email: record.from_email,
        to_email: record.to_email,
        from_user_name: record.from_user_name,
        to_user_name: record.to_user_name,
        from_mobile: record.from_mobile,
        to_mobile: record.to_mobile,
        from_user_uuid: ensureValidUuid(record.from_user_uuid),
        to_user_uuid: ensureValidUuid(record.to_user_uuid),
        from_fullname: record.from_fullname,
        to_fullname: record.to_fullname,
        email_files_json: typeof record.email_files_json === 'string' ? JSON.parse(record.email_files_json || '[]') : (record.email_files_json || []),
        is_archive: Boolean(record.is_archive),
        is_like: Boolean(record.is_like),
        is_dislike: Boolean(record.is_dislike),
        is_flag: Boolean(record.is_flag),
        is_favourite: Boolean(record.is_favourite),
        user_uuid: ensureValidUuid(record.user_uuid),
        created_user_uuid: ensureValidUuid(record.created_user_uuid),
        updated_user_uuid: ensureValidUuid(record.updated_user_uuid),
        user_name: record.user_name,
        user_email: record.user_email,
        user_mobile: record.user_mobile,
        from_user_email: record.from_user_email,
        from_user_mobile: record.from_user_mobile,
        to_user_email: record.to_user_email,
        to_user_mobile: record.to_user_mobile,
        month_name: record.month_name,
      };

      const { error } = await supabase.from('app_notification').upsert(payload, {
        onConflict: 'app_notification_uuid',
      });

      if (!error) {
        const db = await getLocalDatabase();
        await db.runAsync(
          `UPDATE app_notification SET is_sync = 1 WHERE app_notification_uuid = ?`,
          [record.app_notification_uuid]
        );
        return true;
      } else {
        console.error('Supabase app_notification upsert error:', error);
      }
      return false;
    } catch (err) {
      console.warn('Supabase sync skipped / offline:', err);
      return false;
    }
  }

  /**
   * Save or update an existing notification
   */
  static async saveNotification(notification: AppNotificationRecord): Promise<void> {
    await this.createNotification(notification);
  }

  /**
   * Fetch and synchronize notifications for the logged in user from Supabase into Local SQLite
   */
  static async fetchAndSyncUserNotifications(
    userEmail?: string,
    userId?: string
  ): Promise<AppNotificationRecord[]> {
    const db = await getLocalDatabase();

    if (userEmail || userId) {
      try {
        let query = supabase
          .from('app_notification')
          .select('*')
          .eq('is_deleted', false)
          .order('created_datetime', { ascending: false });

        const validUserUuid = ensureValidUuid(userId);
        const cleanEmail = userEmail?.trim().toLowerCase();

        if (cleanEmail && validUserUuid) {
          query = query.or(
            `to_email.ilike.%${cleanEmail}%,to_user_email.ilike.%${cleanEmail}%,cc_emails.ilike.%${cleanEmail}%,bcc_emails.ilike.%${cleanEmail}%,from_email.ilike.%${cleanEmail}%,sender_email.ilike.%${cleanEmail}%,created_user_id.eq.${userId},user_uuid.eq.${validUserUuid}`
          );
        } else if (cleanEmail) {
          query = query.or(
            `to_email.ilike.%${cleanEmail}%,to_user_email.ilike.%${cleanEmail}%,cc_emails.ilike.%${cleanEmail}%,bcc_emails.ilike.%${cleanEmail}%,from_email.ilike.%${cleanEmail}%,sender_email.ilike.%${cleanEmail}%`
          );
        } else if (validUserUuid) {
          query = query.or(`user_uuid.eq.${validUserUuid},created_user_uuid.eq.${validUserUuid},created_user_id.eq.${userId}`);
        }

        const { data: cloudItems, error } = await query.limit(100);
        if (error) {
          console.warn('Supabase fetch user notifications notice:', error.message || error);
        }

        if (!error && Array.isArray(cloudItems)) {
          for (const item of cloudItems) {
            await db.runAsync(
              `
              INSERT INTO app_notification (
                app_notification_uuid, status, user_email_account_id, subject, sender_email,
                sender_name, full_name, sender_mobile, recipient_mobiles, cc_emails,
                bcc_emails, body, is_read, is_starred, is_important,
                is_draft, is_deleted, has_attachments, created_user, created_user_id,
                received_datetime, created_datetime, updated_datetime, ccusers_json, bccusers_json,
                from_email, to_email, from_user_name, to_user_name, from_mobile,
                to_mobile, from_user_uuid, to_user_uuid, from_fullname, to_fullname,
                email_files_json, is_archive, is_like, is_dislike, is_flag,
                is_favourite, user_uuid, created_user_uuid, updated_user_uuid, user_name,
                user_email, user_mobile, from_user_email, from_user_mobile, to_user_email,
                to_user_mobile, month_name, folder_name, is_sync
              ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, 1
              )
              ON CONFLICT(app_notification_uuid) DO UPDATE SET
                subject = excluded.subject,
                body = excluded.body,
                is_read = excluded.is_read,
                is_starred = excluded.is_starred,
                is_important = excluded.is_important,
                is_draft = excluded.is_draft,
                is_deleted = excluded.is_deleted,
                status = excluded.status,
                updated_datetime = excluded.updated_datetime,
                is_sync = 1
              `,
              [
                item.app_notification_uuid,
                item.status || 'sent',
                item.user_email_account_id || null,
                item.subject || '(No Subject)',
                item.sender_email || null,
                item.sender_name || null,
                item.full_name || null,
                item.sender_mobile || null,
                item.recipient_mobiles || null,
                item.cc_emails || null,
                item.bcc_emails || null,
                item.body || '',
                item.is_read ? 1 : 0,
                item.is_starred ? 1 : 0,
                item.is_important ? 1 : 0,
                item.is_draft ? 1 : 0,
                item.is_deleted ? 1 : 0,
                item.has_attachments ? 1 : 0,
                item.created_user || null,
                item.created_user_id || null,
                item.received_datetime || new Date().toISOString(),
                item.created_datetime || new Date().toISOString(),
                item.updated_datetime || new Date().toISOString(),
                typeof item.ccusers_json === 'object' ? JSON.stringify(item.ccusers_json) : (item.ccusers_json || '[]'),
                typeof item.bccusers_json === 'object' ? JSON.stringify(item.bccusers_json) : (item.bccusers_json || '[]'),
                item.from_email || null,
                item.to_email || null,
                item.from_user_name || null,
                item.to_user_name || null,
                item.from_mobile || null,
                item.to_mobile || null,
                item.from_user_uuid || null,
                item.to_user_uuid || null,
                item.from_fullname || null,
                item.to_fullname || null,
                typeof item.email_files_json === 'object' ? JSON.stringify(item.email_files_json) : (item.email_files_json || '[]'),
                item.is_archive ? 1 : 0,
                item.is_like ? 1 : 0,
                item.is_dislike ? 1 : 0,
                item.is_flag ? 1 : 0,
                item.is_favourite ? 1 : 0,
                item.user_uuid || null,
                item.created_user_uuid || null,
                item.updated_user_uuid || null,
                item.user_name || null,
                item.user_email || null,
                item.user_mobile || null,
                item.from_user_email || null,
                item.from_user_mobile || null,
                item.to_user_email || null,
                item.to_user_mobile || null,
                item.month_name || null,
                item.folder_name || (item.is_draft ? 'Drafts' : 'Sent'),
              ]
            );
          }
        }
      } catch (err) {
        console.warn('Silent cloud notification sync notice:', err);
      }
    }

    return await this.getNotifications();
  }

  /**
   * Get all notifications from SQLite (ordered by date)
   */
  static async getNotifications(options?: {
    userUuid?: string;
    folderName?: string;
    isRead?: boolean;
    limit?: number;
  }): Promise<AppNotificationRecord[]> {
    const db = await getLocalDatabase();
    let query = `SELECT * FROM app_notification WHERE is_deleted = 0`;
    const params: any[] = [];

    if (options?.userUuid) {
      query += ` AND (user_uuid = ? OR created_user_id = ?)`;
      params.push(options.userUuid, options.userUuid);
    }

    if (options?.folderName) {
      query += ` AND LOWER(folder_name) = LOWER(?)`;
      params.push(options.folderName);
    }

    if (options?.isRead !== undefined) {
      query += ` AND is_read = ?`;
      params.push(options.isRead ? 1 : 0);
    }

    query += ` ORDER BY created_datetime DESC`;

    if (options?.limit) {
      query += ` LIMIT ${Number(options.limit)}`;
    }

    return await db.getAllAsync(query, params);
  }

  /**
   * Get notification by UUID or ID
   */
  static async getNotificationById(idOrUuid: string | number): Promise<AppNotificationRecord | null> {
    const db = await getLocalDatabase();
    return await db.getFirstAsync(
      `SELECT * FROM app_notification WHERE app_notification_uuid = ? OR app_notification_id = ? LIMIT 1`,
      [idOrUuid, idOrUuid]
    );
  }

  /**
   * Mark notification as read / unread
   */
  static async markAsRead(appNotificationUuid: string, isRead = true): Promise<void> {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE app_notification SET is_read = ?, updated_datetime = datetime('now') WHERE app_notification_uuid = ?`,
      [isRead ? 1 : 0, appNotificationUuid]
    );
    supabase
      .from('app_notification')
      .update({ is_read: isRead, updated_datetime: new Date().toISOString() })
      .eq('app_notification_uuid', appNotificationUuid)
      .then();
  }

  /**
   * Toggle star / flag status
   */
  static async toggleStar(appNotificationUuid: string, isStarred: boolean): Promise<void> {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE app_notification SET is_starred = ?, updated_datetime = datetime('now') WHERE app_notification_uuid = ?`,
      [isStarred ? 1 : 0, appNotificationUuid]
    );
    supabase
      .from('app_notification')
      .update({ is_starred: isStarred, updated_datetime: new Date().toISOString() })
      .eq('app_notification_uuid', appNotificationUuid)
      .then();
  }

  /**
   * Soft delete notification
   */
  static async deleteNotification(appNotificationUuid: string): Promise<void> {
    const db = await getLocalDatabase();
    await db.runAsync(
      `UPDATE app_notification SET is_deleted = 1, updated_datetime = datetime('now') WHERE app_notification_uuid = ?`,
      [appNotificationUuid]
    );
    supabase
      .from('app_notification')
      .update({ is_deleted: true, updated_datetime: new Date().toISOString() })
      .eq('app_notification_uuid', appNotificationUuid)
      .then();
  }
}
