// noinspection DuplicatedCode

import {describe, it, expect, vi, beforeEach} from 'vitest';
import {JSONTransformerService} from '@/services/utilities/json-transformer-service';
import {projectModel} from '@/models/project-model.js';
import {utilsService} from '@/services/utilities/utils-service';
import Papa from 'papaparse';
import {PARAMETERS} from '@/config';

vi.mock('@/stores/root-store', () => ({
    useRootStore: () => ({device: {identifier: 'test-device', platform: 'ios'}, isPWA: false})
}));
vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getInput: vi.fn(),
        getGroupInputRefs: vi.fn(),
        getProjectExtra: vi.fn(),
        getLastUpdated: () => '2026-01-01'
    }
}));
vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {countBranchesForQuestion: vi.fn()}
}));
vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        getUserFormattedDate: vi.fn(),
        getUserFormattedTime: vi.fn()
    }
}));

const BASE_ENTRY = {
    entry_uuid: 'uuid-1',
    created_at: '2026-03-05T10:30:59.000Z',
    exported_at: '2026-03-06T12:23:46.000Z',
    title: 'Test'
};

// ─────────────────────────────────────────────────────────────────────────────
// Answer Type Coverage
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Answer Types', () => {

    beforeEach(() => vi.clearAllMocks());

    const form = {details: {ref: 'form_ref'}, inputs: ['q_1']};

    describe('radio / dropdown', () => {

        const possibleAnswers = [
            {answer_ref: 'ref_a', answer: 'Option A'},
            {answer_ref: 'ref_b', answer: 'Option B'}
        ];

        it('should resolve answer_ref to its label for radio', async () => {
            projectModel.getInput.mockReturnValue({type: 'radio', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 'ref_a'}}, false)
            ).data[0];
            expect(row[4]).toBe('Option A');
        });

        it('should resolve answer_ref to its label for dropdown', async () => {
            projectModel.getInput.mockReturnValue({type: 'dropdown', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 'ref_b'}}, false)
            ).data[0];
            expect(row[4]).toBe('Option B');
        });

        it('should return empty string when answer_ref does not match any possible answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'radio', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 'ref_unknown'}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should return empty string when answer is empty string', async () => {
            projectModel.getInput.mockReturnValue({type: 'radio', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ''}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });
    });

    describe('checkbox / searchmultiple / search_single', () => {

        const possibleAnswers = [
            {answer_ref: 'ref_x', answer: 'X'},
            {answer_ref: 'ref_y', answer: 'Y'},
            {answer_ref: 'ref_z', answer: 'Z'}
        ];

        it('should join multiple selected checkbox labels with ", "', async () => {
            projectModel.getInput.mockReturnValue({type: 'checkbox', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ['ref_x', 'ref_z']}}, false)
            ).data[0];
            expect(row[4]).toBe('X, Z');
        });

        it('should return a single label without trailing comma for one selection', async () => {
            projectModel.getInput.mockReturnValue({type: 'checkbox', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ['ref_y']}}, false)
            ).data[0];
            expect(row[4]).toBe('Y');
        });

        it('should return empty string for an empty checkbox array', async () => {
            projectModel.getInput.mockReturnValue({type: 'checkbox', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: []}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should silently skip unrecognised refs in a checkbox answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'checkbox', ref: 'q_1', possible_answers: possibleAnswers});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ['ref_x', 'ref_unknown']}}, false)
            ).data[0];
            // ref_unknown has no label so it is filtered out
            expect(row[4]).toBe('X');
        });

        it('should handle searchmultiple the same as checkbox', async () => {
            projectModel.getInput.mockReturnValue({
                type: PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE,
                ref: 'q_1',
                possible_answers: possibleAnswers
            });
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ['ref_x', 'ref_y']}}, false)
            ).data[0];
            expect(row[4]).toBe('X, Y');
        });

        it('should handle search_single the same as checkbox', async () => {
            projectModel.getInput.mockReturnValue({
                type: PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE,
                ref: 'q_1',
                possible_answers: possibleAnswers
            });
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ['ref_z']}}, false)
            ).data[0];
            expect(row[4]).toBe('Z');
        });
    });

    describe('date / time', () => {

        it('should call getUserFormattedDate and use its return value', async () => {
            utilsService.getUserFormattedDate.mockReturnValue('05/03/2026');
            projectModel.getInput.mockReturnValue({type: 'date', ref: 'q_1', datetime_format: 'DD/MM/YYYY'});

            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: '2026-03-05'}}, false)
            ).data[0];

            expect(utilsService.getUserFormattedDate).toHaveBeenCalledWith('2026-03-05', 'DD/MM/YYYY');
            expect(row[4]).toBe('05/03/2026');
        });

        it('should return empty string for date when answer is empty', async () => {
            projectModel.getInput.mockReturnValue({type: 'date', ref: 'q_1', datetime_format: 'DD/MM/YYYY'});

            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ''}}, false)
            ).data[0];

            expect(utilsService.getUserFormattedDate).not.toHaveBeenCalled();
            expect(row[4]).toBe('');
        });

        it('should call getUserFormattedTime and use its return value', async () => {
            utilsService.getUserFormattedTime.mockReturnValue('14:30');
            projectModel.getInput.mockReturnValue({type: 'time', ref: 'q_1', datetime_format: 'HH:mm'});

            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: '14:30:00'}}, false)
            ).data[0];

            expect(utilsService.getUserFormattedTime).toHaveBeenCalledWith('14:30:00', 'HH:mm');
            expect(row[4]).toBe('14:30');
        });

        it('should return empty string for time when answer is empty', async () => {
            projectModel.getInput.mockReturnValue({type: 'time', ref: 'q_1', datetime_format: 'HH:mm'});

            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ''}}, false)
            ).data[0];

            expect(utilsService.getUserFormattedTime).not.toHaveBeenCalled();
            expect(row[4]).toBe('');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Falsy-but-valid Answer Values
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Falsy-but-valid Answer Values', () => {

    beforeEach(() => vi.clearAllMocks());

    const form = {details: {ref: 'form_ref'}, inputs: ['q_1']};

    it('should preserve 0 as "0", not empty string', async () => {
        projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
        const row = Papa.parse(
            await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 0}}, false)
        ).data[0];
        expect(row[4]).toBe('0');
    });

    it('should preserve false as "false", not empty string', async () => {
        projectModel.getInput.mockReturnValue({type: 'text', ref: 'q_1'});
        const row = Papa.parse(
            await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: false}}, false)
        ).data[0];
        expect(row[4]).toBe('false');
    });

    it('should treat null answer as empty string', async () => {
        projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
        const row = Papa.parse(
            await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: null}}, false)
        ).data[0];
        expect(row[4]).toBe('');
    });

    it('should treat missing answer key as empty string', async () => {
        projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
        const row = Papa.parse(
            await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {}, false)
        ).data[0];
        expect(row[4]).toBe('');
    });

    it('location northing of 0 should be "0", not empty string', async () => {
        projectModel.getInput.mockReturnValue({type: 'location', ref: 'q_1'});
        const row = Papa.parse(
            await JSONTransformerService.getFormCSVRow(
                BASE_ENTRY,
                form,
                {'q_1': {answer: {latitude: 0, longitude: 0, accuracy: 0}}},
                false
            )
        ).data[0];
        // Northing for (0,0) should be '0', not ''
        expect(row[7]).toBe('0');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// utmConverter — direct unit tests
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — utmConverter', () => {

    it('should return correct easting, northing and zone for London', () => {
        const result = JSONTransformerService.utmConverter(51.5074, -0.1278);
        expect(result.zone).toBe('30U');
        expect(result.northing).toBeGreaterThan(5700000);
        expect(result.northing).toBeLessThan(5800000);
        expect(result.easting).toBeGreaterThan(690000);
        expect(result.easting).toBeLessThan(700000);
    });

    it('should floor easting and northing to integers', () => {
        const result = JSONTransformerService.utmConverter(51.5074, -0.1278);
        expect(result.easting).toBe(Math.floor(result.easting));
        expect(result.northing).toBe(Math.floor(result.northing));
    });

    it('should handle Null Island (0, 0)', () => {
        const result = JSONTransformerService.utmConverter(0, 0);
        expect(result.northing).toBe(0);
        expect(result.easting).toBe(166021);
    });

    it('should return empty strings for out-of-range latitude (> 84)', () => {
        const result = JSONTransformerService.utmConverter(100, 20);
        expect(result.northing).toBe('');
        expect(result.easting).toBe('');
        expect(result.zone).toBe('');
    });

    it('should return empty strings for non-numeric input', () => {
        const result = JSONTransformerService.utmConverter('not-a-number', 'also-bad');
        expect(result.northing).toBe('');
        expect(result.easting).toBe('');
        expect(result.zone).toBe('');
    });

    it('should accept numeric strings and parse them correctly', () => {
        const fromNumbers = JSONTransformerService.utmConverter(51.5074, -0.1278);
        const fromStrings = JSONTransformerService.utmConverter('51.5074', '-0.1278');
        expect(fromStrings.zone).toBe(fromNumbers.zone);
        expect(fromStrings.northing).toBe(fromNumbers.northing);
        expect(fromStrings.easting).toBe(fromNumbers.easting);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integer and Decimal answer types
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Integer and Decimal Answer Types', () => {

    beforeEach(() => vi.clearAllMocks());

    const form = {details: {ref: 'form_ref'}, inputs: ['q_1']};

    describe('integer', () => {

        it('should return "0" for answer 0, not empty string', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 0}}, false)
            ).data[0];
            expect(row[4]).toBe('0');
        });

        it('should return "42" for a valid integer answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 42}}, false)
            ).data[0];
            expect(row[4]).toBe('42');
        });

        it('should return "42" for a string integer answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: '42'}}, false)
            ).data[0];
            expect(row[4]).toBe('42');
        });

        it('should return "" for empty string answer, not "NaN"', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ''}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should return "" for null answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: null}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should return "" for undefined answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'integer', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: undefined}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });
    });

    describe('decimal', () => {

        it('should return "0" for answer 0, not empty string', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 0}}, false)
            ).data[0];
            expect(row[4]).toBe('0');
        });

        it('should return "3.14" for a valid decimal answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: 3.14}}, false)
            ).data[0];
            expect(row[4]).toBe('3.14');
        });

        it('should strip trailing zeros from string decimal, matching server floatval behaviour', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: '9.6300'}}, false)
            ).data[0];
            expect(row[4]).toBe('9.63');
        });

        it('should return "" for empty string answer, not "NaN"', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: ''}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should return "" for null answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: null}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });

        it('should return "" for undefined answer', async () => {
            projectModel.getInput.mockReturnValue({type: 'decimal', ref: 'q_1'});
            const row = Papa.parse(
                await JSONTransformerService.getFormCSVRow(BASE_ENTRY, form, {'q_1': {answer: undefined}}, false)
            ).data[0];
            expect(row[4]).toBe('');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBranchCSVHeaders — splice correctness
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — getBranchCSVHeaders splice correctness', () => {

    const mappings = [{
        is_default: true,
        forms: {
            'f_1': {
                'branch_ref': {
                    branch: {
                        'q_text': {map_to: 'MyText'},
                        'q_num': {map_to: 'MyNum'}
                    }
                }
            }
        }
    }];

    beforeEach(() => {
        vi.clearAllMocks();

        projectModel.getProjectExtra.mockReturnValue({
            forms: {'f_1': {branch: {'branch_ref': ['q_text', 'q_num']}}}
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_text') return {type: 'text', ref: 'q_text'};
            if (ref === 'q_num') return {type: 'integer', ref: 'q_num'};
        });
    });

    it('should replace ec5_uuid with ec5_branch_owner_uuid and ec5_branch_uuid', () => {
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({branchRef: 'branch_ref', formRef: 'f_1'}, mappings)
        ).data[0];

        expect(headers[0]).toBe('ec5_branch_owner_uuid');
        expect(headers[1]).toBe('ec5_branch_uuid');
        expect(headers).not.toContain('ec5_uuid');
    });

    it('should keep created_at at index 2 and title at index 3 after splice', () => {
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({branchRef: 'branch_ref', formRef: 'f_1'}, mappings)
        ).data[0];

        expect(headers[2]).toBe('created_at');
        expect(headers[3]).toBe('exported_at');
        expect(headers[4]).toBe('title');
    });

    it('should have the correct total column count after splice', () => {
        // 2 metadata (owner_uuid, branch_uuid) + created_at + exported_at + title + 2 questions = 7
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({branchRef: 'branch_ref', formRef: 'f_1'}, mappings)
        ).data[0];

        expect(headers.length).toBe(7);
    });

    it('branch headers and row should remain in sync after splice', async () => {
        const branch = {branchRef: 'branch_ref', formRef: 'f_1'};
        const entry = {owner_entry_uuid: 'own-1', entry_uuid: 'br-1', created_at: '2026-03-05', title: 'T'};
        const answers = {'q_text': {answer: 'hello'}, 'q_num': {answer: 42}};

        const headers = Papa.parse(JSONTransformerService.getBranchCSVHeaders(branch, mappings)).data[0];
        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, answers)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[headers.indexOf('ec5_branch_owner_uuid')]).toBe('own-1');
        expect(row[headers.indexOf('MyText')]).toBe('hello');
        expect(row[headers.indexOf('MyNum')]).toBe('42');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// flattenJsonEntry
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — flattenJsonEntry', () => {

    const baseJsonEntry = {
        id: 'entry-uuid-1',
        type: 'entry',
        projectRef: 'proj-1',
        attributes: {form: {ref: 'form-ref-1'}},
        relationships: {
            parent: {data: {parent_form_ref: 'parent-form-ref', parent_entry_uuid: 'parent-uuid-1'}},
            branch: {}
        },
        entry: {
            entry_uuid: 'entry-uuid-1',
            created_at: '2026-03-05T10:00:00Z',
            title: 'My Entry',
            answers: {'q_1': {answer: 'test'}}
        }
    };

    it('should correctly map all top-level fields', () => {
        const result = JSONTransformerService.flattenJsonEntry(baseJsonEntry, true, false);

        expect(result.entryUuid).toBe('entry-uuid-1');
        expect(result.formRef).toBe('form-ref-1');
        expect(result.projectRef).toBe('proj-1');
        expect(result.title).toBe('My Entry');
        expect(result.createdAt).toBe('2026-03-05T10:00:00Z');
        expect(result.synced).toBe(1);
        expect(result.synced_error).toBe('');
    });

    it('should correctly set canEdit and isRemote flags', () => {
        const editable = JSONTransformerService.flattenJsonEntry(baseJsonEntry, true, false);
        const readOnly = JSONTransformerService.flattenJsonEntry(baseJsonEntry, false, true);

        expect(editable.canEdit).toBe(true);
        expect(editable.isRemote).toBe(false);
        expect(readOnly.canEdit).toBe(false);
        expect(readOnly.isRemote).toBe(true);
    });

    it('should extract parent relationship fields', () => {
        const result = JSONTransformerService.flattenJsonEntry(baseJsonEntry, true, false);

        expect(result.parentEntryUuid).toBe('parent-uuid-1');
        expect(result.parentFormRef).toBe('parent-form-ref');
    });

    it('should default parentEntryUuid and parentFormRef to empty string when no parent', () => {
        const noParent = {
            ...baseJsonEntry,
            relationships: {parent: {}, branch: {}}
        };
        const result = JSONTransformerService.flattenJsonEntry(noParent, true, false);

        expect(result.parentEntryUuid).toBe('');
        expect(result.parentFormRef).toBe('');
    });

    it('should preserve answers as-is', () => {
        const result = JSONTransformerService.flattenJsonEntry(baseJsonEntry, true, false);
        expect(result.answers).toEqual({'q_1': {answer: 'test'}});
    });

    it('should initialise titles as a stringified empty object', () => {
        const result = JSONTransformerService.flattenJsonEntry(baseJsonEntry, true, false);
        expect(result.titles).toBe(JSON.stringify({}));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeJsonFileEntry
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — makeJsonFileEntry', () => {

    beforeEach(() => vi.clearAllMocks());

    const baseFile = {
        entry_uuid: 'file-uuid-1',
        form_ref: 'form-ref-1',
        file_name: 'photo.jpg',
        file_type: 'image/jpeg',
        input_ref: 'q_photo',
        created_at: '2026-03-05T10:00:00Z'
    };

    it('should set type to file_entry', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});
        expect(result.type).toBe('file_entry');
    });

    it('should use entry_uuid as the top-level id', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});
        expect(result.id).toBe('file-uuid-1');
    });

    it('should populate file_entry fields correctly', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});

        expect(result.file_entry.name).toBe('photo.jpg');
        expect(result.file_entry.type).toBe('image/jpeg');
        expect(result.file_entry.input_ref).toBe('q_photo');
        expect(result.file_entry.entry_uuid).toBe('file-uuid-1');
        expect(result.file_entry.created_at).toBe('2026-03-05T10:00:00Z');
    });

    it('should default created_at to a current ISO string when not provided', () => {
        const before = new Date().toISOString();
        const file = {...baseFile};
        delete file.created_at;

        const result = JSONTransformerService.makeJsonFileEntry(file);
        const after = new Date().toISOString();

        const createdAt = Date.parse(result.file_entry.created_at);
        expect(createdAt).toBeGreaterThanOrEqual(Date.parse(before));
        expect(createdAt).toBeLessThanOrEqual(Date.parse(after));
    });

    it('should set device_id from the root store', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});
        expect(result.file_entry.device_id).toBe('test-device');
    });

    it('should set form ref in attributes', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});
        expect(result.attributes.form.ref).toBe('form-ref-1');
    });

    it('should have empty parent and branch relationships', () => {
        const result = JSONTransformerService.makeJsonFileEntry({...baseFile});
        expect(result.relationships.parent).toEqual({});
        expect(result.relationships.branch).toEqual({});
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// makeUniqueEntry
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — makeUniqueEntry', () => {

    const baseEntry = {
        entryUuid: 'entry-uuid-1',
        isBranch: false,
        parentEntryUuid: 'parent-uuid-1',
        parentFormRef: 'parent-form-ref',
        ownerEntryUuid: null,
        ownerInputRef: null
    };

    it('should use ENTRY type when isBranch is false', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v1');
        expect(result.type).toBe('entry');
    });

    it('should use BRANCH_ENTRY type when isBranch is true', () => {
        const branchEntry = {...baseEntry, isBranch: true, ownerEntryUuid: 'owner-uuid-1', ownerInputRef: 'q_branch'};
        const result = JSONTransformerService.makeUniqueEntry('form-ref', branchEntry, 'q_1', 'answer', 'v1');
        expect(result.type).toBe('branch_entry');
    });

    it('should use entry_uuid as the top-level id', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v1');
        expect(result.id).toBe('entry-uuid-1');
    });

    it('should embed the answer and input_ref in the entry payload', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'my-answer', 'v1');
        expect(result.entry.input_ref).toBe('q_1');
        expect(result.entry.answer).toBe('my-answer');
    });

    it('should embed the project_version in the entry payload', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v42');
        expect(result.entry.project_version).toBe('v42');
    });

    it('should populate parent relationship when parentEntryUuid is present', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v1');
        expect(result.relationships.parent.data.parent_entry_uuid).toBe('parent-uuid-1');
        expect(result.relationships.parent.data.parent_form_ref).toBe('parent-form-ref');
    });

    it('should have empty parent relationship when parentEntryUuid is absent', () => {
        const noParent = {...baseEntry, parentEntryUuid: null};
        const result = JSONTransformerService.makeUniqueEntry('form-ref', noParent, 'q_1', 'answer', 'v1');
        expect(result.relationships.parent).toEqual({});
    });

    it('should populate branch relationship when ownerEntryUuid is present', () => {
        const branchEntry = {...baseEntry, isBranch: true, ownerEntryUuid: 'owner-uuid-1', ownerInputRef: 'q_branch'};
        const result = JSONTransformerService.makeUniqueEntry('form-ref', branchEntry, 'q_1', 'answer', 'v1');
        expect(result.relationships.branch.data.owner_entry_uuid).toBe('owner-uuid-1');
        expect(result.relationships.branch.data.owner_input_ref).toBe('q_branch');
    });

    it('should have empty branch relationship when ownerEntryUuid is absent', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v1');
        expect(result.relationships.branch).toEqual({});
    });

    it('should set form ref in attributes', () => {
        const result = JSONTransformerService.makeUniqueEntry('form-ref', baseEntry, 'q_1', 'answer', 'v1');
        expect(result.attributes.form.ref).toBe('form-ref');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Answer types inside a branch row
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Answer Types Inside a Branch Row', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        projectModel.getProjectExtra.mockReturnValue({
            forms: {
                'f_1': {
                    branch: {'branch_ref': ['q_radio', 'q_check']}
                }
            }
        });
    });

    const mappings = [{
        is_default: true,
        forms: {
            'f_1': {
                'branch_ref': {
                    branch: {
                        'q_radio': {map_to: 'RadioCol'},
                        'q_check': {map_to: 'CheckCol'}
                    }
                }
            }
        }
    }];

    const branch = {branchRef: 'branch_ref', formRef: 'f_1'};
    const entry = {owner_entry_uuid: 'own-1', entry_uuid: 'br-1', created_at: '2026-03-05', title: 'T'};

    const possibleAnswers = [
        {answer_ref: 'r_a', answer: 'Alpha'},
        {answer_ref: 'r_b', answer: 'Beta'}
    ];

    it('should resolve radio label inside a branch row', async () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_radio') return {type: 'radio', ref: 'q_radio', possible_answers: possibleAnswers};
            if (ref === 'q_check') return {type: 'checkbox', ref: 'q_check', possible_answers: possibleAnswers};
        });

        const answers = {'q_radio': {answer: 'r_a'}, 'q_check': {answer: []}};
        const headers = Papa.parse(JSONTransformerService.getBranchCSVHeaders(branch, mappings)).data[0];
        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, answers)).data[0];

        expect(row[headers.indexOf('RadioCol')]).toBe('Alpha');
    });

    it('should join checkbox labels inside a branch row', async () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_radio') return {type: 'radio', ref: 'q_radio', possible_answers: possibleAnswers};
            if (ref === 'q_check') return {type: 'checkbox', ref: 'q_check', possible_answers: possibleAnswers};
        });

        const answers = {'q_radio': {answer: ''}, 'q_check': {answer: ['r_a', 'r_b']}};
        const headers = Papa.parse(JSONTransformerService.getBranchCSVHeaders(branch, mappings)).data[0];
        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, answers)).data[0];

        expect(row[headers.indexOf('CheckCol')]).toBe('Alpha, Beta');
    });
});
