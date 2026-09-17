import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let dbInstance: any = null;
let initPromise: Promise<any> | null = null;

export async function getLocalDatabase() {
  if (dbInstance) {
    return dbInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('amoga_local.db');
      await createTables(db);
      dbInstance = db;
      return db;
    } catch (err) {
      console.warn('SQLite init warning:', err);
      // Fallback in-memory/mock storage for platforms without native SQLite
      const mockDb = createWebMockDb();
      dbInstance = mockDb;
      return mockDb;
    }
  })();

  return initPromise;
}

async function createTables(db: any) {
  // 1. Create local_emails table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_emails (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      in_reply_to TEXT,
      thread_id TEXT,
      account_id TEXT DEFAULT 'primary',
      from_name TEXT,
      from_email TEXT NOT NULL,
      to_recipients TEXT NOT NULL DEFAULT '[]',
      cc_recipients TEXT DEFAULT '[]',
      bcc_recipients TEXT DEFAULT '[]',
      reply_to TEXT,
      subject TEXT DEFAULT '(No Subject)',
      snippet TEXT,
      body_text TEXT,
      body_html TEXT,
      attachments TEXT DEFAULT '[]',
      headers TEXT DEFAULT '{}',
      folder TEXT NOT NULL DEFAULT 'inbox',
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      is_important INTEGER NOT NULL DEFAULT 0,
      is_starred INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      is_draft INTEGER NOT NULL DEFAULT 0,
      is_spam INTEGER NOT NULL DEFAULT 0,
      category TEXT DEFAULT 'primary',
      badges TEXT DEFAULT '[]',
      labels TEXT DEFAULT '[]',
      date_sent TEXT,
      date_received TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_local_emails_folder ON local_emails(folder);
    CREATE INDEX IF NOT EXISTS idx_local_emails_date ON local_emails(date_received DESC);
    CREATE INDEX IF NOT EXISTS idx_local_emails_read ON local_emails(is_read);
  `);

  // 2. Create local_files table (with all columns)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_files (
      file_id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_uuid TEXT UNIQUE,
      mydoc_id INTEGER,
      mydoc_list_id INTEGER,
      status TEXT DEFAULT 'active',
      created_user_id INTEGER,
      created_user_name TEXT,
      ref_user_id TEXT,
      ref_user_name TEXT,
      created_date TEXT DEFAULT (datetime('now')),
      updated_date TEXT DEFAULT (datetime('now')),
      data_source_name TEXT,
      for_business_code TEXT,
      for_business_name TEXT,
      for_business_number TEXT,
      for_user_id TEXT,
      for_user_name TEXT,
      business_code TEXT,
      business_name TEXT,
      business_number TEXT,
      file_name TEXT NOT NULL,
      file_code TEXT,
      file_description TEXT,
      tabbed_form INTEGER DEFAULT 0,
      template INTEGER DEFAULT 0,
      template_name TEXT,
      chat_form INTEGER DEFAULT 0,
      chatform_name TEXT,
      chatform_url TEXT,
      app_name TEXT,
      app_code TEXT,
      page_name TEXT,
      database_name TEXT,
      data_table_name TEXT,
      data_api_name TEXT,
      data_api_url TEXT,
      data_api_key TEXT,
      file_entries_table TEXT,
      file_entries_table_api TEXT,
      file_entries_api TEXT,
      publish_status TEXT DEFAULT 'draft',
      file_publish_date TEXT,
      file_publish_url TEXT,
      content TEXT,
      content_html TEXT,
      content_json TEXT DEFAULT '{}',
      doc_json TEXT DEFAULT '{}',
      visits TEXT DEFAULT '0',
      submissions TEXT DEFAULT '0',
      shareurl TEXT,
      shorturl TEXT,
      chatformshorturl TEXT,
      form_iframe_code TEXT,
      chatform_iframe_code TEXT,
      no_of_tabs TEXT,
      tab_name TEXT,
      tab_number TEXT,
      tab_order TEXT,
      tab_field_order TEXT DEFAULT '{}',
      file_fields_json TEXT DEFAULT '{}',
      file_fields_script TEXT DEFAULT '{}',
      version_no TEXT DEFAULT '1.0',
      version_date TEXT DEFAULT (datetime('now')),
      file_api TEXT,
      custom_text_one TEXT,
      custom_text_two TEXT,
      custom_no_one REAL,
      custom_no_two REAL,
      custom_json_one TEXT DEFAULT '{}',
      custom_json_two TEXT DEFAULT '{}',
      custom_json_three TEXT DEFAULT '{}',
      file_no TEXT,
      ref_file TEXT,
      ref_file_no TEXT,
      file_group TEXT,
      plan_id TEXT,
      plan_name TEXT,
      plan_phase_id TEXT,
      task_id TEXT,
      task_name TEXT,
      ref_plan_name TEXT,
      ref_phase_name TEXT,
      ref_task_title TEXT,
      msg_id TEXT,
      doc_file_one BLOB,
      doc_file_two BLOB,
      doc_file_url TEXT,
      doc_file_json TEXT DEFAULT '{}',
      flow_json TEXT DEFAULT '{}',
      progress_json TEXT DEFAULT '{}',
      status_log_json TEXT DEFAULT '[]',
      user_log_json TEXT DEFAULT '[]',
      business_log_json TEXT DEFAULT '[]',
      agent_json TEXT DEFAULT '{}',
      prompt_json TEXT DEFAULT '{}',
      response_json TEXT DEFAULT '{}',
      timeline_json TEXT DEFAULT '[]',
      ref_business_code TEXT,
      ref_business_name TEXT,
      ref_business_number TEXT,
      file_type TEXT NOT NULL,
      folder_name TEXT DEFAULT 'General',
      folder_group TEXT,
      sign_workflow_json TEXT DEFAULT '{}',
      sign_progress_json TEXT DEFAULT '{}',
      file_sign_complete_json TEXT DEFAULT '{}',
      file_sign_image TEXT,
      sign_full_name TEXT,
      status_json TEXT DEFAULT '{}',
      sign_task_uuid TEXT,
      sign_share_url TEXT,
      sign_chat_uuid TEXT,
      sign_message_uuid TEXT,
      org_roles_json TEXT DEFAULT '{}',
      users_json TEXT DEFAULT '[]',
      business_uuid TEXT,
      user_name TEXT,
      user_email TEXT,
      user_mobile TEXT,
      created_user_uuid TEXT,
      created_business_uuid TEXT,
      ref_business_uuid TEXT,
      user_id INTEGER,
      is_important INTEGER DEFAULT 0,
      is_flag INTEGER DEFAULT 0,
      is_archive INTEGER DEFAULT 0,
      is_favourite INTEGER DEFAULT 0,
      is_pin INTEGER DEFAULT 0,
      is_actionitem INTEGER DEFAULT 0,
      is_delete INTEGER DEFAULT 0,
      is_like INTEGER DEFAULT 0,
      is_dislike INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      updated_business_uuid TEXT,
      updated_user_uuid TEXT,
      sub_folder_json TEXT DEFAULT '{}',
      sub_folder_name TEXT,
      user_uuid TEXT,
      email_uuid TEXT,
      chat_uuid TEXT,
      from_user_uuid TEXT,
      to_user_uuid TEXT,
      month_id INTEGER,
      month_uuid TEXT,
      month_name TEXT,
      financial_year_uuid TEXT,
      financial_id INTEGER,
      financial_year TEXT,
      period_uuid TEXT,
      period_id INTEGER,
      period_name TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_local_files_type ON local_files(file_type);
    CREATE INDEX IF NOT EXISTS idx_local_files_folder ON local_files(folder_name);
    CREATE INDEX IF NOT EXISTS idx_local_files_status ON local_files(status);
  `);
}

function createWebMockDb() {
  const getItem = (key: string): any[] => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`amoga_sqlite_${key}`);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (_) {}
    return [];
  };

  const setItem = (key: string, data: any[]) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`amoga_sqlite_${key}`, JSON.stringify(data));
      }
    } catch (_) {}
  };

  return {
    execAsync: async () => {},
    runAsync: async (query: string, params: any[] = []) => {
      const q = query.trim().toUpperCase();
      if (q.startsWith('INSERT INTO LOCAL_EMAILS')) {
        const list = getItem('emails');
        const record: any = {
          id: params[0],
          message_id: params[1],
          in_reply_to: params[2],
          thread_id: params[3],
          account_id: params[4],
          from_name: params[5],
          from_email: params[6],
          to_recipients: params[7],
          cc_recipients: params[8],
          bcc_recipients: params[9],
          reply_to: params[10],
          subject: params[11],
          snippet: params[12],
          body_text: params[13],
          body_html: params[14],
          attachments: params[15],
          headers: params[16],
          folder: params[17],
          is_read: params[18],
          is_flagged: params[19],
          is_important: params[20],
          is_starred: params[21],
          is_archived: params[22],
          is_deleted: params[23],
          is_draft: params[24],
          is_spam: params[25],
          category: params[26],
          badges: params[27],
          labels: params[28],
          date_sent: params[29],
          date_received: params[30],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const filtered = list.filter((e) => e.id !== record.id);
        filtered.unshift(record);
        setItem('emails', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('INSERT INTO LOCAL_FILES')) {
        const list = getItem('files');
        const record: any = {
          file_id: list.length + 1,
          file_uuid: params[0],
          file_name: params[19],
          file_description: params[21],
          file_type: params[99] || 'DOC',
          folder_name: params[100] || 'General',
          content: params[41],
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
          is_delete: 0,
        };
        list.unshift(record);
        setItem('files', list);
        return { changes: 1, lastInsertRowId: record.file_id };
      }

      if (q.startsWith('UPDATE LOCAL_EMAILS')) {
        const list = getItem('emails');
        const id = params[params.length - 1];
        const updated = list.map((e) => (e.id === id ? { ...e, ...params } : e));
        setItem('emails', updated);
        return { changes: 1 };
      }

      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async (query: string, params: any[] = []) => {
      const q = query.trim().toUpperCase();
      if (q.includes('LOCAL_EMAILS')) {
        const list = getItem('emails');
        const folder = params[0] ? String(params[0]).toLowerCase() : null;
        if (folder) {
          return list.filter((e) => (e.folder || '').toLowerCase() === folder && !e.is_deleted);
        }
        return list.filter((e) => !e.is_deleted);
      }
      if (q.includes('LOCAL_FILES')) {
        const list = getItem('files');
        const type = params[0] ? String(params[0]).toUpperCase() : null;
        if (type && type !== 'ALL') {
          return list.filter((f) => (f.file_type || '').toUpperCase() === type && !f.is_delete);
        }
        return list.filter((f) => !f.is_delete);
      }
      return [];
    },
    getFirstAsync: async (query: string, params: any[] = []) => {
      const q = query.trim().toUpperCase();
      if (q.includes('LOCAL_EMAILS')) {
        const list = getItem('emails');
        const id = params[0];
        return list.find((e) => e.id === id) || null;
      }
      if (q.includes('LOCAL_FILES')) {
        const list = getItem('files');
        const id = params[0];
        return list.find((f) => f.file_id === id || f.file_uuid === id) || null;
      }
      return null;
    },
  };
}
