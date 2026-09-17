import { getLocalDatabase } from './sqlite-db';
import type { LocalEmailRecord } from './types';

export class LocalEmailService {
  static async saveEmail(email: LocalEmailRecord): Promise<void> {
    const db = await getLocalDatabase();
    const emailUuid = email.email_uuid || `email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await db.runAsync(
      `
      INSERT INTO local_emails (
        email_uuid, status, description, icon, user_email_account_id,
        email_folder_id, subject, sender_email, sender_name, full_name,
        sender_mobile, recipient_mobiles, cc_emails, bcc_emails, body,
        is_read, is_starred, is_important, is_draft, is_deleted,
        has_attachments, ref_email_id, ref_email, for_email_id, for_email,
        ref_sequence_no, for_sequence_no, ref_subject, for_subject,
        from_business_number, from_business_name, to_business_number, to_business_name,
        for_business_number, for_business_name, redirection_icon, redirection_url,
        ref_field_1, ref_field_2, user_note, replied_to_email_id, related_to_email_id,
        forwarded_from_email_id, seen_by_users, reactions, sender_display_name,
        attachment_url, attachment_name, email_opened, email_open_datetime, email_open_geo,
        custom_one, custom_two, custom_three, meta_fields, remarks,
        store_meta, workflow_meta, share_url, share_status, business_name,
        business_number, ref_business, ref_business_number, ref_user, ref_appname,
        ref_datetime, social_login_used, created_user, created_user_id, received_datetime,
        app_name, is_sync, ccusers_json, bccusers_json, from_email,
        to_email, from_user_name, to_user_name, from_mobile, to_mobile,
        from_user_uuid, to_user_uuid, from_fullname, to_fullname, body_rich_text_json,
        email_files_json, email_content_json, is_archive, progress_status,
        email_use_timeline, message_group, message_type, message_category, email_sequence_json,
        is_like, is_dislike, is_flag, is_favourite, user_uuid,
        created_user_uuid, updated_user_uuid, user_name, user_email, user_mobile,
        from_user_email, from_user_mobile, to_user_email, to_user_mobile, business_uuid,
        created_business_uuid, updated_business_uuid, for_business_uuid, ref_business_uuid,
        ref_business_name, from_business_uuid, from_business_email, from_business_mobile,
        to_business_uuid, to_business_email, to_business_mobile, email_group, user_id,
        email_connection_json, email_status_logs_json, recipient_emails, status_json,
        progress_json, progress_status_json, ref_email_uuid, for_email_uuid, email_thread_json,
        is_actionitem, is_pin, email_status, is_template, template_name,
        folder_name, is_open, sent_server_email_uuid, inbox_server_email_uuid,
        sent_imap_id, inbox_imap_id, sub_folder_name, month_id, month_uuid,
        month_name, financial_year_uuid, financial_id, financial_year,
        period_uuid, period_id, period_name, updated_datetime
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
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, datetime('now')
      )
      ON CONFLICT(email_uuid) DO UPDATE SET
        subject=excluded.subject,
        body=excluded.body,
        is_read=excluded.is_read,
        is_starred=excluded.is_starred,
        folder_name=excluded.folder_name,
        updated_datetime=datetime('now');
    `,
      [
        emailUuid,
        email.status || 'active',
        email.description || null,
        email.icon || null,
        email.user_email_account_id || null,
        email.email_folder_id || null,
        email.subject || '(No Subject)',
        email.sender_email || email.from_email || null,
        email.sender_name || email.from_user_name || null,
        email.full_name || email.from_fullname || null,
        email.sender_mobile || email.from_mobile || null,
        email.recipient_mobiles || null,
        email.cc_emails || null,
        email.bcc_emails || null,
        email.body || null,
        email.is_read ? 1 : 0,
        email.is_starred ? 1 : 0,
        email.is_important ? 1 : 0,
        email.is_draft ? 1 : 0,
        email.is_deleted ? 1 : 0,
        email.has_attachments ? 1 : 0,
        email.ref_email_id || null,
        email.ref_email || null,
        email.for_email_id || null,
        email.for_email || null,
        email.ref_sequence_no || null,
        email.for_sequence_no || null,
        email.ref_subject || null,
        email.for_subject || null,
        email.from_business_number || null,
        email.from_business_name || null,
        email.to_business_number || null,
        email.to_business_name || null,
        email.for_business_number || null,
        email.for_business_name || null,
        email.redirection_icon || null,
        email.redirection_url || null,
        email.ref_field_1 || null,
        email.ref_field_2 || null,
        email.user_note || null,
        email.replied_to_email_id || null,
        email.related_to_email_id || null,
        email.forwarded_from_email_id || null,
        email.seen_by_users || null,
        email.reactions || null,
        email.sender_display_name || null,
        email.attachment_url || null,
        email.attachment_name || null,
        email.email_opened || null,
        email.email_open_datetime || null,
        email.email_open_geo || null,
        email.custom_one || null,
        email.custom_two || null,
        email.custom_three || null,
        email.meta_fields || null,
        email.remarks || null,
        email.store_meta || null,
        email.workflow_meta || null,
        email.share_url || null,
        email.share_status || null,
        email.business_name || null,
        email.business_number || null,
        email.ref_business || null,
        email.ref_business_number || null,
        email.ref_user || null,
        email.ref_appname || null,
        email.ref_datetime || null,
        email.social_login_used || null,
        email.created_user || null,
        email.created_user_id || null,
        email.received_datetime || new Date().toISOString(),
        email.app_name || 'AmogaMobile',
        email.is_sync ? 1 : 0,
        typeof email.ccusers_json === 'string' ? email.ccusers_json : JSON.stringify(email.ccusers_json || []),
        typeof email.bccusers_json === 'string' ? email.bccusers_json : JSON.stringify(email.bccusers_json || []),
        email.from_email || email.sender_email || null,
        email.to_email || null,
        email.from_user_name || email.sender_name || null,
        email.to_user_name || null,
        email.from_mobile || null,
        email.to_mobile || null,
        email.from_user_uuid || null,
        email.to_user_uuid || null,
        email.from_fullname || null,
        email.to_fullname || null,
        typeof email.body_rich_text_json === 'string' ? email.body_rich_text_json : JSON.stringify(email.body_rich_text_json || {}),
        typeof email.email_files_json === 'string' ? email.email_files_json : JSON.stringify(email.email_files_json || []),
        typeof email.email_content_json === 'string' ? email.email_content_json : JSON.stringify(email.email_content_json || {}),
        email.is_archive ? 1 : 0,
        email.progress_status || null,
        typeof email.email_use_timeline === 'string' ? email.email_use_timeline : JSON.stringify(email.email_use_timeline || []),
        email.message_group || null,
        email.message_type || null,
        email.message_category || null,
        typeof email.email_sequence_json === 'string' ? email.email_sequence_json : JSON.stringify(email.email_sequence_json || []),
        email.is_like ? 1 : 0,
        email.is_dislike ? 1 : 0,
        email.is_flag ? 1 : 0,
        email.is_favourite ? 1 : 0,
        email.user_uuid || null,
        email.created_user_uuid || null,
        email.updated_user_uuid || null,
        email.user_name || null,
        email.user_email || null,
        email.user_mobile || null,
        email.from_user_email || null,
        email.from_user_mobile || null,
        email.to_user_email || null,
        email.to_user_mobile || null,
        email.business_uuid || null,
        email.created_business_uuid || null,
        email.updated_business_uuid || null,
        email.for_business_uuid || null,
        email.ref_business_uuid || null,
        email.ref_business_name || null,
        email.from_business_uuid || null,
        email.from_business_email || null,
        email.from_business_mobile || null,
        email.to_business_uuid || null,
        email.to_business_email || null,
        email.to_business_mobile || null,
        email.email_group || null,
        email.user_id || null,
        typeof email.email_connection_json === 'string' ? email.email_connection_json : JSON.stringify(email.email_connection_json || {}),
        typeof email.email_status_logs_json === 'string' ? email.email_status_logs_json : JSON.stringify(email.email_status_logs_json || []),
        typeof email.recipient_emails === 'string' ? email.recipient_emails : JSON.stringify(email.recipient_emails || []),
        typeof email.status_json === 'string' ? email.status_json : JSON.stringify(email.status_json || {}),
        typeof email.progress_json === 'string' ? email.progress_json : JSON.stringify(email.progress_json || {}),
        typeof email.progress_status_json === 'string' ? email.progress_status_json : JSON.stringify(email.progress_status_json || {}),
        email.ref_email_uuid || null,
        email.for_email_uuid || null,
        typeof email.email_thread_json === 'string' ? email.email_thread_json : JSON.stringify(email.email_thread_json || []),
        email.is_actionitem ? 1 : 0,
        email.is_pin ? 1 : 0,
        email.email_status || 'active',
        email.is_template ? 1 : 0,
        email.template_name || null,
        email.folder_name || 'INBOX',
        email.is_open ? 1 : 0,
        email.sent_server_email_uuid || null,
        email.inbox_server_email_uuid || null,
        email.sent_imap_id || null,
        email.inbox_imap_id || null,
        email.sub_folder_name || null,
        email.month_id || null,
        email.month_uuid || null,
        email.month_name || null,
        email.financial_year_uuid || null,
        email.financial_id || null,
        email.financial_year || null,
        email.period_uuid || null,
        email.period_id || null,
        email.period_name || null,
      ]
    );
  }

  static async saveEmailsBulk(emails: LocalEmailRecord[]): Promise<void> {
    for (const email of emails) {
      await this.saveEmail(email);
    }
  }

  static async getEmailsByFolder(folder: string = 'INBOX', limit: number = 50, offset: number = 0): Promise<LocalEmailRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_emails WHERE (folder_name = ? OR folder_name = ?) AND is_deleted = 0 ORDER BY received_datetime DESC LIMIT ? OFFSET ?;`,
      [folder, folder.toUpperCase(), limit, offset]
    );
    return rows as LocalEmailRecord[];
  }

  static async getEmailById(id: number | string): Promise<LocalEmailRecord | null> {
    const db = await getLocalDatabase();
    if (typeof id === 'number' || !isNaN(Number(id))) {
      const row = await db.getFirstAsync(`SELECT * FROM local_emails WHERE email_id = ?;`, [Number(id)]);
      return (row as LocalEmailRecord) || null;
    }
    const row = await db.getFirstAsync(`SELECT * FROM local_emails WHERE email_uuid = ?;`, [id]);
    return (row as LocalEmailRecord) || null;
  }

  static async updateEmailStatus(emailUuid: string, updates: Partial<LocalEmailRecord>): Promise<void> {
    const db = await getLocalDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.is_read !== undefined) {
      fields.push('is_read = ?');
      values.push(updates.is_read ? 1 : 0);
    }
    if (updates.is_starred !== undefined) {
      fields.push('is_starred = ?');
      values.push(updates.is_starred ? 1 : 0);
    }
    if (updates.is_flag !== undefined) {
      fields.push('is_flag = ?');
      values.push(updates.is_flag ? 1 : 0);
    }
    if (updates.is_important !== undefined) {
      fields.push('is_important = ?');
      values.push(updates.is_important ? 1 : 0);
    }
    if (updates.is_deleted !== undefined) {
      fields.push('is_deleted = ?');
      values.push(updates.is_deleted ? 1 : 0);
    }
    if (updates.folder_name !== undefined) {
      fields.push('folder_name = ?');
      values.push(updates.folder_name);
    }

    if (fields.length === 0) return;

    fields.push("updated_datetime = datetime('now')");
    values.push(emailUuid);

    await db.runAsync(
      `UPDATE local_emails SET ${fields.join(', ')} WHERE email_uuid = ?;`,
      values
    );
  }

  static async deleteEmail(emailUuid: string, hardDelete: boolean = false): Promise<void> {
    const db = await getLocalDatabase();
    if (hardDelete) {
      await db.runAsync(`DELETE FROM local_emails WHERE email_uuid = ?;`, [emailUuid]);
    } else {
      await db.runAsync(`UPDATE local_emails SET is_deleted = 1, updated_datetime = datetime('now') WHERE email_uuid = ?;`, [emailUuid]);
    }
  }

  static async searchEmails(query: string, limit: number = 50): Promise<LocalEmailRecord[]> {
    const db = await getLocalDatabase();
    const likeQuery = `%${query}%`;
    const rows = await db.getAllAsync(
      `SELECT * FROM local_emails 
       WHERE (subject LIKE ? OR body LIKE ? OR sender_email LIKE ? OR sender_name LIKE ?) 
         AND is_deleted = 0 
       ORDER BY received_datetime DESC LIMIT ?;`,
      [likeQuery, likeQuery, likeQuery, likeQuery, limit]
    );
    return rows as LocalEmailRecord[];
  }
}
