// noinspection DuplicatedCode

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { projectModel } from '@/models/project-model.js';
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
        'form_ref': {
            'q_text': { map_to: 'name_col' },
            'q_loc': { map_to: 'gps_col' },
            'group_1': { group: { 'q_sub': { map_to: 'sub_col' } } }
        }
    }
}];

const baseEntry = {
    entry_uuid: 'uuid-123',
    created_at: '2026-03-04T12:00:00.000Z',
    title: 'Test Entry'
};

describe('JSONTransformerService Row Content', () => {

    beforeEach(() => vi.clearAllMocks());

    it('should generate basic row data for top-level form', async () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };
        const answers = { 'q_text': { answer: 'Alice' } };

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row[0]).toBe('uuid-123'); // entry_uuid
        expect(row[1]).toBe('2026-03-04T12:00:00.000Z'); // created_at
        expect(row[3]).toBe('Test Entry'); // title
        expect(row[4]).toBe('Alice'); // answer
        expect(row[2]).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/); // exported_at format
    });

    it('should handle empty or null answers gracefully', async () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };
        const answers = { 'q_text': { answer: null } };

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row[4]).toBe('');
    });

    it('should fill 6 columns for location even if coordinates are missing', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: {} } };

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row.slice(4, 10)).toEqual(['', '', '', '', '', '']);
    });

    it('should correctly format UTM values for valid coordinates', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 } } };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(row[headers.indexOf('acc_gps_col')]).toBe('10');
        expect(row[headers.indexOf('UTM_Zone_gps_col')]).toBe('30U');
        expect(parseInt(row[headers.indexOf('UTM_Northing_gps_col')])).toBeGreaterThan(5700000);
        expect(parseInt(row[headers.indexOf('UTM_Northing_gps_col')])).toBeLessThan(5800000);
        expect(parseInt(row[headers.indexOf('UTM_Easting_gps_col')])).toBeGreaterThan(690000);
        expect(parseInt(row[headers.indexOf('UTM_Easting_gps_col')])).toBeLessThan(700000);
    });

    it('should flatten group data into the main row', async () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_1') return { type: 'group', ref: 'group_1' };
            if (ref === 'q_sub') return { type: 'text', ref: 'q_sub' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);
        const form = { details: { ref: 'form_ref' }, inputs: ['group_1'] };
        const answers = { 'q_sub': { answer: 'Nested Value' } };

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row[4]).toBe('Nested Value');
        expect(row.length).toBe(5);
    });
});

describe('JSONTransformerService Location Edge Cases', () => {

    beforeEach(() => vi.clearAllMocks());

    it('should handle Null Island (0,0) correctly', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: { latitude: 0, longitude: 0, accuracy: 5 } } };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(row[headers.indexOf('UTM_Northing_gps_col')]).toBe('0');
        expect(row[headers.indexOf('UTM_Easting_gps_col')]).toBe('166021');
        expect(headers.indexOf('UTM_Zone_gps_col')).not.toBe(-1);
    });

    it('should catch invalid coordinates and return empty strings', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: { latitude: 100, longitude: 20, accuracy: 10 } } };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(row[headers.indexOf('UTM_Northing_gps_col')]).toBe('');
        expect(row[headers.indexOf('UTM_Easting_gps_col')]).toBe('');
        expect(row[headers.indexOf('UTM_Zone_gps_col')]).toBe('');
    });
});

describe('JSONTransformerService Parity Tests', () => {

    beforeEach(() => vi.clearAllMocks());

    const parityMappings = [{
        is_default: true,
        forms: {
            'form_1': {
                'q_name': { map_to: 'user_name' },
                'q_loc': { map_to: 'gps' },
                'group_ref': { group: { 'q_age': { map_to: 'user_age' } } }
            }
        }
    }];

    it('should maintain perfect column parity between headers and rows', async () => {
        const inputDefinitions = {
            'q_name': { type: 'text', ref: 'q_name' },
            'q_loc': { type: 'location', ref: 'q_loc' },
            'group_ref': { type: 'group', ref: 'group_ref' },
            'q_age': { type: 'integer', ref: 'q_age' }
        };
        projectModel.getInput.mockImplementation((ref) => inputDefinitions[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_age']);

        const form = { details: { ref: 'form_1' }, inputs: ['q_name', 'q_loc', 'group_ref'] };
        const entry = { entry_uuid: 'uuid-123', created_at: '2026-03-04T12:00:00Z', title: 'Entry Title' };
        const answers = {
            'q_name': { answer: 'Alice' },
            'q_loc': { answer: { latitude: 51.5, longitude: -0.1, accuracy: 10 } },
            'q_age': { answer: 30 }
        };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, parityMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);
        const headerArray = Papa.parse(headerCSV).data[0];
        const rowArray = Papa.parse(rowCSV).data[0];

        expect(headerArray.length).toBe(rowArray.length);
        expect(headerArray.slice(0, 4)).toEqual(['ec5_uuid', 'created_at', 'exported_at', 'title']);

        const locIndex = headerArray.indexOf('lat_gps');
        expect(headerArray.slice(locIndex, locIndex + 6)).toEqual([
            'lat_gps', 'long_gps', 'acc_gps', 'UTM_Northing_gps', 'UTM_Easting_gps', 'UTM_Zone_gps'
        ]);

        expect(headerArray).toContain('user_age');
        expect(rowArray[headerArray.indexOf('user_age')]).toBe('30');
    });
});

describe('JSONTransformerService Multi-Branch Logic', () => {

    beforeEach(() => vi.clearAllMocks());

    it('should correctly separate data for different branch types', async () => {
        const mockInputs = {
            'photo_caption': { type: 'text', ref: 'photo_caption' },
            'member_name': { type: 'text', ref: 'member_name' }
        };
        projectModel.getInput.mockImplementation((ref) => mockInputs[ref]);
        projectModel.getProjectExtra.mockReturnValue({
            forms: {
                'f_1': {
                    branch: {
                        'branch_photos': ['photo_caption'],
                        'branch_members': ['member_name']
                    }
                }
            }
        });

        const parentUuid = 'parent-100';
        const rowPhoto = await JSONTransformerService.getBranchCSVRow(
            { owner_entry_uuid: parentUuid, entry_uuid: 'photo-1', created_at: '2026-03-05', title: 'Photo 1' },
            { branchRef: 'branch_photos', formRef: 'f_1' },
            { 'photo_caption': { answer: 'Sunset' } }
        );
        const rowMember = await JSONTransformerService.getBranchCSVRow(
            { owner_entry_uuid: parentUuid, entry_uuid: 'member-1', created_at: '2026-03-05', title: 'Member 1' },
            { branchRef: 'branch_members', formRef: 'f_1' },
            { 'member_name': { answer: 'Bob' } }
        );

        const parsedPhoto = Papa.parse(rowPhoto).data[0];
        const parsedMember = Papa.parse(rowMember).data[0];

        expect(parsedPhoto[0]).toBe(parentUuid);
        expect(parsedMember[0]).toBe(parentUuid);
        expect(parsedPhoto).toContain('Sunset');
        expect(parsedMember).toContain('Bob');
        expect(parsedPhoto).not.toContain('Bob');
    });

    it('should generate correct headers for a branch', () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { 'f_1': { branch: { 'branch_photos': ['photo_caption'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'photo_caption') return { type: 'text', ref: 'photo_caption' };
        });

        const mockMappings = [{
            is_default: true,
            forms: { 'f_1': { 'branch_photos': { branch: { 'photo_caption': { map_to: 'Caption' } } } } }
        }];

        const result = JSONTransformerService.getBranchCSVHeaders({ branchRef: 'branch_photos', formRef: 'f_1' }, mockMappings);
        const headers = Papa.parse(result).data[0];

        expect(headers).toEqual(['ec5_branch_owner_uuid', 'ec5_branch_uuid', 'created_at', 'exported_at', 'title', 'Caption']);
    });

    it('should maintain parity between branch headers and rows', async () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { 'f_1': { branch: { 'branch_photos': ['photo_caption'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'photo_caption') return { type: 'text', ref: 'photo_caption' };
        });

        const mockMappings = [{
            is_default: true,
            forms: { 'f_1': { 'branch_photos': { branch: { 'photo_caption': { map_to: 'Caption' } } } } }
        }];
        const branch = { branchRef: 'branch_photos', formRef: 'f_1' };
        const entry = { owner_entry_uuid: 'owner-123', entry_uuid: 'branch-entry-1', created_at: '2026-03-05', title: 'My Photo' };

        const headerCSV = JSONTransformerService.getBranchCSVHeaders(branch, mockMappings);
        const rowCSV = await JSONTransformerService.getBranchCSVRow(entry, branch, { 'photo_caption': { answer: 'A nice view' } });
        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        expect(headers.length).toBe(row.length);
        expect(headers[0]).toBe('ec5_branch_owner_uuid');
        expect(row[0]).toBe('owner-123');
        expect(headers[5]).toBe('Caption');
        expect(row[5]).toBe('A nice view');
    });
});
