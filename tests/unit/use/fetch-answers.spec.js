import {describe, it, expect, vi, beforeEach} from 'vitest';
import {fetchAnswers} from '@/use/answers/fetch-answers';
import {fetchBranchAnswers} from '@/use/answers/fetch-branch-answers';
import {notificationService} from '@/services/notification-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {projectModel} from '@/models/project-model';
import {answerService} from '@/services/entry/answer-service';
import {utilsService} from '@/services/utilities/utils-service';
import {entryModel} from '@/models/entry-model';
import {branchEntryModel} from '@/models/branch-entry-model';
import {PARAMETERS} from '@/config';

vi.mock('@/services/notification-service', () => {
    const notificationService = vi.fn();
    notificationService.showProgressDialog = vi.fn();
    notificationService.hideProgressDialog = vi.fn();
    return {notificationService};
});

vi.mock('@/services/database/database-select-service', () => {
    const databaseSelectService = vi.fn();
    databaseSelectService.selectEntry = vi.fn();
    databaseSelectService.selectEntryMediaErrors = vi.fn();
    databaseSelectService.selectBranches = vi.fn();
    databaseSelectService.selectBranchEntry = vi.fn();
    return {databaseSelectService};
});

vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getFormGroups = vi.fn();
    return {projectModel};
});

vi.mock('@/services/entry/answer-service', () => {
    const answerService = vi.fn();
    answerService.parseAnswerForViewing = vi.fn();
    return {answerService};
});

vi.mock('@/services/utilities/utils-service', () => {
    const utilsService = vi.fn();
    utilsService.htmlDecode = vi.fn();
    utilsService.getProjectNameMarkup = vi.fn();
    return {utilsService};
});

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            status_codes: {}
        }
    }
}));

const GROUP_REF = 'group-1';
const Q1 = 'group-1_q1';
const Q2 = 'group-1_q2';
const Q3 = 'group-1_q3';

const labels = {
    wait: 'Please wait',
    loading_entry: 'Loading entry'
};

function buildInputsExtra() {
    return {
        [GROUP_REF]: {
            data: {
                ref: GROUP_REF,
                type: PARAMETERS.QUESTION_TYPES.GROUP,
                question: 'Group',
                possible_answers: []
            }
        },
        [Q1]: {
            data: {
                ref: Q1,
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                possible_answers: []
            }
        },
        [Q2]: {
            data: {
                ref: Q2,
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q2',
                possible_answers: []
            }
        },
        [Q3]: {
            data: {
                ref: Q3,
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q3',
                possible_answers: []
            }
        }
    };
}

let entryRow;
let branchEntryRow;

beforeEach(() => {
    vi.clearAllMocks();

    entryRow = {
        entry_uuid: 'entry-1',
        parent_entry_uuid: '',
        is_remote: 0,
        synced: 1,
        can_edit: 1,
        created_at: '2026-01-01 00:00:00',
        title: 'Entry 1',
        form_ref: 'form-1',
        parent_form_ref: '',
        project_ref: 'project-1',
        branchEntries: {},
        media: {},
        synced_error: '{}',
        answers: {}
    };
    branchEntryRow = {
        entry_uuid: 'branch-1',
        owner_entry_uuid: 'entry-1',
        owner_input_ref: GROUP_REF,
        is_remote: 0,
        synced: 1,
        can_edit: 1,
        created_at: '2026-01-01 00:00:00',
        title: 'Branch',
        form_ref: 'form-1',
        parent_form_ref: '',
        project_ref: 'project-1',
        media: {},
        synced_error: '{}',
        answers: {}
    };

    notificationService.showProgressDialog.mockResolvedValue();
    notificationService.hideProgressDialog.mockResolvedValue();
    databaseSelectService.selectEntry.mockResolvedValue({
        rows: {length: 1, item: () => entryRow}
    });
    databaseSelectService.selectEntryMediaErrors.mockResolvedValue({
        rows: {length: 0, item: () => ({})}
    });
    databaseSelectService.selectBranches.mockResolvedValue({
        rows: {length: 0, item: () => ({})}
    });
    databaseSelectService.selectBranchEntry.mockResolvedValue({
        rows: {length: 1, item: () => branchEntryRow}
    });
    projectModel.getFormGroups.mockReturnValue({[GROUP_REF]: [Q1, Q2, Q3]});
    answerService.parseAnswerForViewing.mockImplementation((inputDetails, answer) => answer);
    utilsService.htmlDecode.mockImplementation((question) => question);
    utilsService.getProjectNameMarkup.mockReturnValue('');
});

function buildEntryState() {
    return {
        isFetching: true,
        projectName: '',
        formRef: 'form-1',
        entryUuid: 'entry-1',
        parentEntryUuid: '',
        title: '',
        entry: entryModel,
        errors: {},
        branches: {},
        branchesMediaErrors: {},
        items: {},
        inputsExtra: buildInputsExtra(),
        inputs: [GROUP_REF],
        synced: null
    };
}

async function fetchAnswersAndWait(state) {
    fetchAnswers(state, 'en', labels);
    await vi.waitFor(() => {
        expect(state.isFetching).toBe(false);
    });
}

function buildBranchState() {
    return {
        isFetching: true,
        projectName: '',
        formRef: 'form-1',
        entryUuid: 'branch-1',
        parentEntryUuid: '',
        ownerEntryUuid: 'entry-1',
        ownerInputRef: GROUP_REF,
        title: '',
        entry: branchEntryModel,
        errors: {},
        branches: {},
        branchesMediaErrors: {},
        items: {},
        inputsExtra: buildInputsExtra(),
        branchInputs: [GROUP_REF],
        synced: null
    };
}

describe('fetchAnswers', () => {
    it('should skip group sub-answers that are missing and not crash (remote entry)', async () => {
        entryRow.is_remote = 1;
        entryRow.answers = {
            [GROUP_REF]: {was_jumped: false},
            [Q1]: {answer: 'A1', was_jumped: false},
            [Q2]: {answer: 'A2', was_jumped: false}
        };

        const state = buildEntryState();

        await fetchAnswersAndWait(state);

        expect(state.items[GROUP_REF].answer).toEqual({
            [Q1]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                answer: 'A1',
                synced_error: ''
            },
            [Q2]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q2',
                answer: 'A2',
                synced_error: ''
            }
        });
        expect(state.items[GROUP_REF].answer).not.toHaveProperty(Q3);
    });

    it('should skip group sub-answers that are missing and not crash (local entry)', async () => {
        entryRow.is_remote = 0;
        entryRow.answers = {
            [GROUP_REF]: {was_jumped: false},
            [Q1]: {answer: 'A1', was_jumped: false}
        };

        const state = buildEntryState();

        await fetchAnswersAndWait(state);

        expect(state.items[GROUP_REF].answer).toEqual({
            [Q1]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                answer: 'A1',
                synced_error: ''
            }
        });
        expect(state.items[GROUP_REF].answer).not.toHaveProperty(Q2);
        expect(state.items[GROUP_REF].answer).not.toHaveProperty(Q3);
    });

    it('should render all group sub-answers when present', async () => {
        entryRow.is_remote = 1;
        entryRow.answers = {
            [GROUP_REF]: {was_jumped: false},
            [Q1]: {answer: 'A1', was_jumped: false},
            [Q2]: {answer: 'A2', was_jumped: false},
            [Q3]: {answer: 'A3', was_jumped: false}
        };

        const state = buildEntryState();

        await fetchAnswersAndWait(state);

        expect(state.items[GROUP_REF].answer).toEqual({
            [Q1]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                answer: 'A1',
                synced_error: ''
            },
            [Q2]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q2',
                answer: 'A2',
                synced_error: ''
            },
            [Q3]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q3',
                answer: 'A3',
                synced_error: ''
            }
        });
    });
});

describe('fetchBranchAnswers', () => {
    it('should skip group sub-answers that are missing and not crash', async () => {
        branchEntryRow.answers = {
            [GROUP_REF]: {was_jumped: false},
            [Q1]: {answer: 'B1', was_jumped: false},
            [Q2]: {answer: 'B2', was_jumped: false}
        };

        const state = buildBranchState();

        await fetchBranchAnswers(state, 'en', labels);

        expect(state.items[GROUP_REF].answer).toEqual({
            [Q1]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                answer: 'B1',
                synced_error: ''
            },
            [Q2]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q2',
                answer: 'B2',
                synced_error: ''
            }
        });
        expect(state.items[GROUP_REF].answer).not.toHaveProperty(Q3);
    });

    it('should render all group sub-answers when present', async () => {
        branchEntryRow.answers = {
            [GROUP_REF]: {was_jumped: false},
            [Q1]: {answer: 'B1', was_jumped: false},
            [Q2]: {answer: 'B2', was_jumped: false},
            [Q3]: {answer: 'B3', was_jumped: false}
        };

        const state = buildBranchState();

        await fetchBranchAnswers(state, 'en', labels);

        expect(state.items[GROUP_REF].answer).toEqual({
            [Q1]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q1',
                answer: 'B1',
                synced_error: ''
            },
            [Q2]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q2',
                answer: 'B2',
                synced_error: ''
            },
            [Q3]: {
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                question: 'Q3',
                answer: 'B3',
                synced_error: ''
            }
        });
    });
});
