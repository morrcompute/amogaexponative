import { Platform } from 'react-native';

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
    // If running on Web, use browser local storage fallback without importing native ExpoSQLite
    if (Platform.OS === 'web') {
      const mockDb = createWebMockDb();
      dbInstance = mockDb;
      return mockDb;
    }

    try {
      // Dynamic import so web bundler doesn't execute native module at evaluation time
      const SQLite = require('expo-sqlite');
      if (SQLite && typeof SQLite.openDatabaseAsync === 'function') {
        const db = await SQLite.openDatabaseAsync('amoga_local.db');
        await createTables(db);
        dbInstance = db;
        return db;
      }
      const mockDb = createWebMockDb();
      dbInstance = mockDb;
      return mockDb;
    } catch (err) {
      console.warn('SQLite native module unavailable, falling back to web storage:', err);
      const mockDb = createWebMockDb();
      dbInstance = mockDb;
      return mockDb;
    }
  })();

  return initPromise;
}

async function createTables(db: any) {
  // 1. Create local_emails table (with all 150+ columns)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_emails (
      email_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_uuid TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      description TEXT,
      icon TEXT,
      user_email_account_id TEXT,
      email_folder_id INTEGER,
      subject TEXT DEFAULT '(No Subject)',
      sender_email TEXT,
      sender_name TEXT,
      full_name TEXT,
      sender_mobile TEXT,
      recipient_mobiles TEXT,
      cc_emails TEXT,
      bcc_emails TEXT,
      body TEXT,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      is_important INTEGER DEFAULT 0,
      is_draft INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      has_attachments INTEGER DEFAULT 0,
      ref_email_id INTEGER,
      ref_email TEXT,
      for_email_id TEXT,
      for_email TEXT,
      ref_sequence_no TEXT,
      for_sequence_no TEXT,
      ref_subject TEXT,
      for_subject TEXT,
      from_business_number TEXT,
      from_business_name TEXT,
      to_business_number TEXT,
      to_business_name TEXT,
      for_business_number TEXT,
      for_business_name TEXT,
      redirection_icon TEXT,
      redirection_url TEXT,
      ref_field_1 TEXT,
      ref_field_2 TEXT,
      user_note TEXT,
      replied_to_email_id TEXT,
      related_to_email_id TEXT,
      forwarded_from_email_id TEXT,
      seen_by_users TEXT,
      reactions TEXT,
      sender_display_name TEXT,
      attachment_url TEXT,
      attachment_name TEXT,
      email_opened TEXT,
      email_open_datetime TEXT,
      email_open_geo TEXT,
      custom_one TEXT,
      custom_two TEXT,
      custom_three TEXT,
      meta_fields TEXT,
      remarks TEXT,
      store_meta TEXT,
      workflow_meta TEXT,
      share_url TEXT,
      share_status TEXT,
      business_name TEXT,
      business_number TEXT,
      ref_business TEXT,
      ref_business_number TEXT,
      ref_user TEXT,
      ref_appname TEXT,
      ref_datetime TEXT,
      social_login_used TEXT,
      created_user TEXT,
      created_user_id TEXT,
      received_datetime TEXT,
      created_datetime TEXT DEFAULT (datetime('now')),
      updated_datetime TEXT DEFAULT (datetime('now')),
      app_name TEXT,
      is_sync INTEGER DEFAULT 0,
      ccusers_json TEXT DEFAULT '[]',
      bccusers_json TEXT DEFAULT '[]',
      from_email TEXT,
      to_email TEXT,
      from_user_name TEXT,
      to_user_name TEXT,
      from_mobile TEXT,
      to_mobile TEXT,
      from_user_uuid TEXT,
      to_user_uuid TEXT,
      from_fullname TEXT,
      to_fullname TEXT,
      body_rich_text_json TEXT DEFAULT '{}',
      email_files_json TEXT DEFAULT '[]',
      email_content_json TEXT DEFAULT '{}',
      is_archive INTEGER DEFAULT 0,
      progress_status TEXT,
      email_use_timeline TEXT DEFAULT '[]',
      message_group TEXT,
      message_type TEXT,
      message_category TEXT,
      email_sequence_json TEXT DEFAULT '[]',
      is_like INTEGER DEFAULT 0,
      is_dislike INTEGER DEFAULT 0,
      is_flag INTEGER DEFAULT 0,
      is_favourite INTEGER DEFAULT 0,
      user_uuid TEXT,
      created_user_uuid TEXT,
      updated_user_uuid TEXT,
      user_name TEXT,
      user_email TEXT,
      user_mobile TEXT,
      from_user_email TEXT,
      from_user_mobile TEXT,
      to_user_email TEXT,
      to_user_mobile TEXT,
      business_uuid TEXT,
      created_business_uuid TEXT,
      updated_business_uuid TEXT,
      for_business_uuid TEXT,
      ref_business_uuid TEXT,
      ref_business_name TEXT,
      from_business_uuid TEXT,
      from_business_email TEXT,
      from_business_mobile TEXT,
      to_business_uuid TEXT,
      to_business_email TEXT,
      to_business_mobile TEXT,
      email_group TEXT,
      user_id INTEGER,
      email_connection_json TEXT DEFAULT '{}',
      email_status_logs_json TEXT DEFAULT '[]',
      recipient_emails TEXT DEFAULT '[]',
      status_json TEXT DEFAULT '{}',
      progress_json TEXT DEFAULT '{}',
      progress_status_json TEXT DEFAULT '{}',
      ref_email_uuid TEXT,
      for_email_uuid TEXT,
      email_thread_json TEXT DEFAULT '[]',
      is_actionitem INTEGER DEFAULT 0,
      is_pin INTEGER DEFAULT 0,
      email_status TEXT DEFAULT 'active',
      is_template INTEGER DEFAULT 0,
      template_name TEXT,
      folder_name TEXT DEFAULT 'INBOX',
      is_open INTEGER DEFAULT 0,
      sent_server_email_uuid TEXT,
      inbox_server_email_uuid TEXT,
      sent_imap_id INTEGER,
      inbox_imap_id INTEGER,
      sub_folder_name TEXT,
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

    CREATE INDEX IF NOT EXISTS idx_local_emails_folder ON local_emails(folder_name);
    CREATE INDEX IF NOT EXISTS idx_local_emails_date ON local_emails(received_datetime DESC);
    CREATE INDEX IF NOT EXISTS idx_local_emails_read ON local_emails(is_read);
    CREATE INDEX IF NOT EXISTS idx_local_emails_uuid ON local_emails(email_uuid);
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
          email_id: list.length + 1,
          email_uuid: params[0],
          subject: params[6] || '(No Subject)',
          sender_email: params[7],
          sender_name: params[8],
          body: params[14],
          is_read: params[15] || 0,
          is_starred: params[16] || 0,
          folder_name: params[124] || 'INBOX',
          received_datetime: params[69] || new Date().toISOString(),
          created_datetime: new Date().toISOString(),
          updated_datetime: new Date().toISOString(),
          is_deleted: 0,
        };
        const filtered = list.filter((e) => e.email_uuid !== record.email_uuid);
        filtered.unshift(record);
        setItem('emails', filtered);
        return { changes: 1, lastInsertRowId: record.email_id };
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
        const uuid = params[params.length - 1];
        const updated = list.map((e) => (e.email_uuid === uuid ? { ...e, ...params } : e));
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
          return list.filter((e) => (e.folder_name || '').toLowerCase() === folder && !e.is_deleted);
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
        return list.find((e) => e.email_id === id || e.email_uuid === id) || null;
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
