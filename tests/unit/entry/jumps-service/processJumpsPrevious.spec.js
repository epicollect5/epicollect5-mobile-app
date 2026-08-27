import { entryCommonService } from '@/services/entry/entry-common-service';
import { projectModel } from '@/models/project-model';
import { vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

//imp: mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

const projectStub = {
    details: { ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf' }
};

// Ordered question refs, like form.inputs
const inputs = [
    '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_A',
    '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_B',
    '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_C',
    '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_D'
];

function makeAnswers (overrides = {}) {
    return {
        [inputs[0]]: { was_jumped: false, answer: '' },
        [inputs[1]]: { was_jumped: false, answer: '' },
        [inputs[2]]: { was_jumped: false, answer: '' },
        [inputs[3]]: { was_jumped: false, answer: '' },
        ...overrides
    };
}

describe('processJumpsPrevious', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        projectModel.initialise(projectStub);
    });

    it('returns the immediate previous input when it was not jumped', () => {
        // current question is index 3 (D); previous candidate is index 2 (C)
        const entry = { answers: makeAnswers() };
        const result = entryCommonService.processJumpsPrevious(entry, 3, inputs);

        expect(result).toMatchObject({
            previous_input_ref: inputs[2],
            previous_input_index: 2
        });
    });

    it('skips previously jumped inputs and returns the first not-jumped one', () => {
        // current question is index 3 (D); C and B were jumped, A was not
        const entry = {
            answers: makeAnswers({
                [inputs[2]]: { was_jumped: true, answer: '' },
                [inputs[1]]: { was_jumped: true, answer: '' }
            })
        };
        const result = entryCommonService.processJumpsPrevious(entry, 3, inputs);

        expect(result).toMatchObject({
            previous_input_ref: inputs[0],
            previous_input_index: 0
        });
    });

    it('does not crash when an answer object is missing and returns that input', () => {
        // imp: reproduces the Rollbar crash (entry edited after a failed upload
        // with "Question answer missing"): an input ref exists in form.inputs
        // but has no corresponding answer object
        const answers = makeAnswers();
        delete answers[inputs[1]];
        const entry = { answers };

        // current question is index 2 (C); previous candidate is index 1 (B),
        // whose answer is missing
        expect(() => entryCommonService.processJumpsPrevious(entry, 2, inputs)).not.toThrow();

        const result = entryCommonService.processJumpsPrevious(entry, 2, inputs);
        expect(result).toMatchObject({
            previous_input_ref: inputs[1],
            previous_input_index: 1
        });
    });

    it('falls back to the first input when every previous answer was jumped', () => {
        // current question is index 3 (D); C, B and A were all jumped: must not
        // run past the start of the form (which would make prevInputRef
        // undefined and crash)
        const entry = {
            answers: makeAnswers({
                [inputs[2]]: { was_jumped: true, answer: '' },
                [inputs[1]]: { was_jumped: true, answer: '' },
                [inputs[0]]: { was_jumped: true, answer: '' }
            })
        };
        const result = entryCommonService.processJumpsPrevious(entry, 3, inputs);

        expect(result).toMatchObject({
            previous_input_ref: inputs[0],
            previous_input_index: 0
        });
    });
});
