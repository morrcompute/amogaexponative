// Web-specific Local DB Implementation
// Does NOT import or require expo-sqlite to avoid native module errors on Web/Vercel

let dbInstance: any = null;

export async function getLocalDatabase() {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = createWebMockDb();
  return dbInstance;
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
          phone: params[2] || null,
          raw_user_meta_data: typeof params[3] === 'object' ? JSON.stringify(params[3]) : params[3] || '{}',
          raw_app_meta_data: typeof params[4] === 'object' ? JSON.stringify(params[4]) : params[4] || '{"provider":"email","providers":["email"]}',
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
          company: params[7] || null,
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

      if (q.startsWith('INSERT INTO APP_NOTIFICATION')) {
        const list = getItem('app_notifications');
        const record: any = {
          app_notification_id: list.length + 1,
          app_notification_uuid: params[0],
          status: params[1] || 'sent',
          user_email_account_id: params[2] || null,
          subject: params[3] || '(No Subject)',
          sender_email: params[4] || null,
          sender_name: params[5] || null,
          full_name: params[6] || null,
          sender_mobile: params[7] || null,
          recipient_mobiles: params[8] || null,
          cc_emails: params[9] || null,
          bcc_emails: params[10] || null,
          body: params[11] || '',
          is_read: params[12] !== undefined ? (params[12] ? 1 : 0) : 1,
          is_starred: params[13] !== undefined ? (params[13] ? 1 : 0) : 0,
          is_important: params[14] !== undefined ? (params[14] ? 1 : 0) : 0,
          is_draft: params[15] !== undefined ? (params[15] ? 1 : 0) : 0,
          is_deleted: params[16] !== undefined ? (params[16] ? 1 : 0) : 0,
          has_attachments: params[17] !== undefined ? (params[17] ? 1 : 0) : 0,
          created_user: params[18] || null,
          created_user_id: params[19] || null,
          received_datetime: params[20] || new Date().toISOString(),
          created_datetime: params[21] || new Date().toISOString(),
          updated_datetime: params[22] || new Date().toISOString(),
          ccusers_json: params[23] || '[]',
          bccusers_json: params[24] || '[]',
          from_email: params[25] || null,
          to_email: params[26] || null,
          from_user_name: params[27] || null,
          to_user_name: params[28] || null,
          from_mobile: params[29] || null,
          to_mobile: params[30] || null,
          from_user_uuid: params[31] || null,
          to_user_uuid: params[32] || null,
          from_fullname: params[33] || null,
          to_fullname: params[34] || null,
          email_files_json: params[35] || '[]',
          is_archive: params[36] !== undefined ? (params[36] ? 1 : 0) : 0,
          is_like: params[37] !== undefined ? (params[37] ? 1 : 0) : 0,
          is_dislike: params[38] !== undefined ? (params[38] ? 1 : 0) : 0,
          is_flag: params[39] !== undefined ? (params[39] ? 1 : 0) : 0,
          is_favourite: params[40] !== undefined ? (params[40] ? 1 : 0) : 0,
          user_uuid: params[41] || null,
          created_user_uuid: params[42] || null,
          updated_user_uuid: params[43] || null,
          user_name: params[44] || null,
          user_email: params[45] || null,
          user_mobile: params[46] || null,
          from_user_email: params[47] || null,
          from_user_mobile: params[48] || null,
          to_user_email: params[49] || null,
          to_user_mobile: params[50] || null,
          month_name: params[51] || null,
          folder_name: params[52] || (params[15] ? 'Drafts' : 'Sent'),
          is_sync: params[53] !== undefined ? (params[53] ? 1 : 0) : 0,
        };
        const filtered = list.filter((n: any) => n.app_notification_uuid !== record.app_notification_uuid);
        filtered.unshift(record);
        setItem('app_notifications', filtered);
        return { changes: 1, lastInsertRowId: record.app_notification_id };
      }

      if (q.startsWith('UPDATE APP_NOTIFICATION')) {
        const list = getItem('app_notifications');
        const uuid = params[params.length - 1];
        if (q.includes('IS_READ')) {
          const val = params[0];
          const updated = list.map((n: any) => (n.app_notification_uuid === uuid || n.app_notification_id === uuid ? { ...n, is_read: val ? 1 : 0 } : n));
          setItem('app_notifications', updated);
        } else if (q.includes('IS_STARRED')) {
          const val = params[0];
          const updated = list.map((n: any) => (n.app_notification_uuid === uuid || n.app_notification_id === uuid ? { ...n, is_starred: val ? 1 : 0, is_important: val ? 1 : 0 } : n));
          setItem('app_notifications', updated);
        } else if (q.includes('IS_DELETED')) {
          const updated = list.map((n: any) => (n.app_notification_uuid === uuid || n.app_notification_id === uuid ? { ...n, is_deleted: 1 } : n));
          setItem('app_notifications', updated);
        } else if (q.includes('IS_SYNC')) {
          const updated = list.map((n: any) => (n.app_notification_uuid === uuid || n.app_notification_id === uuid ? { ...n, is_sync: 1 } : n));
          setItem('app_notifications', updated);
        }
        return { changes: 1 };
      }

      if (q.startsWith('DELETE FROM APP_NOTIFICATION')) {
        const id = params[0];
        if (id) {
          const list = getItem('app_notifications');
          setItem('app_notifications', list.filter((n: any) => n.app_notification_uuid !== id && n.app_notification_id !== id));
        } else {
          setItem('app_notifications', []);
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
        return list;
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
      if (q.includes('APP_NOTIFICATION')) {
        const list = getItem('app_notifications');
        return list.filter((n: any) => !n.is_deleted);
      }
      return [];
    },
    getFirstAsync: async (query: string, params: any[] = []) => {
      const q = query.trim().toUpperCase();
      if (q.includes('APP_NOTIFICATION')) {
        const list = getItem('app_notifications');
        const id = params[0];
        return list.find((n: any) => n.app_notification_id === id || n.app_notification_uuid === id) || null;
      }
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

/**
 * Persists Supabase auth user metadata and profile locally into browser SQLite / localStorage mock.
 */
export async function saveLocalProfile(profile: any, userMetadata?: any, appMetadata?: any) {
  if (!profile?.id) return;
  try {
    const db = await getLocalDatabase();
    const rawUserMeta = typeof userMetadata === 'object' ? JSON.stringify(userMetadata) : (userMetadata || '{}');
    const rawAppMeta = typeof appMetadata === 'object' ? JSON.stringify(appMetadata) : (appMetadata || '{"provider":"email","providers":["email"]}');

    // 1. Save or update auth_users record
    await db.runAsync(
      `INSERT INTO auth_users (id, email, phone, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         email = COALESCE(excluded.email, auth_users.email),
         phone = COALESCE(excluded.phone, auth_users.phone),
         raw_user_meta_data = COALESCE(excluded.raw_user_meta_data, auth_users.raw_user_meta_data),
         raw_app_meta_data = COALESCE(excluded.raw_app_meta_data, auth_users.raw_app_meta_data),
         updated_at = datetime('now')`,
      [
        profile.id,
        profile.email || null,
        profile.mobile || null,
        rawUserMeta,
        rawAppMeta,
      ]
    );

    // 2. Save or update profiles record
    await db.runAsync(
      `INSERT INTO profiles (id, name, display_name, email, avatar, avatar_url, mobile, company, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = COALESCE(excluded.name, profiles.name),
         display_name = COALESCE(excluded.display_name, profiles.display_name),
         email = COALESCE(excluded.email, profiles.email),
         avatar = COALESCE(excluded.avatar, profiles.avatar),
         avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
         mobile = COALESCE(excluded.mobile, profiles.mobile),
         company = COALESCE(excluded.company, profiles.company),
         updated_at = datetime('now')`,
      [
        profile.id,
        profile.name || null,
        profile.display_name || profile.name || null,
        profile.email || null,
        profile.avatar || null,
        profile.avatar_url || profile.avatar || null,
        profile.mobile || null,
        profile.company || null,
      ]
    );
  } catch (err) {
    console.warn('Error saving profile to local SQLite (web):', err);
  }
}

/**
 * Fetches a user's profile from local SQLite / localStorage mock.
 */
export async function getLocalProfile(userId: string) {
  if (!userId) return null;
  try {
    const db = await getLocalDatabase();
    return await db.getFirstAsync(`SELECT * FROM profiles WHERE id = ? LIMIT 1`, [userId]);
  } catch (err) {
    console.warn('Error reading local profile (web):', err);
    return null;
  }
}

/**
 * Fetches a user's auth record from local SQLite auth_users table.
 */
export async function getLocalUser(userId: string) {
  if (!userId) return null;
  try {
    const db = await getLocalDatabase();
    return await db.getFirstAsync(`SELECT * FROM auth_users WHERE id = ? LIMIT 1`, [userId]);
  } catch (err) {
    console.warn('Error reading local user (web):', err);
    return null;
  }
}
