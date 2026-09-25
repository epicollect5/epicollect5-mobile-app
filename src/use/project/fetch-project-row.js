import { databaseSelectService } from '@/services/database/database-select-service';

export async function fetchProjectRow(projectRef) {
    const result = await databaseSelectService.selectProject(projectRef);
    if (!result || !result.rows || result.rows.length === 0) {
        const error = new Error('Project row missing');
        error.code = 'PROJECT_MISSING';
        throw error;
    }
    const row = result.rows.item(0);
    if (!row) {
        const error = new Error('Project row missing');
        error.code = 'PROJECT_MISSING';
        throw error;
    }
    return row;
}
