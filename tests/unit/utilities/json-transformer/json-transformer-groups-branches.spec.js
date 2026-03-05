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

const FORM_REF = 'form_ref_1';
const BRANCH_OWNER_INPUT_REF = 'q_branch';
const GROUP_IN_BRANCH_REF = 'group_in_branch';
const PLAIN_GROUP_REF = 'plain_group';

// ─────────────────────────────────────────────────────────────────────────────
// Plain Group
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Plain Group', () => {

    beforeEach(() => vi.clearAllMocks());

    const plainGroupMappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                'q_name': { map_to: 'Name' },
                [PLAIN_GROUP_REF]: {
                    group: { [`${PLAIN_GROUP_REF}_q_sex`]: { map_to: 'Sex' } }
                }
            }
        }
    }];

    it('should generate correct headers for a plain group', () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_name') return { type: 'text', ref: 'q_name' };
            if (ref === PLAIN_GROUP_REF) return { type: 'group', ref: PLAIN_GROUP_REF };
            if (ref === `${PLAIN_GROUP_REF}_q_sex`) return { type: 'text', ref: `${PLAIN_GROUP_REF}_q_sex` };
        });
        projectModel.getGroupInputRefs.mockReturnValue([`${PLAIN_GROUP_REF}_q_sex`]);

        const form = { details: { ref: FORM_REF }, inputs: ['q_name', PLAIN_GROUP_REF] };
        const result = JSONTransformerService.getFormCSVHeaders(form, plainGroupMappings, false, 0, false);
        const headers = Papa.parse(result).data[0];

        expect(headers).not.toContain('PlainGroup');
        expect(headers).toEqual(['ec5_uuid', 'created_at', 'title', 'Name', 'Sex']);
    });

    it('should generate correct row data for a plain group', async () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_name') return { type: 'text', ref: 'q_name' };
            if (ref === PLAIN_GROUP_REF) return { type: 'group', ref: PLAIN_GROUP_REF };
            if (ref === `${PLAIN_GROUP_REF}_q_sex`) return { type: 'text', ref: `${PLAIN_GROUP_REF}_q_sex` };
        });
        projectModel.getGroupInputRefs.mockReturnValue([`${PLAIN_GROUP_REF}_q_sex`]);

        const form = { details: { ref: FORM_REF }, inputs: ['q_name', PLAIN_GROUP_REF] };
        const entry = { entry_uuid: 'e-1', created_at: '2026-03-05', title: 'T' };
        const answers = { 'q_name': { answer: 'Alice' }, [`${PLAIN_GROUP_REF}_q_sex`]: { answer: 'Female' } };

        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, plainGroupMappings, false, 0, false)).data[0];
        const row = Papa.parse(await JSONTransformerService.getFormCSVRow(entry, form, answers, false)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[headers.indexOf('Name')]).toBe('Alice');
        expect(row[headers.indexOf('Sex')]).toBe('Female');
    });

    it('should not bleed branchOwnerInputRef from a branch question into a subsequent plain group', () => {
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === BRANCH_OWNER_INPUT_REF) return { type: 'branch', ref: BRANCH_OWNER_INPUT_REF };
            if (ref === PLAIN_GROUP_REF) return { type: 'group', ref: PLAIN_GROUP_REF };
            if (ref === `${PLAIN_GROUP_REF}_q_sex`) return { type: 'text', ref: `${PLAIN_GROUP_REF}_q_sex` };
        });
        projectModel.getGroupInputRefs.mockReturnValue([`${PLAIN_GROUP_REF}_q_sex`]);

        const mixedMappings = [{
            is_default: true,
            forms: {
                [FORM_REF]: {
                    [BRANCH_OWNER_INPUT_REF]: { map_to: 'BranchCount' },
                    [PLAIN_GROUP_REF]: { group: { [`${PLAIN_GROUP_REF}_q_sex`]: { map_to: 'Sex' } } }
                }
            }
        }];
        const form = { details: { ref: FORM_REF }, inputs: [BRANCH_OWNER_INPUT_REF, PLAIN_GROUP_REF] };
        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, mixedMappings, false, 0, false)).data[0];

        expect(headers).toContain('Sex');
        expect(headers).not.toContain('undefined');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group Nested in Branch
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Group Nested in Branch', () => {

    beforeEach(() => vi.clearAllMocks());

    const branchWithGroupMappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                [BRANCH_OWNER_INPUT_REF]: {
                    branch: {
                        [GROUP_IN_BRANCH_REF]: {
                            group: {
                                [`${GROUP_IN_BRANCH_REF}_q_photo`]: { map_to: 'Photo' },
                                [`${GROUP_IN_BRANCH_REF}_q_text`]: { map_to: 'GroupText' }
                            },
                            map_to: 'NestedGroup'
                        }
                    },
                    map_to: 'BranchCount'
                }
            }
        }
    }];

    const setupBranchWithGroupMocks = () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { [BRANCH_OWNER_INPUT_REF]: [GROUP_IN_BRANCH_REF] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === GROUP_IN_BRANCH_REF) return { type: 'group', ref: GROUP_IN_BRANCH_REF };
            if (ref === `${GROUP_IN_BRANCH_REF}_q_photo`) return { type: 'text', ref: `${GROUP_IN_BRANCH_REF}_q_photo` };
            if (ref === `${GROUP_IN_BRANCH_REF}_q_text`) return { type: 'text', ref: `${GROUP_IN_BRANCH_REF}_q_text` };
        });
        projectModel.getGroupInputRefs.mockReturnValue([
            `${GROUP_IN_BRANCH_REF}_q_photo`,
            `${GROUP_IN_BRANCH_REF}_q_text`
        ]);
    };

    it('should generate correct branch headers when a group is nested inside the branch', () => {
        setupBranchWithGroupMocks();
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({ branchRef: BRANCH_OWNER_INPUT_REF, formRef: FORM_REF }, branchWithGroupMappings)
        ).data[0];

        expect(headers).not.toContain('NestedGroup');
        expect(headers).toContain('Photo');
        expect(headers).toContain('GroupText');
        expect(headers[0]).toBe('ec5_branch_owner_uuid');
        expect(headers[1]).toBe('ec5_branch_uuid');
        expect(headers).not.toContain('undefined');
    });

    it('should generate correct row data for a group nested inside a branch', async () => {
        setupBranchWithGroupMocks();
        const branch = { branchRef: BRANCH_OWNER_INPUT_REF, formRef: FORM_REF };
        const entry = { owner_entry_uuid: 'owner-1', entry_uuid: 'branch-entry-1', created_at: '2026-03-05', title: 'Branch Entry' };
        const answers = {
            [`${GROUP_IN_BRANCH_REF}_q_photo`]: { answer: 'sunset.jpg' },
            [`${GROUP_IN_BRANCH_REF}_q_text`]: { answer: 'Beautiful view' }
        };

        const headers = Papa.parse(JSONTransformerService.getBranchCSVHeaders(branch, branchWithGroupMappings)).data[0];
        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, answers)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[0]).toBe('owner-1');
        expect(row[headers.indexOf('Photo')]).toBe('sunset.jpg');
        expect(row[headers.indexOf('GroupText')]).toBe('Beautiful view');
    });

    it('should handle missing answers for group inputs inside a branch gracefully', async () => {
        setupBranchWithGroupMocks();
        const branch = { branchRef: BRANCH_OWNER_INPUT_REF, formRef: FORM_REF };
        const entry = { owner_entry_uuid: 'owner-1', entry_uuid: 'b-1', created_at: '2026-03-05', title: 'T' };

        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, {})).data[0];

        expect(row.length).toBeGreaterThan(4);
        row.slice(4).forEach((cell) => expect(cell).toBe(''));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Header/Row Parity — Mixed Form (plain group + branch)
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Header/Row Parity for Mixed Form', () => {

    beforeEach(() => vi.clearAllMocks());

    it('should maintain parity when a form has both a plain group and a branch', async () => {
        const mixedMappings = [{
            is_default: true,
            forms: {
                [FORM_REF]: {
                    'q_name': { map_to: 'Name' },
                    [PLAIN_GROUP_REF]: { group: { [`${PLAIN_GROUP_REF}_q_sex`]: { map_to: 'Sex' } } },
                    [BRANCH_OWNER_INPUT_REF]: { map_to: 'BranchCount' }
                }
            }
        }];

        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'q_name') return { type: 'text', ref: 'q_name' };
            if (ref === PLAIN_GROUP_REF) return { type: 'group', ref: PLAIN_GROUP_REF };
            if (ref === `${PLAIN_GROUP_REF}_q_sex`) return { type: 'text', ref: `${PLAIN_GROUP_REF}_q_sex` };
            if (ref === BRANCH_OWNER_INPUT_REF) return { type: 'branch', ref: BRANCH_OWNER_INPUT_REF };
        });
        projectModel.getGroupInputRefs.mockReturnValue([`${PLAIN_GROUP_REF}_q_sex`]);
        databaseSelectService.countBranchesForQuestion.mockResolvedValue({
            rows: { item: () => ({ total: 3 }) }
        });

        const form = { details: { ref: FORM_REF }, inputs: ['q_name', PLAIN_GROUP_REF, BRANCH_OWNER_INPUT_REF] };
        const entry = { entry_uuid: 'e-1', created_at: '2026-03-05', title: 'T' };
        const answers = { 'q_name': { answer: 'Bob' }, [`${PLAIN_GROUP_REF}_q_sex`]: { answer: 'Male' } };

        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, mixedMappings, false, 0, false)).data[0];
        const row = Papa.parse(await JSONTransformerService.getFormCSVRow(entry, form, answers, false)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[headers.indexOf('Name')]).toBe('Bob');
        expect(row[headers.indexOf('Sex')]).toBe('Male');
        expect(row[headers.indexOf('BranchCount')]).toBe('3');
        expect(headers).not.toContain('undefined');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Plain Groups on the Same Form
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Multiple Plain Groups on the Same Form', () => {

    beforeEach(() => vi.clearAllMocks());

    const mappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                'q_name':       { map_to: 'Name' },
                'plain_group_a':{ group: { 'q_color': { map_to: 'Color' } } },
                'plain_group_b':{ group: { 'q_age':   { map_to: 'Age'   } } }
            }
        }
    }];

    const inputDefs = {
        'q_name':       { type: 'text',  ref: 'q_name' },
        'plain_group_a':{ type: 'group', ref: 'plain_group_a' },
        'q_color':      { type: 'text',  ref: 'q_color' },
        'plain_group_b':{ type: 'group', ref: 'plain_group_b' },
        'q_age':        { type: 'text',  ref: 'q_age' }
    };

    const form = { details: { ref: FORM_REF }, inputs: ['q_name', 'plain_group_a', 'plain_group_b'] };

    beforeEach(() => {
        projectModel.getInput.mockImplementation((ref) => inputDefs[ref]);
        projectModel.getGroupInputRefs.mockImplementation((formRef, groupRef) => {
            if (groupRef === 'plain_group_a') return ['q_color'];
            if (groupRef === 'plain_group_b') return ['q_age'];
        });
    });

    it('should generate correct headers for two plain groups', () => {
        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, mappings, false, 0, false)).data[0];

        expect(headers).toEqual(['ec5_uuid', 'created_at', 'title', 'Name', 'Color', 'Age']);
        expect(headers).not.toContain('undefined');
    });

    it('should generate correct row data for two plain groups', async () => {
        const entry = { entry_uuid: 'e-1', created_at: '2026-03-05', title: 'T' };
        const answers = { 'q_name': { answer: 'Alice' }, 'q_color': { answer: 'Blue' }, 'q_age': { answer: '30' } };

        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, mappings, false, 0, false)).data[0];
        const row = Papa.parse(await JSONTransformerService.getFormCSVRow(entry, form, answers, false)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[headers.indexOf('Name')]).toBe('Alice');
        expect(row[headers.indexOf('Color')]).toBe('Blue');
        expect(row[headers.indexOf('Age')]).toBe('30');
    });

    it('second plain group must not inherit groupRef from the first', () => {
        const headers = Papa.parse(JSONTransformerService.getFormCSVHeaders(form, mappings, false, 0, false)).data[0];

        expect(headers).toContain('Color');
        expect(headers).toContain('Age');
        expect(headers).not.toContain('undefined');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Branches Each With a Nested Group
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Multiple Branches Each With a Nested Group', () => {

    beforeEach(() => vi.clearAllMocks());

    const branchAMappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                'branch_a': {
                    branch: {
                        'group_in_branch_a': {
                            group: { 'q_photo': { map_to: 'Photo' }, 'q_caption': { map_to: 'Caption' } },
                            map_to: 'PhotoGroup'
                        }
                    },
                    map_to: 'BranchACount'
                }
            }
        }
    }];

    const branchBMappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                'branch_b': {
                    branch: {
                        'group_in_branch_b': {
                            group: { 'q_member_name': { map_to: 'MemberName' }, 'q_member_age': { map_to: 'MemberAge' } },
                            map_to: 'MemberGroup'
                        }
                    },
                    map_to: 'BranchBCount'
                }
            }
        }
    }];

    it('branch_a headers should only contain its own group columns', () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { 'branch_a': ['group_in_branch_a'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_in_branch_a') return { type: 'group', ref: 'group_in_branch_a' };
            if (ref === 'q_photo')           return { type: 'text',  ref: 'q_photo' };
            if (ref === 'q_caption')         return { type: 'text',  ref: 'q_caption' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_photo', 'q_caption']);

        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({ branchRef: 'branch_a', formRef: FORM_REF }, branchAMappings)
        ).data[0];

        expect(headers).toContain('Photo');
        expect(headers).toContain('Caption');
        expect(headers).not.toContain('MemberName');
        expect(headers).not.toContain('MemberAge');
        expect(headers).not.toContain('undefined');
    });

    it('branch_b headers should only contain its own group columns', () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { 'branch_b': ['group_in_branch_b'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_in_branch_b') return { type: 'group', ref: 'group_in_branch_b' };
            if (ref === 'q_member_name')     return { type: 'text',  ref: 'q_member_name' };
            if (ref === 'q_member_age')      return { type: 'text',  ref: 'q_member_age' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_member_name', 'q_member_age']);

        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({ branchRef: 'branch_b', formRef: FORM_REF }, branchBMappings)
        ).data[0];

        expect(headers).toContain('MemberName');
        expect(headers).toContain('MemberAge');
        expect(headers).not.toContain('Photo');
        expect(headers).not.toContain('Caption');
        expect(headers).not.toContain('undefined');
    });

    it('branch_a row data must not bleed into branch_b row data', async () => {
        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { 'branch_a': ['group_in_branch_a'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_in_branch_a') return { type: 'group', ref: 'group_in_branch_a' };
            if (ref === 'q_photo')           return { type: 'text',  ref: 'q_photo' };
            if (ref === 'q_caption')         return { type: 'text',  ref: 'q_caption' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_photo', 'q_caption']);

        const rowA = Papa.parse(await JSONTransformerService.getBranchCSVRow(
            { owner_entry_uuid: 'owner-1', entry_uuid: 'ba-1', created_at: '2026-03-05', title: 'Photo Entry' },
            { branchRef: 'branch_a', formRef: FORM_REF },
            { 'q_photo': { answer: 'img.jpg' }, 'q_caption': { answer: 'Sunset' } }
        )).data[0];

        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { 'branch_b': ['group_in_branch_b'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => {
            if (ref === 'group_in_branch_b') return { type: 'group', ref: 'group_in_branch_b' };
            if (ref === 'q_member_name')     return { type: 'text',  ref: 'q_member_name' };
            if (ref === 'q_member_age')      return { type: 'text',  ref: 'q_member_age' };
        });
        projectModel.getGroupInputRefs.mockReturnValue(['q_member_name', 'q_member_age']);

        const rowB = Papa.parse(await JSONTransformerService.getBranchCSVRow(
            { owner_entry_uuid: 'owner-1', entry_uuid: 'bb-1', created_at: '2026-03-05', title: 'Member Entry' },
            { branchRef: 'branch_b', formRef: FORM_REF },
            { 'q_member_name': { answer: 'Bob' }, 'q_member_age': { answer: '25' } }
        )).data[0];

        expect(rowA).toContain('Sunset');
        expect(rowA).not.toContain('Bob');
        expect(rowB).toContain('Bob');
        expect(rowB).not.toContain('Sunset');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Groups Inside One Branch
// ─────────────────────────────────────────────────────────────────────────────
describe('JSONTransformerService — Multiple Groups Inside One Branch', () => {

    const mappings = [{
        is_default: true,
        forms: {
            [FORM_REF]: {
                'branch_owner': {
                    branch: {
                        'q_direct_text': { map_to: 'DirectText', group: [], branch: [] },
                        'group_media':   { group: { 'q_photo': { map_to: 'Photo' }, 'q_video': { map_to: 'Video' } }, map_to: 'MediaGroup' },
                        'group_details': { group: { 'q_notes': { map_to: 'Notes' }, 'q_rating': { map_to: 'Rating' } }, map_to: 'DetailsGroup' }
                    },
                    map_to: 'BranchCount'
                }
            }
        }
    }];

    const inputDefs = {
        'q_direct_text': { type: 'text',  ref: 'q_direct_text' },
        'group_media':   { type: 'group', ref: 'group_media' },
        'q_photo':       { type: 'text',  ref: 'q_photo' },
        'q_video':       { type: 'text',  ref: 'q_video' },
        'group_details': { type: 'group', ref: 'group_details' },
        'q_notes':       { type: 'text',  ref: 'q_notes' },
        'q_rating':      { type: 'text',  ref: 'q_rating' }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        projectModel.getProjectExtra.mockReturnValue({
            forms: { [FORM_REF]: { branch: { 'branch_owner': ['q_direct_text', 'group_media', 'group_details'] } } }
        });
        projectModel.getInput.mockImplementation((ref) => inputDefs[ref]);
        projectModel.getGroupInputRefs.mockImplementation((formRef, groupRef) => {
            if (groupRef === 'group_media')   return ['q_photo', 'q_video'];
            if (groupRef === 'group_details') return ['q_notes', 'q_rating'];
        });
    });

    it('should generate all columns for a branch with two nested groups', () => {
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({ branchRef: 'branch_owner', formRef: FORM_REF }, mappings)
        ).data[0];

        expect(headers).not.toContain('MediaGroup');
        expect(headers).not.toContain('DetailsGroup');
        expect(headers).toContain('DirectText');
        expect(headers).toContain('Photo');
        expect(headers).toContain('Video');
        expect(headers).toContain('Notes');
        expect(headers).toContain('Rating');
        expect(headers).not.toContain('undefined');
    });

    it('second nested group must not inherit groupRef from the first nested group', () => {
        const headers = Papa.parse(
            JSONTransformerService.getBranchCSVHeaders({ branchRef: 'branch_owner', formRef: FORM_REF }, mappings)
        ).data[0];

        const photoIdx  = headers.indexOf('Photo');
        const notesIdx  = headers.indexOf('Notes');
        const ratingIdx = headers.indexOf('Rating');

        expect(headers.indexOf('Video')).not.toBe(-1);
        expect(notesIdx).not.toBe(-1);
        expect(ratingIdx).not.toBe(-1);
        expect(photoIdx).toBeLessThan(notesIdx);
    });

    it('should produce correct row values for both nested groups with parity', async () => {
        const branch = { branchRef: 'branch_owner', formRef: FORM_REF };
        const entry = { owner_entry_uuid: 'owner-1', entry_uuid: 'b-entry-1', created_at: '2026-03-05', title: 'Branch Entry' };
        const answers = {
            'q_direct_text': { answer: 'hello' },
            'q_photo':       { answer: 'photo.jpg' },
            'q_video':       { answer: 'video.mp4' },
            'q_notes':       { answer: 'Great!' },
            'q_rating':      { answer: '5' }
        };

        const headers = Papa.parse(JSONTransformerService.getBranchCSVHeaders(branch, mappings)).data[0];
        const row = Papa.parse(await JSONTransformerService.getBranchCSVRow(entry, branch, answers)).data[0];

        expect(headers.length).toBe(row.length);
        expect(row[headers.indexOf('DirectText')]).toBe('hello');
        expect(row[headers.indexOf('Photo')]).toBe('photo.jpg');
        expect(row[headers.indexOf('Video')]).toBe('video.mp4');
        expect(row[headers.indexOf('Notes')]).toBe('Great!');
        expect(row[headers.indexOf('Rating')]).toBe('5');
    });
});
