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
