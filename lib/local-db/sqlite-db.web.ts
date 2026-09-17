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
        return list;
      }
      if (q.includes('LOCAL_CHAT_MESSAGES')) {
        const list = getItem('chat_messages');
        const convoId = params[0];
        if (convoId) {
          return list.filter((m) => m.conversation_id === convoId && !m.is_deleted);
        }
        return list.filter((m) => !m.is_deleted);
      }
      if (q.includes('LOCAL_CONTACTS')) {
        const list = getItem('contacts');
        const ownerId = params[0];
        if (ownerId) {
          return list.filter((c) => c.owner_id === ownerId);
        }
        return list;
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
      return null;
    },
  };
}
