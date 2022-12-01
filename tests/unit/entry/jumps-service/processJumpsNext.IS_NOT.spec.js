import { jumpsService } from '@/services/entry/jumps-service';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model';
import { vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

//imp: mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

let lastUpdated = (new Date()).toISOString().replace('T', ' ');
lastUpdated = lastUpdated.split('.')[0];
const jsonExtra = {
    forms: {
        '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf': {
            group: [],
            lists: {
                location_inputs: [],
                multiple_choice_inputs: {
                    form: {
                        order: []
                    },
                    branch: []
                }
            },
            branch: [],
            inputs: [
                '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6312167f8f3a7',
                '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
                '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a'
            ],
            details: {
                ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf',
                name: 'Form One',
                slug: 'form-one',
                type: 'hierarchy',
                inputs: [
                    {
                        max: null,
                        min: null,
                        ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6312167f8f3a7',
                        type: 'checkbox',
                        group: [],
                        jumps: [
                            {
                                to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                                when: 'IS_NOT',
                                answer_ref: '6311cc468f3a0'
                            }
                        ],
                        regex: null,
                        branch: [],
                        verify: false,
                        default: null,
                        is_title: true,
                        question: 'Question with jump',
                        uniqueness: 'none',
                        is_required: false,
                        datetime_format: null,
                        possible_answers: [
                            {
                                answer: '1',
                                answer_ref: '6311cc468f3a0'
                            },
                            {
                                answer: '2',
                                answer_ref: '6311cc508f3a1'
                            },
                            {
                                answer: '3',
                                answer_ref: '6311cc538f3a2'
                            }
                        ],
                        set_to_current_datetime: false
                    },
                    {
                        max: null,
                        min: null,
                        ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
                        type: 'text',
                        group: [],
                        jumps: [],
                        regex: null,
                        branch: [],
                        verify: false,
                        default: null,
                        is_title: false,
                        question: 'Question to be jumped',
                        uniqueness: 'none',
                        is_required: false,
                        datetime_format: null,
                        possible_answers: [],
                        set_to_current_datetime: false
                    },
                    {
                        max: null,
                        min: null,
                        ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                        type: 'text',
                        group: [],
                        jumps: [],
                        regex: null,
                        branch: [],
                        verify: false,
                        default: null,
                        is_title: false,
                        question: 'Question as jump destination',
                        uniqueness: 'none',
                        is_required: false,
                        datetime_format: null,
                        possible_answers: [],
                        set_to_current_datetime: false
                    }
                ],
                has_location: false
            }
        }
    },
    inputs: {
        '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6312167f8f3a7': {
            data: {
                max: null,
                min: null,
                ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6312167f8f3a7',
                type: 'checkbox',
                group: [],
                jumps: [
                    {
                        to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                        when: 'IS_NOT',
                        answer_ref: '6311cc468f3a0'
                    }
                ],
                regex: null,
                branch: [],
                verify: false,
                default: null,
                is_title: true,
                question: 'Question with jump',
                uniqueness: 'none',
                is_required: false,
                datetime_format: null,
                possible_answers: [
                    {
                        answer: '1',
                        answer_ref: '6311cc468f3a0'
                    },
                    {
                        answer: '2',
                        answer_ref: '6311cc508f3a1'
                    },
                    {
                        answer: '3',
                        answer_ref: '6311cc538f3a2'
                    }
                ],
                set_to_current_datetime: false
            }
        },
        '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399': {
            data: {
                max: null,
                min: null,
                ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
                type: 'text',
                group: [],
                jumps: [],
                regex: null,
                branch: [],
                verify: false,
                default: null,
                is_title: false,
                question: 'Question to be jumped',
                uniqueness: 'none',
                is_required: false,
                datetime_format: null,
                possible_answers: [],
                set_to_current_datetime: false
            }
        },
        '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a': {
            data: {
                max: null,
                min: null,
                ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                type: 'text',
                group: [],
                jumps: [],
                regex: null,
                branch: [],
                verify: false,
                default: null,
                is_title: false,
                question: 'Question as jump destination',
                uniqueness: 'none',
                is_required: false,
                datetime_format: null,
                possible_answers: [],
                set_to_current_datetime: false
            }
        }
    },
    project: {
        forms: [
            '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf'
        ],
        details: {
            ref: '548d97a8ec0d4bdfac131834f331a65d',
            name: 'Jumps unit tests',
            slug: 'jumps-unit-tests',
            access: 'public',
            status: 'active',
            category: 'general',
            logo_url: '',
            visibility: 'hidden',
            description: '',
            small_description: 'Project to write jumps unit tests'
        },
        entries_limits: []
    }
};

const projectData = {
    id: 0,
    name: 'Jumps unit tests',
    slug: 'jumps-unit-tests',
    logo_thumb: null,
    project_ref: '548d97a8ec0d4bdfac131834f331a65d',
    server_url: '',
    json_extra: JSON.stringify(jsonExtra),
    mapping: JSON.stringify([]),
    last_updated: lastUpdated
};

const inputRef = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6312167f8f3a7';
const inputRefDestination = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a';
const endOfFormIndex = Object.entries(jsonExtra.inputs).length;
const entry = {
    entryUuid: '2cf82704-1199-4d68-a55f-f3bec1de983b',
    formRef: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf',
    parentFormRef: '',
    projectRef: '548d97a8ec0d4bdfac131834f331a65d',
    answers: {
        [inputRef]: {
            was_jumped: false,
            answer: [
                '6312167f8f3a8'
            ]
        }
    }
};

const inputDetails = {
    ref: inputRef,
    type: '',//to be set in tests
    jumps: [
        {
            to: inputRefDestination,
            when: 'IS_NOT',
            answer_ref: '6311cc468f3a0'
        }
    ],
    question: 'Question with jump',
    possible_answers: [
        {
            answer: '1',
            answer_ref: '6311cc468f3a0'
        },
        {
            answer: '2',
            answer_ref: '6311cc508f3a1'
        },
        {
            answer: '3',
            answer_ref: '6311cc538f3a2'
        }
    ]
};

const answer = { was_jumped: false, answer: ['6311cc468f3a0'] };
const nextInputIndex = 1;
const nextInputRef = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399';

describe('processJumpsNext (jump when answer IS NOT 1)', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        projectModel.initialise(projectData);
        inputDetails.jumps = [
            {
                to: inputRefDestination,
                when: 'IS_NOT',
                answer_ref: '6311cc468f3a0'
            }
        ];
    });

    //todo: add multiple choice questions
    it(PARAMETERS.QUESTION_TYPES.RADIO + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.RADIO;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 (not jumping)
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2 (jumping to end)
        answer.answer = '6311cc508f3a1';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DROPDOWN + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 (not jumping)
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping to end)
        answer.answer = '6311cc508f3a1';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.CHECKBOX + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 (not jumping)
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3,1 (not jumping)
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3 ( jumping)
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping to end)
        answer.answer = '6311cc508f3a1';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 (not jumping)
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });

        //2 ( jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 ( jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping to end)
        answer.answer = ['6311cc508f3a1'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 (not jumping)
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,1  (not jumping)
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3,1  (not jumping)
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3  (jumping)
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping to end)
        answer.answer = ['6311cc508f3a1'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
});

describe('processJumpsNext (jump when answer IS NOT 2)', () => {

    beforeEach(() => {
        jsonExtra.forms['548d97a8ec0d4bdfac131834f331a65d_6310b618055cf']
            .details.inputs[0].jumps = [
                {
                    to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                    when: 'IS_NOT',
                    answer_ref: '6311cc508f3a1'
                }
            ];
        projectData.json_extra = JSON.stringify(jsonExtra);
        projectModel.initialise(projectData);
        inputDetails.jumps = [
            {
                to: inputRefDestination,
                when: 'IS_NOT',
                answer_ref: '6311cc508f3a1'
            }
        ];
    });

    //todo: add multiple choice questions
    it(PARAMETERS.QUESTION_TYPES.RADIO + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.RADIO;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 jump
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 ( not jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //3 (jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping to end)
        answer.answer = '6311cc538f3a2';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DROPDOWN + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 (jumping)
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (not jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //3 (jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping to end)
        answer.answer = '6311cc538f3a2';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.CHECKBOX + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 (jumping)
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,1 not jumpoing
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //1,3 jumping
        answer.answer = ['6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (not jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //3 (jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping to end)
        answer.answer = ['6311cc538f3a2'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 jumping
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2 (not jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //3 ( jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping to end)
        answer.answer = ['6311cc538f3a2'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1  jumping
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,3,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (not jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //3 (jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (jumping to end)
        answer.answer = ['6311cc538f3a2'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
});

describe('processJumpsNext (jump when answer IS NOT 3)', () => {

    beforeEach(() => {
        jsonExtra.forms['548d97a8ec0d4bdfac131834f331a65d_6310b618055cf']
            .details.inputs[0].jumps = [
                {
                    to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                    when: 'IS_NOT',
                    answer_ref: '6311cc538f3a2'
                }
            ];
        projectData.json_extra = JSON.stringify(jsonExtra);
        projectModel.initialise(projectData);
        inputDetails.jumps = [
            {
                to: inputRefDestination,
                when: 'IS_NOT',
                answer_ref: '6311cc538f3a2'
            }
        ];
    });

    //todo: add multiple choice questions
    it(PARAMETERS.QUESTION_TYPES.RADIO + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.RADIO;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 jump
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 (jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (not jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping to end)
        answer.answer = '6311cc508f3a1';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DROPDOWN + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;
        inputDetails.possible_answers = [
            {
                answer: '1',
                answer_ref: '6311cc468f3a0'
            },
            {
                answer: '2',
                answer_ref: '6311cc508f3a1'
            },
            {
                answer: '3',
                answer_ref: '6311cc538f3a2'
            }
        ];

        //1 ( jumping)
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 ( jumping)
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (not jumping)
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping to end)
        answer.answer = '6311cc508f3a1';
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.CHECKBOX + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1 (jumping)
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,1  jumping
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,3,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2,1 jumping
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2 ( jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (not jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping to end)
        answer.answer = ['6311cc508f3a1'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1  jumping
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2 ( jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (not jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping to end)
        answer.answer = ['6311cc508f3a1'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE + ' ' + PARAMETERS.JUMPS.IS_NOT, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
        entry.answers = {
            [inputRef]: {
                was_jumped: false,
                answer: ['6311cc468f3a0']
            }
        };

        //1  jumping
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,1  jumping
        answer.answer = ['6311cc508f3a1', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //2,3,1 not jumping
        answer.answer = ['6311cc508f3a1', '6311cc538f3a2', '6311cc468f3a0'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 ( jumping)
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
        //3 (not jumping)
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399',
            next_input_index: 1
        });
        //2 (jumping to end)
        answer.answer = ['6311cc508f3a1'];
        inputDetails.jumps[0].to = PARAMETERS.JUMPS.END_OF_FORM;
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: null,
            next_input_index: endOfFormIndex
        });
    });
});

