import { jumpsService } from '@/services/entry/jumps-service';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { wasJumpEdited } from '@/use/questions/was-jump-edited';
import { vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

//imp: mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

const inputRef = 'd0e78fbfec83499c955271d9c2a2b5c9_631898d10c582_63864da1621d5';
const params = {
    existingAnswer: [
        '63864da1621d6'
    ],
    mainInputDetails: {
        ref: inputRef,
        type: 'checkbox',
        jumps: [
            {
                to: 'END',
                when: 'IS',
                answer_ref: '63864daa621d7'
            }
        ],
        question: 'jump on checkboxes',
        possible_answers: [
            {
                answer: 'one',
                answer_ref: '63864da1621d6'
            },
            {
                answer: 'two',
                answer_ref: '63864daa621d7'
            }
        ]
    }
};

const entryService = {
    action: 'EDIT',
    type: 'entry',
    entry: {
        answers: {
            [inputRef]: {
                was_jumped: false,
                answer: [
                    '63864daa621d7'
                ]
            }
        }
    }

};

describe('wasJumpEdited', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it(PARAMETERS.QUESTION_TYPES.CHECKBOX, () => {
        //answer is array []
        params.mainInputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;

        params.existingAnswer = [
            '63864daa621d6'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);


        params.existingAnswer = [
            '63864daa621d7'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(false);


        params.existingAnswer = [
            '63864da1621d6',
            '63864daa621d7'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);
        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [];
        expect(wasJumpEdited(entryService, params)).toBe(false);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE, () => {
        //answer is array []
        params.mainInputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;

        params.existingAnswer = [
            '63864daa621d6'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = [
            '63864daa621d7'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(false);

        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);
        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [];
        expect(wasJumpEdited(entryService, params)).toBe(false);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE, () => {
        //answer is array []
        params.mainInputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;

        params.existingAnswer = [
            '63864daa621d6'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);


        params.existingAnswer = [
            '63864daa621d7'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(false);


        params.existingAnswer = [
            '63864da1621d6',
            '63864daa621d7'
        ];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [
            '63864daa621d7'
        ];
        expect(wasJumpEdited(entryService, params)).toBe(true);
        params.existingAnswer = [];
        entryService.entry.answers[inputRef].answer = [];
        expect(wasJumpEdited(entryService, params)).toBe(false);
    });

    it(PARAMETERS.QUESTION_TYPES.RADIO, () => {
        //answer is string
        params.mainInputDetails.type = PARAMETERS.QUESTION_TYPES.RADIO;

        params.existingAnswer = '63864daa621d6';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = '63864daa621d7';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(false);

        params.existingAnswer = '';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = '';
        entryService.entry.answers[inputRef].answer = '';
        expect(wasJumpEdited(entryService, params)).toBe(false);
    });

    it(PARAMETERS.QUESTION_TYPES.DROPDOWN, () => {
        //answer is string
        params.mainInputDetails.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;

        params.existingAnswer = '63864daa621d6';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = '63864daa621d7';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(false);

        params.existingAnswer = '';
        entryService.entry.answers[inputRef].answer = '63864daa621d7';
        expect(wasJumpEdited(entryService, params)).toBe(true);

        params.existingAnswer = '';
        entryService.entry.answers[inputRef].answer = '';
        expect(wasJumpEdited(entryService, params)).toBe(false);
    });
});