// noinspection DuplicatedCode
import { describe, it, expect, vi } from 'vitest';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { projectModel } from '@/models/project-model.js';

vi.mock('@/stores/root-store', () => ({
    useRootStore: () => ({ device: { identifier: 'test-device', platform: 'ios' }, isPWA: false })
}));
vi.mock('@/models/project-model.js', () => ({
    projectModel: { getInput: vi.fn(), getGroupInputRefs: vi.fn(), getProjectExtra: vi.fn(), getLastUpdated: () => '2026-01-01' }
}));
vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: { countBranchesForQuestion: vi.fn() }
}));

const mockMappings = [{
    is_default: true,
    forms: {
        'form_ref': {
            'q_text': { map_to: 'name_col' },
            'q_loc': { map_to: 'gps_col' },
            'group_1': { group: { 'q_sub': { map_to: 'sub_col' } } }
        }
    }
}];

describe('JSONTransformerService Headers', () => {

    it('should generate basic headers for a top-level form', () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        expect(result).toBe('ec5_uuid,created_at,title,name_col');
    });

    it('should insert parent_entry_uuid for child forms (formIndex > 0)', () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 1, false);
        const cols = result.split(',');

        expect(cols[1]).toBe('parent_entry_uuid');
        expect(cols.length).toBe(5);
    });

    it('should expand location into 6 specific headers', () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        expect(result).toContain('lat_gps_col,long_gps_col,acc_gps_col,UTM_Northing_gps_col,UTM_Easting_gps_col,UTM_Zone_gps_col');
    });

    it('should recursively flatten group headers', () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_1') return { type: 'group', ref: 'group_1' };
            if (ref === 'q_sub') return { type: 'text', ref: 'q_sub' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);
        const form = { details: { ref: 'form_ref' }, inputs: ['group_1'] };

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        expect(result).toBe('ec5_uuid,created_at,title,sub_col');
    });
});
