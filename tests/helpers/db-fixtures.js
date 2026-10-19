import { PARAMETERS } from '@/config';

export const PROJECT_REF = 'project-ref';
export const FORM_REF = 'form-ref';
export const SERVER_URL = 'https://server.test';

/**
 * Insert a fully-specified row, deriving the column list and placeholders from
 * the object keys so fixtures cannot drift from the column/param order.
 */
export function insertRow(db, table, row) {
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(',');
    const values = columns.map((column) => row[column]);
    db.run(
        'INSERT INTO ' + table + ' (' + columns.join(',') + ') VALUES (' + placeholders + ')',
        values
    );
    return row;
}

export function seedProject(db, overrides = {}) {
    return insertRow(db, 'projects', {
        name: 'Project',
        slug: 'project',
        logo_thumb: '',
        project_ref: PROJECT_REF,
        json_extra: '{}',
        server_url: SERVER_URL,
        last_updated: '2026-01-01T00:00:00.000Z',
        mapping: '[]',
        ...overrides
    });
}

export function seedUser(db, overrides = {}) {
    return insertRow(db, 'users', {
        jwt: 'jwt-token',
        name: 'User',
        email: 'user@example.com',
        ...overrides
    });
}

export function seedEntry(db, overrides = {}) {
    return insertRow(db, 'entries', {
        entry_uuid: 'entry-1',
        parent_entry_uuid: '',
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        parent_form_ref: '',
        answers: JSON.stringify({ q1: 'a1' }),
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        title: 'Entry 1',
        synced: PARAMETERS.SYNCED_CODES.SYNCED,
        synced_error: '',
        can_edit: 0,
        is_remote: PARAMETERS.REMOTE_CODES.IS,
        ...overrides
    });
}

export function seedBranchEntry(db, overrides = {}) {
    return insertRow(db, 'branch_entries', {
        entry_uuid: 'branch-1',
        owner_entry_uuid: 'entry-1',
        owner_input_ref: 'branch-input',
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        answers: JSON.stringify({ b1: 'a1' }),
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        title: 'Branch 1',
        synced: PARAMETERS.SYNCED_CODES.SYNCED,
        synced_error: '',
        can_edit: 0,
        is_remote: PARAMETERS.REMOTE_CODES.IS,
        ...overrides
    });
}

export function seedTempBranchEntry(db, overrides = {}) {
    return insertRow(db, 'temp_branch_entries', {
        entry_uuid: 'temp-branch-1',
        owner_entry_uuid: 'entry-1',
        owner_input_ref: 'branch-input',
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        answers: JSON.stringify({ b1: 'a1' }),
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        title: 'Temp branch 1',
        synced: PARAMETERS.SYNCED_CODES.UNSYNCED,
        synced_error: '',
        can_edit: 0,
        is_remote: PARAMETERS.REMOTE_CODES.ISNT,
        ...overrides
    });
}

export function seedMedia(db, overrides = {}) {
    return insertRow(db, 'media', {
        entry_uuid: 'entry-1',
        branch_entry_uuid: '',
        input_ref: 'photo-input',
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        file_name: 'photo.jpg',
        file_path: '/photos/photo.jpg',
        file_type: PARAMETERS.QUESTION_TYPES.PHOTO,
        synced: PARAMETERS.SYNCED_CODES.SYNCED,
        synced_error: '',
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides
    });
}

export function seedUniqueAnswer(db, overrides = {}, temporary = false) {
    return insertRow(db, temporary ? 'temp_unique_answers' : 'unique_answers', {
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        entry_uuid: 'entry-1',
        input_ref: 'unique-input',
        parent_entry_uuid: '',
        owner_entry_uuid: '',
        answer: 'unique-answer',
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides
    });
}

export function seedSetting(db, overrides = {}) {
    return insertRow(db, 'settings', {
        field: 'setting-field',
        value: 'setting-value',
        ...overrides
    });
}

export function seedBookmark(db, overrides = {}) {
    return insertRow(db, 'bookmarks', {
        project_ref: PROJECT_REF,
        form_ref: FORM_REF,
        parent_entry_uuid: 'entry-1',
        title: 'Bookmark',
        bookmark: '{}',
        created_at: '2026-01-01T00:00:00.000Z',
        ...overrides
    });
}
