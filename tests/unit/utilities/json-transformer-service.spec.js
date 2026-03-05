import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';
import Papa from 'papaparse';

// Mock the dependencies
vi.mock('@/stores/root-store', () => ({
    useRootStore: () => ({
        device: { identifier: 'test-device', platform: 'ios' },
        isPWA: false
    })
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getInput: vi.fn(),
        getGroupInputRefs: vi.fn(),
        getLastUpdated: () => '2026-01-01'
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        countBranchesForQuestion: vi.fn()
    }
}));

describe('JSONTransformerService CSV Export', () => {

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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should correctly format a row with all major types', async () => {
        // 1. Setup Mock Inputs
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
        const form = {
            details: { ref: 'form_1' },
            inputs: ['q_text', 'q_loc', 'q_branch']
        };
        const answers = {
            'q_text': { answer: 'John' },
            'q_loc': { answer: { latitude: 10, longitude: 20, accuracy: 5 } }
        };

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);

        // Expected structure: uuid, created, title, text_val, lat, long, acc, N, E, Zone, branch_count
        const parts = result.split(',');
        expect(parts[3]).toBe('John'); // Text
        expect(parts[4]).toBe('10');   // Lat
        expect(parts[10]).toBe('5');   // Branch count
    });

    it('should flatten groups and skip readme', async () => {
        const mockInputs = {
            'q_readme': { type: 'readme', ref: 'q_readme' },
            'q_group': { type: 'group', ref: 'q_group' },
            'q_sub': { type: 'text', ref: 'q_sub' }
        };

        projectModel.getInput.mockImplementation((ref) => mockInputs[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);

        const entry = { entry_uuid: '123', created_at: '2026-03-04', title: 'Test' };
        const form = { details: { ref: 'form_1' }, inputs: ['q_readme', 'q_group'] };
        const answers = { 'q_sub': { answer: 'inside group' } };

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);

        // README should be skipped, group should be flattened
        // Result should be: uuid, created, title, inside group
        const parts = result.split(',');
        expect(parts.length).toBe(4);
        expect(parts[3]).toBe('inside group');
    });

    it('should handle empty location coordinates', async () => {
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

        const entry = { entry_uuid: '123', created_at: '2026-03-04', title: 'Test' };
        const form = { details: { ref: 'form_1' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: null } }; // Missing location

        const result = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);
        const parts = result.split(',');

        // Should have 6 empty columns for location
        const locationBlock = parts.slice(3, 9);
        expect(locationBlock).toEqual(['', '', '', '', '', '']);
    });

    it('should correctly handle child form metadata columns', async () => {
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_name' });

        const form = { details: { ref: 'form_1' }, inputs: ['q_name'] };
        const entry = {
            entry_uuid: 'child-1',
            parent_entry_uuid: 'parent-123', // This is the value we expect in the row
            created_at: '2026-03-04',
            title: 'Child Entry'
        };

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 1, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, {}, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        // Check Header Name
        expect(headers[1]).toBe('parent_entry_uuid');

        // Check Row Value (The ID of the parent)
        expect(row[1]).toBe('parent-123');

        // Ensure column alignment (Crucial for CSV validity)
        expect(headers.length).toBe(row.length);
    });

    it('should correctly handle a group at the top level of a child form', async () => {
        // 1. Mock the Input Definitions
        const inputDefinitions = {
            'q_name': { type: 'text', ref: 'q_name' },
            'group_1': { type: 'group', ref: 'group_1' },
            'q_in_group': { type: 'text', ref: 'q_in_group' }
        };

        projectModel.getInput.mockImplementation((ref) => inputDefinitions[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_in_group']);

        // 2. Setup the Mappings (Group is at the same level as other questions)
        const childMappings = [{
            is_default: true,
            forms: {
                'child_form_ref': {
                    'q_name': { map_to: 'child_name' },
                    'group_1': {
                        group: { 'q_in_group': { map_to: 'inner_val' } }
                    }
                }
            }
        }];

        // 3. Setup the Form (Child form, index 1)
        const form = {
            details: { ref: 'child_form_ref' },
            inputs: ['q_name', 'group_1']
        };

        const entry = {
            entry_uuid: 'c-1',
            parent_entry_uuid: 'p-1',
            created_at: '2026-03-04',
            title: 'Child Entry'
        };

        const answers = {
            'q_name': { answer: 'Alice' },
            'q_in_group': { answer: 'Inside Group' }
        };

        // EXECUTE (formIndex = 1 for child)
        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, childMappings, false, 1, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        // ASSERTIONS
        // Headers: [ec5_uuid, parent_entry_uuid, created_at, title, child_name, inner_val]
        expect(headers).toContain('parent_entry_uuid');
        expect(headers).toContain('inner_val');
        expect(headers.length).toBe(6);

        // Row: Value parity
        expect(row[1]).toBe('p-1'); // parent_entry_uuid value
        expect(row[5]).toBe('Inside Group'); // group answer value
        expect(row.length).toBe(headers.length);
    });

});

describe('JSONTransformerService Headers', () => {
    const mockMappings = [{
        is_default: true,
        forms: {
            'form_ref': {
                'q_text': { map_to: 'name_col' },
                'q_loc': { map_to: 'gps_col' },
                'group_1': {
                    group: { 'q_sub': { map_to: 'sub_col' } }
                }
            }
        }
    }];

    it('should generate basic headers for a top-level form', () => {
        const form = {
            details: { ref: 'form_ref' },
            inputs: ['q_text']
        };
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        // Result is a Papa-unparsed string
        expect(result).toBe('ec5_uuid,created_at,title,name_col');
    });

    it('should insert parent_entry_uuid for child forms (formIndex > 0)', () => {
        const form = {
            details: { ref: 'form_ref' },
            inputs: ['q_text']
        };
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });

        // formIndex = 1 indicates it's a child form
        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 1, false);

        const cols = result.split(',');
        expect(cols[1]).toBe('parent_entry_uuid');
        expect(cols.length).toBe(5); // uuid, parent_uuid, created, title, name
    });

    it('should expand location into 6 specific headers', () => {
        const form = {
            details: { ref: 'form_ref' },
            inputs: ['q_loc']
        };
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        expect(result).toContain('lat_gps_col,long_gps_col,acc_gps_col,UTM_Northing_gps_col,UTM_Easting_gps_col,UTM_Zone_gps_col');
    });

    it('should recursively flatten group headers', () => {
        const form = {
            details: { ref: 'form_ref' },
            inputs: ['group_1']
        };

        // Mock the group question itself
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_1') return { type: 'group', ref: 'group_1' };
            if (ref === 'q_sub') return { type: 'text', ref: 'q_sub' };
        });

        // Mock the group child lookup
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);

        const result = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);

        // The group container itself doesn't get a column, only the children
        expect(result).toBe('ec5_uuid,created_at,title,sub_col');
    });
});

describe('JSONTransformerService Row Content', () => {
    const mockMappings = [{
        is_default: true,
        forms: {
            'form_ref': {
                'q_text': { map_to: 'name_col' },
                'q_loc': { map_to: 'gps_col' },
                'group_1': {
                    group: { 'q_sub': { map_to: 'sub_col' } }
                }
            }
        }
    }];

    const baseEntry = {
        entry_uuid: 'uuid-123',
        created_at: '2026-03-04T12:00:00Z',
        title: 'Test Entry'
    };

    it('should generate basic row data for top-level form', async () => {
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };
        const answers = { 'q_text': { answer: 'Alice' } };
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        // Format: [uuid, created, title, answer]
        expect(row).toEqual(['uuid-123', '2026-03-04T12:00:00Z', 'Test Entry', 'Alice']);
    });

    it('should handle empty or null answers gracefully', async () => {
        const form = { details: { ref: 'form_ref' }, inputs: ['q_text'] };
        const answers = { 'q_text': { answer: null } }; // Null answer
        projectModel.getInput.mockReturnValue({ type: 'text', ref: 'q_text' });

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row[3]).toBe(''); // Should result in empty string, not "null"
    });

    it('should fill 6 columns for location even if coordinates are missing', async () => {
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: {} } }; // Empty object/no GPS fix
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        // Ensure we have exactly 6 empty slots for the GPS block
        const gpsBlock = row.slice(3, 9);
        expect(gpsBlock).toEqual(['', '', '', '', '', '']);
    });

    it('should correctly format UTM values for valid coordinates', async () => {
        const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
        const answers = { 'q_loc': { answer: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 } } };
        projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);

        const headers = Papa.parse(headerCSV).data[0];
        const row = Papa.parse(rowCSV).data[0];

        const accIndex = headers.indexOf('acc_gps_col');
        const northIndex = headers.indexOf('UTM_Northing_gps_col');
        const eastIndex = headers.indexOf('UTM_Easting_gps_col');
        const zoneIndex = headers.indexOf('UTM_Zone_gps_col');

        // 1. Accuracy is simple data, test exactly
        expect(row[accIndex]).toBe('10');

        // 2. Zone is a string, test exactly
        expect(row[zoneIndex]).toBe('30U');

        // 3. For Northing/Easting, test that they are valid numbers in the right ballpark
        // This proves the conversion happened without being brittle to rounding
        const northing = parseInt(row[northIndex]);
        const easting = parseInt(row[eastIndex]);

        expect(northing).toBeGreaterThan(5700000);
        expect(northing).toBeLessThan(5800000);
        expect(easting).toBeGreaterThan(690000);
        expect(easting).toBeLessThan(700000);
    });

    describe('JSONTransformerService Location Edge Cases', () => {

        it('should handle Null Island (0,0) correctly', async () => {
            const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };
            const answers = { 'q_loc': { answer: { latitude: 0, longitude: 0, accuracy: 5 } } };
            projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });

            const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
            const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);

            const headers = Papa.parse(headerCSV).data[0];
            const row = Papa.parse(rowCSV).data[0];

            // Use dynamic indexing to prevent off-by-one errors
            const northIdx = headers.indexOf('UTM_Northing_gps_col');
            const eastIdx = headers.indexOf('UTM_Easting_gps_col');

            expect(row[northIdx]).toBe('0');        // Northing is 0
            expect(row[eastIdx]).toBe('166021');   // Easting is 166021
            expect(headers.indexOf('UTM_Zone_gps_col')).not.toBe(-1);
        });

        it('should catch invalid coordinates and return empty strings', async () => {
            const answers = { 'q_loc': { answer: { latitude: 100, longitude: 20, accuracy: 10 } } };
            projectModel.getInput.mockReturnValue({ type: 'location', ref: 'q_loc' });
            const form = { details: { ref: 'form_ref' }, inputs: ['q_loc'] };

            const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
            const rowCSV = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);

            const headers = Papa.parse(headerCSV).data[0];
            const row = Papa.parse(rowCSV).data[0];

            const nIdx = headers.indexOf('UTM_Northing_gps_col');
            const eIdx = headers.indexOf('UTM_Easting_gps_col');
            const zIdx = headers.indexOf('UTM_Zone_gps_col');

            // These should now be empty strings because of the catch block fallback
            expect(row[nIdx]).toBe('');
            expect(row[eIdx]).toBe('');
            expect(row[zIdx]).toBe('');
        });
    });

    it('should flatten group data into the main row', async () => {
        const form = { details: { ref: 'form_ref' }, inputs: ['group_1'] };
        const answers = { 'q_sub': { answer: 'Nested Value' } };

        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_1') return { type: 'group', ref: 'group_1' };
            if (ref === 'q_sub') return { type: 'text', ref: 'q_sub' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_sub']);

        const result = await JSONTransformerService.getFormCSVRow(baseEntry, form, answers, false);
        const row = Papa.parse(result).data[0];

        expect(row[3]).toBe('Nested Value');
        expect(row.length).toBe(4);
    });
});

describe('JSONTransformerService Parity Tests', () => {

    // Define a consistent mapping for the test
    const mockMappings = [{
        is_default: true,
        forms: {
            'form_1': {
                'q_name': { map_to: 'user_name' },
                'q_loc': { map_to: 'gps' },
                'group_ref': {
                    group: { 'q_age': { map_to: 'user_age' } }
                }
            }
        }
    }];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should maintain perfect column parity between headers and rows', async () => {
        // 1. Setup Mock Project Structure
        const inputDefinitions = {
            'q_name': { type: 'text', ref: 'q_name' },
            'q_loc': { type: 'location', ref: 'q_loc' },
            'group_ref': { type: 'group', ref: 'group_ref' },
            'q_age': { type: 'integer', ref: 'q_age' }
        };

        projectModel.getInput.mockImplementation((ref) => inputDefinitions[ref]);
        projectModel.getGroupInputRefs.mockReturnValue(['q_age']);

        const form = {
            details: { ref: 'form_1' },
            inputs: ['q_name', 'q_loc', 'group_ref']
        };

        const entry = {
            entry_uuid: 'uuid-123',
            created_at: '2026-03-04T12:00:00Z',
            title: 'Entry Title'
        };

        const answers = {
            'q_name': { answer: 'Alice' },
            'q_loc': { answer: { latitude: 51.5, longitude: -0.1, accuracy: 10 } },
            'q_age': { answer: 30 }
        };

        // 2. Execute Header and Row generation
        const headerCSV = JSONTransformerService.getFormCSVHeaders(form, mockMappings, false, 0, false);
        const rowCSV = await JSONTransformerService.getFormCSVRow(entry, form, answers, false);

        // 3. Parse back to check counts
        const headerArray = Papa.parse(headerCSV).data[0];
        const rowArray = Papa.parse(rowCSV).data[0];

        // ASSERTIONS
        expect(headerArray.length).toBe(rowArray.length);

        // Check Metadata
        expect(headerArray.slice(0, 3)).toEqual(['ec5_uuid', 'created_at', 'title']);

        // Check Location Expansion (6 columns)
        const locIndex = headerArray.indexOf('lat_gps');
        expect(headerArray.slice(locIndex, locIndex + 6)).toEqual([
            'lat_gps', 'long_gps', 'acc_gps', 'UTM_Northing_gps', 'UTM_Easting_gps', 'UTM_Zone_gps'
        ]);

        // Check Group Flattening
        expect(headerArray).toContain('user_age');
        expect(rowArray[headerArray.indexOf('user_age')]).toBe('30');
    });
});


