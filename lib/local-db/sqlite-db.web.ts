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
