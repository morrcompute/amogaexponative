import { getLocalDatabase } from './sqlite-db';
import type { LocalEmailRecord } from './types';

export class LocalEmailService {
  static async saveEmail(email: LocalEmailRecord): Promise<void> {
    const db = await getLocalDatabase();
    await db.runAsync(
      `
      INSERT INTO local_emails (
        id, message_id, in_reply_to, thread_id, account_id,
        from_name, from_email, to_recipients, cc_recipients, bcc_recipients,
        reply_to, subject, snippet, body_text, body_html,
        attachments, headers, folder, is_read, is_flagged,
        is_important, is_starred, is_archived, is_deleted, is_draft, is_spam,
        category, badges, labels, date_sent, date_received,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        subject=excluded.subject,
        snippet=excluded.snippet,
        body_text=excluded.body_text,
        body_html=excluded.body_html,
        attachments=excluded.attachments,
        folder=excluded.folder,
        is_read=excluded.is_read,
        is_flagged=excluded.is_flagged,
        is_starred=excluded.is_starred,
        updated_at=datetime('now');
    `,
      [
        email.id,
        email.message_id || null,
        email.in_reply_to || null,
        email.thread_id || null,
        email.account_id || 'primary',
        email.from_name || null,
        email.from_email,
        typeof email.to_recipients === 'string' ? email.to_recipients : JSON.stringify(email.to_recipients || []),
        typeof email.cc_recipients === 'string' ? email.cc_recipients : JSON.stringify(email.cc_recipients || []),
        typeof email.bcc_recipients === 'string' ? email.bcc_recipients : JSON.stringify(email.bcc_recipients || []),
        email.reply_to || null,
        email.subject || '(No Subject)',
        email.snippet || '',
        email.body_text || '',
        email.body_html || '',
        typeof email.attachments === 'string' ? email.attachments : JSON.stringify(email.attachments || []),
        typeof email.headers === 'string' ? email.headers : JSON.stringify(email.headers || {}),
        (email.folder || 'inbox').toLowerCase(),
        email.is_read ? 1 : 0,
        email.is_flagged ? 1 : 0,
        email.is_important ? 1 : 0,
        email.is_starred ? 1 : 0,
        email.is_archived ? 1 : 0,
        email.is_deleted ? 1 : 0,
        email.is_draft ? 1 : 0,
        email.is_spam ? 1 : 0,
        email.category || 'primary',
        typeof email.badges === 'string' ? email.badges : JSON.stringify(email.badges || []),
        typeof email.labels === 'string' ? email.labels : JSON.stringify(email.labels || []),
        email.date_sent || null,
        email.date_received || new Date().toISOString(),
      ]
    );
  }

  static async saveEmailsBulk(emails: LocalEmailRecord[]): Promise<void> {
    for (const email of emails) {
      await this.saveEmail(email);
    }
  }

  static async getEmailsByFolder(folder: string = 'inbox', limit: number = 50, offset: number = 0): Promise<LocalEmailRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_emails WHERE folder = ? AND is_deleted = 0 ORDER BY date_received DESC LIMIT ? OFFSET ?;`,
      [folder.toLowerCase(), limit, offset]
    );
    return rows as LocalEmailRecord[];
  }

  static async getEmailById(id: string): Promise<LocalEmailRecord | null> {
    const db = await getLocalDatabase();
    const row = await db.getFirstAsync(`SELECT * FROM local_emails WHERE id = ?;`, [id]);
    return (row as LocalEmailRecord) || null;
  }

  static async updateEmailStatus(id: string, updates: Partial<LocalEmailRecord>): Promise<void> {
    const db = await getLocalDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.is_read !== undefined) {
      fields.push('is_read = ?');
      values.push(updates.is_read ? 1 : 0);
    }
    if (updates.is_flagged !== undefined) {
      fields.push('is_flagged = ?');
      values.push(updates.is_flagged ? 1 : 0);
    }
    if (updates.is_starred !== undefined) {
      fields.push('is_starred = ?');
      values.push(updates.is_starred ? 1 : 0);
    }
    if (updates.folder !== undefined) {
      fields.push('folder = ?');
      values.push(updates.folder.toLowerCase());
    }

    if (fields.length === 0) return;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    await db.runAsync(`UPDATE local_emails SET ${fields.join(', ')} WHERE id = ?;`, values);
  }

  static async deleteEmail(id: string, permanent: boolean = false): Promise<void> {
    const db = await getLocalDatabase();
    if (permanent) {
      await db.runAsync(`DELETE FROM local_emails WHERE id = ?;`, [id]);
    } else {
      await db.runAsync(`UPDATE local_emails SET is_deleted = 1, folder = 'trash', updated_at = datetime('now') WHERE id = ?;`, [id]);
    }
  }

  static async searchEmails(query: string, folder?: string): Promise<LocalEmailRecord[]> {
    const db = await getLocalDatabase();
    const searchTerm = `%${query.toLowerCase()}%`;
    if (folder) {
      const rows = await db.getAllAsync(
        `SELECT * FROM local_emails WHERE folder = ? AND is_deleted = 0 AND (subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR snippet LIKE ?) ORDER BY date_received DESC;`,
        [folder.toLowerCase(), searchTerm, searchTerm, searchTerm, searchTerm]
      );
      return rows as LocalEmailRecord[];
    } else {
      const rows = await db.getAllAsync(
        `SELECT * FROM local_emails WHERE is_deleted = 0 AND (subject LIKE ? OR from_name LIKE ? OR from_email LIKE ? OR snippet LIKE ?) ORDER BY date_received DESC;`,
        [searchTerm, searchTerm, searchTerm, searchTerm]
      );
      return rows as LocalEmailRecord[];
    }
  }
}
