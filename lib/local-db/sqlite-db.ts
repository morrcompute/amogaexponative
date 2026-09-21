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
    CREATE INDEX IF NOT EXISTS idx_local_files_uuid ON local_files(file_uuid);

    -- Also create file table (alias schema matching exact table naming)
    CREATE TABLE IF NOT EXISTS file (
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

    CREATE INDEX IF NOT EXISTS idx_file_type ON file(file_type);
    CREATE INDEX IF NOT EXISTS idx_file_folder ON file(folder_name);
    CREATE INDEX IF NOT EXISTS idx_file_status ON file(status);
    CREATE INDEX IF NOT EXISTS idx_file_uuid ON file(file_uuid);
  `);

  // 3. Create local_conversations table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      image TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      unread_count INTEGER DEFAULT 0,
      last_message_text TEXT,
      last_message_time TEXT,
      other_member_json TEXT,
      members_count INTEGER DEFAULT 2
    );

    CREATE INDEX IF NOT EXISTS idx_local_convos_updated ON local_conversations(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_local_convos_type ON local_conversations(type);
  `);

  // 4. Create local_conversation_members table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_conversation_members (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      unread_count INTEGER DEFAULT 0,
      joined_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_local_members_convo ON local_conversation_members(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_local_members_user ON local_conversation_members(user_id);
  `);

  // 5. Create local_chat_messages table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      sender_user_id TEXT NOT NULL,
      message TEXT,
      message_type TEXT DEFAULT 'text',
      direction TEXT NOT NULL,
      sent INTEGER DEFAULT 1,
      received INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      duration INTEGER,
      thumbnail TEXT,
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'synced',
      replyto_message_id TEXT,
      replyto_user_id TEXT,
      replyto_content TEXT,
      replyemoji TEXT,
      forwardto_message_id TEXT,
      sender_message_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_local_chat_msgs_convo ON local_chat_messages(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_local_chat_msgs_owner ON local_chat_messages(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_local_chat_msgs_sync ON local_chat_messages(sync_status);
  `);

  // 6. Create local_contacts table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_contacts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      contact_user_id TEXT NOT NULL,
      name TEXT,
      nickname TEXT,
      email TEXT,
      mobile TEXT,
      avatar TEXT,
      avatar_url TEXT,
      status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_local_contacts_owner ON local_contacts(owner_id);
    CREATE INDEX IF NOT EXISTS idx_local_contacts_target ON local_contacts(contact_user_id);
  `);

  // 7. Create auth_users table (exact mirror of Supabase auth.users for signup and signin)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      aud TEXT DEFAULT 'authenticated',
      role TEXT DEFAULT 'authenticated',
      email TEXT UNIQUE,
      encrypted_password TEXT,
      email_confirmed_at TEXT,
      invited_at TEXT,
      confirmation_token TEXT,
      confirmation_sent_at TEXT,
      recovery_token TEXT,
      recovery_sent_at TEXT,
      email_change_token_new TEXT,
      email_change TEXT,
      email_change_sent_at TEXT,
      last_sign_in_at TEXT,
      raw_app_meta_data TEXT DEFAULT '{"provider":"email","providers":["email"]}',
      raw_user_meta_data TEXT DEFAULT '{}',
      is_super_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      phone TEXT,
      phone_confirmed_at TEXT,
      phone_change TEXT,
      phone_change_token TEXT,
      phone_change_sent_at TEXT,
      confirmed_at TEXT,
      email_change_token_current TEXT,
      email_change_confirm_status INTEGER DEFAULT 0,
      banned_until TEXT,
      reauthentication_token TEXT,
      reauthentication_sent_at TEXT,
      is_sso_user INTEGER DEFAULT 0,
      deleted_at TEXT,
      is_anonymous INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
  `);

  // 8. Create profiles table (exact mirror of Supabase public.profiles linked to auth_users)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
      name TEXT,
      username TEXT,
      display_name TEXT,
      avatar TEXT,
      avatar_url TEXT,
      email TEXT,
      company TEXT,
      mobile TEXT,
      fcm_token TEXT,
      status TEXT DEFAULT 'offline',
      online INTEGER DEFAULT 0,
      offline INTEGER DEFAULT 1,
      last_seen TEXT,
      onboarded INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  `);

  // 9. Create auth_sessions table (exact mirror of Supabase auth.sessions)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      factor_id TEXT,
      aal TEXT DEFAULT 'aal1',
      not_after TEXT,
      refreshed_at TEXT,
      user_agent TEXT,
      ip TEXT,
      tag TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
  `);

  // 10. Create app_contact table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_contact (
      app_contact_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT 'active',
      description TEXT,
      user_note TEXT,
      icon TEXT,
      document_no TEXT,
      document_status TEXT,
      user_status TEXT,
      user_group_list TEXT,
      flow_routing TEXT,
      progress_status TEXT,
      performance_status TEXT,
      profile_rating_note TEXT,
      contact_user TEXT,
      personal_user TEXT,
      business_user TEXT,
      prefix_title TEXT,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      date_of_birth TEXT,
      user_email TEXT,
      user_mobile TEXT,
      user_otp TEXT,
      user_name TEXT,
      password TEXT,
      retype_password TEXT,
      avatar_url TEXT,
      profile_pic_url TEXT,
      profile_url TEXT,
      roles TEXT,
      start_date TEXT,
      end_date TEXT,
      business_role_title TEXT,
      business_roles TEXT,
      designation TEXT,
      department TEXT,
      branch TEXT,
      business_category TEXT,
      business_size TEXT,
      for_business_name TEXT,
      for_business_number TEXT,
      business_name TEXT,
      company_name TEXT,
      business_registration_type TEXT,
      business_registration_no TEXT,
      business_registration_file TEXT,
      business_tagline TEXT,
      business_intro TEXT,
      business_description TEXT,
      business_short_description TEXT,
      business_profile_url TEXT,
      business_logo_url TEXT,
      business_website TEXT,
      business_address_1 TEXT,
      business_address_2 TEXT,
      business_country TEXT,
      business_state TEXT,
      business_city TEXT,
      business_area TEXT,
      business_postcode TEXT,
      business_geo_lat TEXT,
      business_geo_long TEXT,
      business_geo_map_url TEXT,
      billing_first_name TEXT,
      billing_last_name TEXT,
      billing_company TEXT,
      billing_phone TEXT,
      billing_email TEXT,
      billing_address_1 TEXT,
      billing_address_2 TEXT,
      billing_country TEXT,
      billing_state TEXT,
      billing_city TEXT,
      billing_postcode TEXT,
      shipping_first_name TEXT,
      shipping_last_name TEXT,
      shipping_company TEXT,
      shipping_phone TEXT,
      shipping_email TEXT,
      shipping_address_1 TEXT,
      shipping_address_2 TEXT,
      shipping_country TEXT,
      shipping_state TEXT,
      shipping_city TEXT,
      shipping_postcode TEXT,
      paying_customer TEXT,
      new_user_join TEXT,
      vacaton_mode TEXT,
      working_days TEXT,
      opening_time TEXT,
      closing_time TEXT,
      geo_lat TEXT,
      geo_long TEXT,
      geo_map_url TEXT,
      social_login_used TEXT,
      social_login_provider TEXT,
      social_login_username TEXT,
      loggedin_status TEXT,
      business TEXT,
      business_number TEXT,
      ref_business TEXT,
      ref_business_number TEXT,
      ref_user TEXT,
      ref_appname TEXT,
      ref_app_id INTEGER,
      ref_datetime TEXT,
      created_user TEXT,
      created_userid INTEGER,
      created_datetime TEXT DEFAULT (datetime('now')),
      app_name TEXT,
      business_email TEXT,
      business_phone_no TEXT,
      billing_address_text TEXT,
      shipping_address_text TEXT,
      registration_number TEXT,
      passport_number TEXT,
      identity_number TEXT,
      tin_number TEXT,
      sst_number TEXT,
      tourism_tax_number TEXT,
      msic_number TEXT,
      classification_code TEXT,
      digital_signature TEXT,
      digital_signature_file TEXT,
      import_license_no TEXT,
      export_license_no TEXT,
      emailverify INTEGER DEFAULT 0,
      mobileverify INTEGER DEFAULT 0,
      whatsappverify INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_token_expiry TEXT,
      signup_social_login TEXT,
      preferred_login_mode TEXT,
      card_type TEXT,
      html_content TEXT,
      custom_one TEXT,
      custom_two TEXT,
      custom_three TEXT,
      custom_text_area TEXT,
      custom_json_one TEXT DEFAULT '{}',
      custom_json_two TEXT DEFAULT '{}',
      custom_json_three TEXT DEFAULT '{}',
      api_connection_one TEXT,
      api_connection_json TEXT DEFAULT '{}',
      roles_json TEXT DEFAULT '{}',
      full_name TEXT,
      aiapi_connection_json TEXT DEFAULT '{}',
      db_connection_json TEXT DEFAULT '{}',
      cdb_table_scope TEXT DEFAULT '{}',
      created_user_name TEXT,
      created_user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      flow_json TEXT DEFAULT '{}',
      progress_json TEXT DEFAULT '{}',
      status_log_json TEXT DEFAULT '[]',
      user_log_json TEXT DEFAULT '[]',
      agent_json TEXT DEFAULT '{}',
      prompt_json TEXT DEFAULT '{}',
      response_json TEXT DEFAULT '{}',
      timeline_json TEXT DEFAULT '[]',
      business_log_json TEXT DEFAULT '[]',
      for_business_code TEXT,
      agent_uuid TEXT,
      form_uuid TEXT,
      form_setup_id TEXT,
      legal_business_name TEXT,
      store_name TEXT,
      store_url TEXT,
      store_email TEXT,
      store_mobile TEXT,
      fcm_token TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      push_tokens TEXT DEFAULT '[]',
      ai_connection_json TEXT DEFAULT '{}',
      user_group TEXT,
      user_org_roles TEXT DEFAULT '{}',
      paymentsetup_json TEXT DEFAULT '{}',
      business_uuid TEXT,
      ref_business_name TEXT,
      ref_business_uuid TEXT,
      for_business_uuid TEXT,
      created_user_uuid TEXT,
      created_business_uuid TEXT,
      updated_user_uuid TEXT,
      updated_business_uuid TEXT,
      contact_uuid TEXT,
      contact_id INTEGER,
      department_json TEXT DEFAULT '{}',
      org_roles TEXT DEFAULT '{}',
      email_settings_json TEXT DEFAULT '{}',
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
      supa_name TEXT,
      supa_email TEXT,
      supa_avatar TEXT,
      supa_company TEXT,
      supa_mobile TEXT,
      supa_created_at TEXT,
      supa_status TEXT,
      supa_online INTEGER DEFAULT 0,
      supa_offline INTEGER DEFAULT 0,
      supa_last_seen TEXT,
      supa_updated_at TEXT,
      supa_auth_user_id TEXT,
      supa_fcm_token TEXT,
      supa_profiles_uuid TEXT,
      supa_auth_uid TEXT,
      supa_auth_display_name TEXT,
      supa_auth_email TEXT,
      supa_auth_phone TEXT,
      supa_auth_provider TEXT,
      supa_auth_provider_type TEXT,
      supa_auth_created_at TEXT,
      supa_auth_last_sign_in_at TEXT,
      billing_full_address TEXT DEFAULT '{}',
      shipping_full_address TEXT DEFAULT '{}',
      user_roles TEXT DEFAULT '{}',
      is_role_menu INTEGER DEFAULT 0,
      is_org_role_menu INTEGER DEFAULT 0,
      side_menu_json TEXT DEFAULT '{}',
      is_web INTEGER DEFAULT 0,
      is_mobile INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_app_contact_email ON app_contact(user_email);
    CREATE INDEX IF NOT EXISTS idx_app_contact_uuid ON app_contact(contact_uuid);
    CREATE INDEX IF NOT EXISTS idx_app_contact_supa_uid ON app_contact(supa_auth_uid);
    CREATE INDEX IF NOT EXISTS idx_app_contact_supa_auth_user ON app_contact(supa_auth_user_id);
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

      if (q.startsWith('INSERT INTO LOCAL_CONVERSATIONS')) {
        const list = getItem('conversations');
        const record: any = {
          id: params[0],
          type: params[1],
          name: params[2],
          image: params[3],
          created_by: params[4],
          created_at: params[5] || new Date().toISOString(),
          updated_at: params[6] || new Date().toISOString(),
          unread_count: params[7] || 0,
          last_message_text: params[8] || '',
          last_message_time: params[9] || new Date().toISOString(),
          other_member_json: params[10] || null,
          members_count: params[11] || 2,
        };
        const filtered = list.filter((c) => c.id !== record.id);
        filtered.unshift(record);
        setItem('conversations', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('UPDATE LOCAL_CONVERSATIONS')) {
        const list = getItem('conversations');
        const id = params[params.length - 1];
        const updated = list.map((c) => (c.id === id ? { ...c, ...params } : c));
        setItem('conversations', updated);
        return { changes: 1 };
      }

      if (q.startsWith('INSERT INTO LOCAL_CHAT_MESSAGES')) {
        const list = getItem('chat_messages');
        const record: any = {
          id: params[0],
          conversation_id: params[1],
          owner_user_id: params[2],
          sender_user_id: params[3],
          message: params[4] || '',
          message_type: params[5] || 'text',
          direction: params[6],
          sent: params[7] ?? 1,
          received: params[8] ?? 0,
          created_at: params[9] || new Date().toISOString(),
          file_url: params[10] || null,
          file_name: params[11] || null,
          file_size: params[12] || null,
          mime_type: params[13] || null,
          duration: params[14] || null,
          thumbnail: params[15] || null,
          is_read: params[16] || 0,
          is_starred: params[17] || 0,
          is_pinned: params[18] || 0,
          is_deleted: params[19] || 0,
          sync_status: params[20] || 'synced',
          replyto_message_id: params[21] || null,
          replyto_user_id: params[22] || null,
          replyto_content: params[23] || null,
          replyemoji: params[24] || null,
          forwardto_message_id: params[25] || null,
          sender_message_id: params[26] || null,
        };
        const filtered = list.filter((m) => m.id !== record.id);
        filtered.push(record);
        setItem('chat_messages', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('UPDATE LOCAL_CHAT_MESSAGES')) {
        const list = getItem('chat_messages');
        const id = params[params.length - 1];
        const updated = list.map((m) => (m.id === id ? { ...m, ...params } : m));
        setItem('chat_messages', updated);
        return { changes: 1 };
      }

      if (q.startsWith('INSERT INTO LOCAL_CONTACTS')) {
        const list = getItem('contacts');
        const record: any = {
          id: params[0],
          owner_id: params[1],
          contact_user_id: params[2],
          name: params[3],
          nickname: params[4],
          email: params[5],
          mobile: params[6],
          avatar: params[7],
          avatar_url: params[8],
          status: params[9],
          created_at: params[10] || new Date().toISOString(),
        };
        const filtered = list.filter((c) => c.id !== record.id);
        filtered.push(record);
        setItem('contacts', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('INSERT INTO AUTH_USERS')) {
        const list = getItem('auth_users');
        const record: any = {
          id: params[0],
          email: params[1],
          encrypted_password: params[2],
          raw_user_meta_data: typeof params[3] === 'object' ? JSON.stringify(params[3]) : params[3] || '{}',
          raw_app_meta_data: params[4] || '{"provider":"email","providers":["email"]}',
          created_at: params[5] || new Date().toISOString(),
          updated_at: params[6] || new Date().toISOString(),
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: new Date().toISOString(),
        };
        const filtered = list.filter((u) => u.id !== record.id && u.email !== record.email);
        filtered.push(record);
        setItem('auth_users', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('UPDATE AUTH_USERS')) {
        const list = getItem('auth_users');
        const id = params[params.length - 1];
        const updated = list.map((u) => (u.id === id || u.email === id ? { ...u, ...params } : u));
        setItem('auth_users', updated);
        return { changes: 1 };
      }

      if (q.startsWith('INSERT INTO PROFILES')) {
        const list = getItem('profiles');
        const record: any = {
          id: params[0],
          name: params[1] || null,
          display_name: params[2] || params[1] || null,
          email: params[3] || null,
          avatar: params[4] || null,
          avatar_url: params[5] || params[4] || null,
          mobile: params[6] || null,
          status: 'offline',
          online: 0,
          offline: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const filtered = list.filter((p) => p.id !== record.id);
        filtered.push(record);
        setItem('profiles', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('UPDATE PROFILES')) {
        const list = getItem('profiles');
        const id = params[params.length - 1];
        const updated = list.map((p) => (p.id === id ? { ...p, ...params } : p));
        setItem('profiles', updated);
        return { changes: 1 };
      }

      if (q.startsWith('INSERT INTO AUTH_SESSIONS')) {
        const list = getItem('auth_sessions');
        const record: any = {
          id: params[0],
          user_id: params[1],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const filtered = list.filter((s) => s.id !== record.id);
        filtered.push(record);
        setItem('auth_sessions', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('INSERT INTO APP_CONTACT')) {
        const list = getItem('app_contact');
        const record: any = {
          app_contact_id: list.length + 1,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (params.length > 0 && typeof params[0] === 'object') {
          Object.assign(record, params[0]);
        }
        list.push(record);
        setItem('app_contact', list);
        return { changes: 1, lastInsertRowId: record.app_contact_id };
      }

      if (q.startsWith('UPDATE APP_CONTACT')) {
        const list = getItem('app_contact');
        const id = params[params.length - 1];
        const updated = list.map((c) => (c.app_contact_id === id || c.contact_uuid === id ? { ...c, ...params } : c));
        setItem('app_contact', updated);
        return { changes: 1 };
      }

      if (q.startsWith('INSERT INTO LOCAL_CONVERSATION_MEMBERS')) {
        const list = getItem('conversation_members');
        const record: any = {
          id: params[0],
          conversation_id: params[1],
          user_id: params[2],
          role: params[3] || 'member',
          unread_count: params[4] || 0,
          joined_at: params[5] || new Date().toISOString(),
        };
        const filtered = list.filter((m) => m.id !== record.id);
        filtered.push(record);
        setItem('conversation_members', filtered);
        return { changes: 1, lastInsertRowId: 1 };
      }

      if (q.startsWith('DELETE FROM LOCAL_CONVERSATION_MEMBERS')) {
        if (params[0]) {
          const list = getItem('conversation_members');
          setItem('conversation_members', list.filter((m) => m.user_id !== params[0] && m.conversation_id !== params[0]));
        } else {
          setItem('conversation_members', []);
        }
        return { changes: 1 };
      }

      if (q.startsWith('DELETE FROM LOCAL_CHAT_MESSAGES')) {
        if (params[0]) {
          const list = getItem('chat_messages');
          setItem('chat_messages', list.filter((m) => m.owner_user_id !== params[0]));
        } else {
          setItem('chat_messages', []);
        }
        return { changes: 1 };
      }

      if (q.startsWith('DELETE FROM LOCAL_CONTACTS')) {
        if (params[0]) {
          const list = getItem('contacts');
          setItem('contacts', list.filter((c) => c.owner_id !== params[0]));
        } else {
          setItem('contacts', []);
        }
        return { changes: 1 };
      }

      if (q.startsWith('DELETE FROM LOCAL_CONVERSATIONS')) {
        setItem('conversations', []);
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
      if (q.includes('LOCAL_CONVERSATIONS')) {
        const list = getItem('conversations');
        const userId = params[0];
        if (userId) {
          const members = getItem('conversation_members');
          const myConvoIds = new Set(
            members.filter((m: any) => m.user_id === userId).map((m: any) => m.conversation_id)
          );
          return list.filter((c: any) => myConvoIds.has(c.id) || c.created_by === userId);
        }
        return list;
      }
      if (q.includes('LOCAL_CHAT_MESSAGES')) {
        const list = getItem('chat_messages');
        const convoId = params[0];
        const userId = typeof params[1] === 'string' && params[1].length > 10 ? params[1] : null;
        return list.filter((m: any) => {
          if (m.is_deleted) return false;
          if (convoId && m.conversation_id !== convoId) return false;
          if (userId && m.owner_user_id && m.owner_user_id !== userId) return false;
          return true;
        });
      }
      if (q.includes('LOCAL_CONTACTS')) {
        const list = getItem('contacts');
        const ownerId = params[0];
        if (ownerId) {
          return list.filter((c) => c.owner_id === ownerId);
        }
        return list.filter((c) => c);
      }
      if (q.includes('AUTH_USERS')) {
        return getItem('auth_users');
      }
      if (q.includes('PROFILES')) {
        return getItem('profiles');
      }
      if (q.includes('AUTH_SESSIONS')) {
        return getItem('auth_sessions');
      }
      if (q.includes('APP_CONTACT')) {
        return getItem('app_contact');
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
      if (q.includes('LOCAL_CONVERSATIONS')) {
        const list = getItem('conversations');
        const id = params[0];
        return list.find((c) => c.id === id) || null;
      }
      if (q.includes('LOCAL_CHAT_MESSAGES')) {
        const list = getItem('chat_messages');
        const id = params[0];
        return list.find((m) => m.id === id) || null;
      }
      if (q.includes('LOCAL_CONTACTS')) {
        const list = getItem('contacts');
        const id = params[0];
        return list.find((c) => c.id === id) || null;
      }
      if (q.includes('AUTH_USERS')) {
        const list = getItem('auth_users');
        const idOrEmail = params[0];
        return list.find((u) => u.id === idOrEmail || u.email === idOrEmail) || null;
      }
      if (q.includes('PROFILES')) {
        const list = getItem('profiles');
        const id = params[0];
        return list.find((p) => p.id === id || p.email === id) || null;
      }
      if (q.includes('AUTH_SESSIONS')) {
        const list = getItem('auth_sessions');
        const id = params[0];
        return list.find((s) => s.id === id || s.user_id === id) || null;
      }
      if (q.includes('APP_CONTACT')) {
        const list = getItem('app_contact');
        const id = params[0];
        return list.find((c) => c.app_contact_id === id || c.contact_uuid === id || c.user_email === id || c.supa_auth_uid === id) || null;
      }
      return null;
    },
  };
}


