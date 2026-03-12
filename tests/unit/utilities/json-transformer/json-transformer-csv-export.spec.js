// noinspection DuplicatedCode
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';
import Papa from 'papaparse';

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
        'form_1': {
            'q_text': { map_to: 'name' },
            'q_loc': { map_to: 'place' },
            'q_group': { group: { 'q_sub': { map_to: 'nested' } } },
            'q_branch': { map_to: 'branch_count' }
        }
    }
}];

describe('JSONTransformerService CSV Export', () => {

    beforeEach(() => vi.clearAllMocks());

    it('should correctly format a row with all major types', async () => {
        const mockInputs = {
            'q_text': { type: 'text', ref: 'q_text' },
            'q_loc': { type: 'location', ref: 'q_loc' },
            'q_branch': { type: 'branch', ref: 'q_branch' }
        };
        projectModel.getInput.mockImplementation((ref) => mockInputs[ref]);
        databaseSelectService.countBranchesForQuestion.mockResolvedValue({
            rows: { item: () => ({ total: 5 }) }
        });

        const entry = { entry_uuid: '123', created_at: '2026-03-04', title: 'Test' };
        const form = { details: { ref: 'form_1' }, inputs: ['q_text', 'q_loc', 'q_branch'] };
        const answers = {
            'q_text': { answer: 'John' },
            'q_loc': { answer: { latitude: 10, longitude: 20, accuracy: 5 } }
        };

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);
        const parts = result.split(',');
        expect(parts[4]).toBe('John');
        expect(parts[5]).toBe('10');
        expect(parts[11]).toBe('5');
    });

    it('should flatten groups and skip readme', async () => {
        const mockInputs = {
            'q_readme': { type: 'readme', ref: 'q_readme' },
            'q_group': { type: 'group', ref: 'q_group' },
            'q_sub': { type: 'text', ref: 'q_sub' }
        };
        projectModel.getInput.mockImplementation((ref) => mockInputs[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);

        const entry = { entry_uuid: '123', created_at: '2026-03-04', exported_at: '2026-03-05', title: 'Test' };
        const form = { details: { ref: 'form_1' }, inputs: ['q_readme', 'q_group'] };
        const answers = { 'q_sub': { answer: 'inside group' } };

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);
        const parts = result.split(',');
        expect(parts.length).toBe(5);
        expect(parts[4]).toBe('inside group');
    });

    it('should handle empty location coordinates', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

        const entry = { entry_uuid: '123', created_at: '2026-03-04', title: 'Test' };
        const form = { details: { ref: 'form_1' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: null } };

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);
        const parts = result.split(',');
        expect(parts.slice(4, 10)).toEqual(['', '', '', '', '', '']);
    });

    it('should correctly handle child form metadata columns', async () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_name' });

        const form = { details: { ref: 'form_1' }, inputs: ['q_name'] };
        const entry = { entry_uuid: 'child-1', parent_entry_uuid: 'parent-123', created_at: '2026-03-04', title: 'Child Entry' };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 1, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, {}, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(headers[1]).toBe('parent_entry_uuid');
        expect(row[1]).toBe('parent-123');
        expect(headers.length).toBe(row.length);
    });

    it('should correctly handle a group at the top level of a child form', async () => {
        const inputDefinitions = {
            'q_name': { type: 'text', ref: 'q_name' },
            'group_1': { type: 'group', ref: 'group_1' },
            'q_in_group': { type: 'text', ref: 'q_in_group' }
        };
        projectModel.getInput.mockImplementation((ref) => inputDefinitions[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_in_group']);

        const childMappings = [{
            is_default: true,
            forms: {
                'child_form_ref': {
                    'q_name': { map_to: 'child_name' },
                    'group_1': { group: { 'q_in_group': { map_to: 'inner_val' } } }
                }
            }
        }];

        const form = { details: { ref: 'child_form_ref' }, inputs: ['q_name', 'group_1'] };
        const entry = { entry_uuid: 'c-1', parent_entry_uuid: 'p-1', created_at: '2026-03-04',  exported_at: '2026-03-04', title: 'Child Entry' };
        const answers = { 'q_name': { answer: 'Alice' }, 'q_in_group': { answer: 'Inside Group' } };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, childMappings, false, 1, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(headers).toContain('parent_entry_uuid');
        expect(headers).toContain('inner_val');
        expect(headers.length).toBe(7);
        expect(row[1]).toBe('p-1');
        expect(row[6]).toBe('Inside Group');
        expect(row.length).toBe(headers.length);
    });
});
