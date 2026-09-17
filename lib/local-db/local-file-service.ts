import { getLocalDatabase } from './sqlite-db';
import type { LocalFileRecord } from './types';

export class LocalFileService {
  static async saveFile(file: LocalFileRecord): Promise<number | undefined> {
    const db = await getLocalDatabase();
    const result = await db.runAsync(
      `
      INSERT INTO local_files (
        file_uuid, mydoc_id, mydoc_list_id, status, created_user_id, created_user_name,
        ref_user_id, ref_user_name, created_date, updated_date, data_source_name,
        for_business_code, for_business_name, for_business_number, for_user_id, for_user_name,
        business_code, business_name, business_number, file_name, file_code, file_description,
        tabbed_form, template, template_name, chat_form, chatform_name, chatform_url,
        app_name, app_code, page_name, database_name, data_table_name, data_api_name,
        data_api_url, data_api_key, file_entries_table, file_entries_table_api, file_entries_api,
        publish_status, file_publish_date, file_publish_url, content, content_html,
        content_json, doc_json, visits, submissions, shareurl, shorturl, chatformshorturl,
        form_iframe_code, chatform_iframe_code, no_of_tabs, tab_name, tab_number, tab_order,
        tab_field_order, file_fields_json, file_fields_script, version_no, version_date,
        file_api, custom_text_one, custom_text_two, custom_no_one, custom_no_two,
        custom_json_one, custom_json_two, custom_json_three, file_no, ref_file, ref_file_no,
        file_group, plan_id, plan_name, plan_phase_id, task_id, task_name, ref_plan_name,
        ref_phase_name, ref_task_title, msg_id, doc_file_url, doc_file_json, flow_json,
        progress_json, status_log_json, user_log_json, business_log_json, agent_json,
        prompt_json, response_json, timeline_json, ref_business_code, ref_business_name,
        ref_business_number, file_type, folder_name, folder_group, sign_workflow_json,
        sign_progress_json, file_sign_complete_json, file_sign_image, sign_full_name,
        status_json, sign_task_uuid, sign_share_url, sign_chat_uuid, sign_message_uuid,
        org_roles_json, users_json, business_uuid, user_name, user_email, user_mobile,
        created_user_uuid, created_business_uuid, ref_business_uuid, user_id, is_important,
        is_flag, is_archive, is_favourite, is_pin, is_actionitem, is_delete, is_like,
        is_dislike, is_read, updated_business_uuid, updated_user_uuid, sub_folder_json,
        sub_folder_name, user_uuid, email_uuid, chat_uuid, from_user_uuid, to_user_uuid,
        month_id, month_uuid, month_name, financial_year_uuid, financial_id, financial_year,
        period_uuid, period_id, period_name
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, datetime('now'), datetime('now'), ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      );
    `,
      [
        file.file_uuid || `local-file-${Date.now()}`,
        file.mydoc_id || null,
        file.mydoc_list_id || null,
        file.status || 'active',
        file.created_user_id || null,
        file.created_user_name || null,
        file.ref_user_id || null,
        file.ref_user_name || null,
        file.data_source_name || null,
        file.for_business_code || null,
        file.for_business_name || null,
        file.for_business_number || null,
        file.for_user_id || null,
        file.for_user_name || null,
        file.business_code || null,
        file.business_name || null,
        file.business_number || null,
        file.file_name,
        file.file_code || null,
        file.file_description || '',
        file.tabbed_form ? 1 : 0,
        file.template ? 1 : 0,
        file.template_name || null,
        file.chat_form ? 1 : 0,
        file.chatform_name || null,
        file.chatform_url || null,
        file.app_name || null,
        file.app_code || null,
        file.page_name || null,
        file.database_name || null,
        file.data_table_name || null,
        file.data_api_name || null,
        file.data_api_url || null,
        file.data_api_key || null,
        file.file_entries_table || null,
        file.file_entries_table_api || null,
        file.file_entries_api || null,
        file.publish_status || 'draft',
        file.file_publish_date || null,
        file.file_publish_url || null,
        file.content || '',
        file.content_html || '',
        typeof file.content_json === 'string' ? file.content_json : JSON.stringify(file.content_json || {}),
        typeof file.doc_json === 'string' ? file.doc_json : JSON.stringify(file.doc_json || {}),
        file.visits || '0',
        file.submissions || '0',
        file.shareurl || null,
        file.shorturl || null,
        file.chatformshorturl || null,
        file.form_iframe_code || null,
        file.chatform_iframe_code || null,
        file.no_of_tabs || null,
        file.tab_name || null,
        file.tab_number || null,
        file.tab_order || null,
        typeof file.tab_field_order === 'string' ? file.tab_field_order : JSON.stringify(file.tab_field_order || {}),
        typeof file.file_fields_json === 'string' ? file.file_fields_json : JSON.stringify(file.file_fields_json || {}),
        typeof file.file_fields_script === 'string' ? file.file_fields_script : JSON.stringify(file.file_fields_script || {}),
        file.version_no || '1.0',
        file.version_date || new Date().toISOString(),
        file.file_api || null,
        file.custom_text_one || null,
        file.custom_text_two || null,
        file.custom_no_one || null,
        file.custom_no_two || null,
        typeof file.custom_json_one === 'string' ? file.custom_json_one : JSON.stringify(file.custom_json_one || {}),
        typeof file.custom_json_two === 'string' ? file.custom_json_two : JSON.stringify(file.custom_json_two || {}),
        typeof file.custom_json_three === 'string' ? file.custom_json_three : JSON.stringify(file.custom_json_three || {}),
        file.file_no || null,
        file.ref_file || null,
        file.ref_file_no || null,
        file.file_group || null,
        file.plan_id || null,
        file.plan_name || null,
        file.plan_phase_id || null,
        file.task_id || null,
        file.task_name || null,
        file.ref_plan_name || null,
        file.ref_phase_name || null,
        file.ref_task_title || null,
        file.msg_id || null,
        file.doc_file_url || null,
        typeof file.doc_file_json === 'string' ? file.doc_file_json : JSON.stringify(file.doc_file_json || {}),
        typeof file.flow_json === 'string' ? file.flow_json : JSON.stringify(file.flow_json || {}),
        typeof file.progress_json === 'string' ? file.progress_json : JSON.stringify(file.progress_json || {}),
        typeof file.status_log_json === 'string' ? file.status_log_json : JSON.stringify(file.status_log_json || []),
        typeof file.user_log_json === 'string' ? file.user_log_json : JSON.stringify(file.user_log_json || []),
        typeof file.business_log_json === 'string' ? file.business_log_json : JSON.stringify(file.business_log_json || []),
        typeof file.agent_json === 'string' ? file.agent_json : JSON.stringify(file.agent_json || {}),
        typeof file.prompt_json === 'string' ? file.prompt_json : JSON.stringify(file.prompt_json || {}),
        typeof file.response_json === 'string' ? file.response_json : JSON.stringify(file.response_json || {}),
        typeof file.timeline_json === 'string' ? file.timeline_json : JSON.stringify(file.timeline_json || []),
        file.ref_business_code || null,
        file.ref_business_name || null,
        file.ref_business_number || null,
        (file.file_type || 'DOC').toUpperCase(),
        file.folder_name || 'General',
        file.folder_group || null,
        typeof file.sign_workflow_json === 'string' ? file.sign_workflow_json : JSON.stringify(file.sign_workflow_json || {}),
        typeof file.sign_progress_json === 'string' ? file.sign_progress_json : JSON.stringify(file.sign_progress_json || {}),
        typeof file.file_sign_complete_json === 'string' ? file.file_sign_complete_json : JSON.stringify(file.file_sign_complete_json || {}),
        file.file_sign_image || null,
        file.sign_full_name || null,
        typeof file.status_json === 'string' ? file.status_json : JSON.stringify(file.status_json || {}),
        file.sign_task_uuid || null,
        file.sign_share_url || null,
        file.sign_chat_uuid || null,
        file.sign_message_uuid || null,
        typeof file.org_roles_json === 'string' ? file.org_roles_json : JSON.stringify(file.org_roles_json || {}),
        typeof file.users_json === 'string' ? file.users_json : JSON.stringify(file.users_json || []),
        file.business_uuid || null,
        file.user_name || null,
        file.user_email || null,
        file.user_mobile || null,
        file.created_user_uuid || null,
        file.created_business_uuid || null,
        file.ref_business_uuid || null,
        file.user_id || null,
        file.is_important ? 1 : 0,
        file.is_flag ? 1 : 0,
        file.is_archive ? 1 : 0,
        file.is_favourite ? 1 : 0,
        file.is_pin ? 1 : 0,
        file.is_actionitem ? 1 : 0,
        file.is_delete ? 1 : 0,
        file.is_like ? 1 : 0,
        file.is_dislike ? 1 : 0,
        file.is_read ? 1 : 0,
        file.updated_business_uuid || null,
        file.updated_user_uuid || null,
        typeof file.sub_folder_json === 'string' ? file.sub_folder_json : JSON.stringify(file.sub_folder_json || {}),
        file.sub_folder_name || null,
        file.user_uuid || null,
        file.email_uuid || null,
        file.chat_uuid || null,
        file.from_user_uuid || null,
        file.to_user_uuid || null,
        file.month_id || null,
        file.month_uuid || null,
        file.month_name || null,
        file.financial_year_uuid || null,
        file.financial_id || null,
        file.financial_year || null,
        file.period_uuid || null,
        file.period_id || null,
        file.period_name || null,
      ]
    );
    return result.lastInsertRowId;
  }

  static async getFilesByCategory(category: string, limit: number = 100, offset: number = 0): Promise<LocalFileRecord[]> {
    const db = await getLocalDatabase();
    if (!category || category === 'ALL') {
      const rows = await db.getAllAsync(
        `SELECT * FROM local_files WHERE is_delete = 0 ORDER BY created_date DESC LIMIT ? OFFSET ?;`,
        [limit, offset]
      );
      return rows as LocalFileRecord[];
    }
    const rows = await db.getAllAsync(
      `SELECT * FROM local_files WHERE file_type = ? AND is_delete = 0 ORDER BY created_date DESC LIMIT ? OFFSET ?;`,
      [category.toUpperCase(), limit, offset]
    );
    return rows as LocalFileRecord[];
  }

  static async getFilesByFolder(folderName: string = 'General', limit: number = 100, offset: number = 0): Promise<LocalFileRecord[]> {
    const db = await getLocalDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM local_files WHERE folder_name = ? AND is_delete = 0 ORDER BY created_date DESC LIMIT ? OFFSET ?;`,
      [folderName, limit, offset]
    );
    return rows as LocalFileRecord[];
  }

  static async getFileById(fileId: number): Promise<LocalFileRecord | null> {
    const db = await getLocalDatabase();
    const row = await db.getFirstAsync(`SELECT * FROM local_files WHERE file_id = ?;`, [fileId]);
    return (row as LocalFileRecord) || null;
  }

  static async deleteFile(fileId: number, permanent: boolean = false): Promise<void> {
    const db = await getLocalDatabase();
    if (permanent) {
      await db.runAsync(`DELETE FROM local_files WHERE file_id = ?;`, [fileId]);
    } else {
      await db.runAsync(`UPDATE local_files SET is_delete = 1, updated_date = datetime('now') WHERE file_id = ?;`, [fileId]);
    }
  }

  static async searchFiles(query: string, fileType?: string): Promise<LocalFileRecord[]> {
    const db = await getLocalDatabase();
    const searchTerm = `%${query.toLowerCase()}%`;
    if (fileType && fileType !== 'ALL') {
      const rows = await db.getAllAsync(
        `SELECT * FROM local_files WHERE file_type = ? AND is_delete = 0 AND (file_name LIKE ? OR file_description LIKE ? OR folder_name LIKE ?) ORDER BY created_date DESC;`,
        [fileType.toUpperCase(), searchTerm, searchTerm, searchTerm]
      );
      return rows as LocalFileRecord[];
    } else {
      const rows = await db.getAllAsync(
        `SELECT * FROM local_files WHERE is_delete = 0 AND (file_name LIKE ? OR file_description LIKE ? OR folder_name LIKE ?) ORDER BY created_date DESC;`,
        [searchTerm, searchTerm, searchTerm]
      );
      return rows as LocalFileRecord[];
    }
  }
}
