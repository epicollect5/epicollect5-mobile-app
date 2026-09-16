import { vi } from 'vitest';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { entryService } from '@/services/entry/entry-service';
import { initialSetup } from '@/use/questions/initial-setup';

vi.mock('@/models/project-model', () => ({
    projectModel: { getExtraInputs: vi.fn() }
}));

vi.mock('@/services/entry/entry-service', () => ({
    entryService: {
        form: {},
        entry: { canEdit: 1 },
        getAnswers: vi.fn()
    }
}));

vi.mock('@/services/entry/branch-entry-service', () => ({
    branchEntryService: { branchInputs: [] }
}));

const GROUP_REF = 'form1_group1';
const CHILD_TEXT = 'form1_group1_text';
const CHILD_INTEGER = 'form1_group1_integer';
const CHILD_CHECKBOX = 'form1_group1_checkbox';

function makeInputsExtra(extra = {}) {
    return {
        [GROUP_REF]: {
            data: {
                ref: GROUP_REF,
                type: PARAMETERS.QUESTION_TYPES.GROUP,
                verify: false
            }
        },
        [CHILD_TEXT]: {
            data: {
                ref: CHILD_TEXT,
                type: PARAMETERS.QUESTION_TYPES.TEXT,
                verify: false,
                default: ''
            }
        },
        [CHILD_INTEGER]: {
            data: {
                ref: CHILD_INTEGER,
                type: PARAMETERS.QUESTION_TYPES.INTEGER,
                verify: false,
                default: ''
            }
        },
        [CHILD_CHECKBOX]: {
            data: {
                ref: CHILD_CHECKBOX,
                type: PARAMETERS.QUESTION_TYPES.CHECKBOX,
                verify: false,
                default: '',
                possible_answers: []
            }
        },
        ...extra
    };
}

function makeAnswer(value) {
    return { answer: value, was_jumped: false };
}

function setupScope({ answers, groupChildren }) {
    entryService.form = {
        inputs: ['form1_q1', 'form1_q2', GROUP_REF],
        formStructure: {
            group: {
                [GROUP_REF]: groupChildren
            }
        }
    };
    entryService.getAnswers.mockImplementation(() => answers);
    return { entryService };
}

function setupState() {
    return {
        questionParams: {
            currentInputRef: GROUP_REF,
            currentInputIndex: 2,
            isBranch: false
        }
    };
}

describe('initialSetup - GROUP with stale stored answers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        entryService.entry = { canEdit: 1 };
    });

    it('backfills a missing group child answer instead of crashing', async () => {
        projectModel.getExtraInputs.mockReturnValue(makeInputsExtra());
        //stored entry predates the integer question added to the group later
        const answers = {
            [GROUP_REF]: makeAnswer(''),
            [CHILD_TEXT]: makeAnswer('hello')
        };
        const scope = setupScope({ answers, groupChildren: [CHILD_TEXT, CHILD_INTEGER] });

        const state = setupState();
        await expect(initialSetup(state, scope)).resolves.toBeUndefined();

        //missing child is shown empty (type-correct default) and editable
        expect(state.answers[CHILD_INTEGER]).toMatchObject(makeAnswer(''));
        //existing answers are untouched (no overwrite)
        expect(state.answers[CHILD_TEXT]).toMatchObject(makeAnswer('hello'));
        expect(state.existingAnswer).toBe('');
        //confirmation answers cover the whole group
        expect(state.confirmAnswer[CHILD_TEXT].answer).toBe('hello');
        expect(state.confirmAnswer[CHILD_INTEGER].answer).toBe('');
    });

    it('backfills checkbox group children with an empty array', async () => {
        projectModel.getExtraInputs.mockReturnValue(makeInputsExtra());
        const answers = {
            [GROUP_REF]: makeAnswer(''),
            [CHILD_TEXT]: makeAnswer('hello')
        };
        const scope = setupScope({ answers, groupChildren: [CHILD_TEXT, CHILD_CHECKBOX] });

        const state = setupState();
        await initialSetup(state, scope);

        expect(state.answers[CHILD_CHECKBOX]).toMatchObject({ answer: [], was_jumped: false });
        expect(state.confirmAnswer[CHILD_CHECKBOX].answer).toEqual([]);
    });

    it('skips group children whose input definition is gone', async () => {
        const inputsExtra = makeInputsExtra();
        delete inputsExtra[CHILD_INTEGER];
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [GROUP_REF]: makeAnswer(''),
            [CHILD_TEXT]: makeAnswer('hello')
        };
        const scope = setupScope({ answers, groupChildren: [CHILD_TEXT, CHILD_INTEGER] });

        const state = setupState();
        await expect(initialSetup(state, scope)).resolves.toBeUndefined();

        //unrenderable question is skipped, its siblings still set up
        expect(state.confirmAnswer[CHILD_INTEGER]).toBeUndefined();
        expect(state.answers[CHILD_INTEGER]).toBeUndefined();
        expect(state.confirmAnswer[CHILD_TEXT].answer).toBe('hello');
    });

    it('leaves complete group answers untouched (no-op on happy path)', async () => {
        projectModel.getExtraInputs.mockReturnValue(makeInputsExtra());
        const answers = {
            [GROUP_REF]: makeAnswer(''),
            [CHILD_TEXT]: makeAnswer('hello'),
            [CHILD_INTEGER]: makeAnswer(40)
        };
        const before = JSON.parse(JSON.stringify(answers));
        const scope = setupScope({ answers, groupChildren: [CHILD_TEXT, CHILD_INTEGER] });

        const state = setupState();
        await initialSetup(state, scope);

        expect(state.answers).toMatchObject(before);
        expect(state.confirmAnswer[CHILD_INTEGER].answer).toBe(40);
    });
});
