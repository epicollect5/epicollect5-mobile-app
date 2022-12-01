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

const projectData = {
    id: 0,
    name: 'Jumps unit tests',
    slug: 'jumps-unit-tests',
    logo_thumb: null,
    project_ref: '548d97a8ec0d4bdfac131834f331a65d',
    server_url: '',
    json_extra: JSON.stringify({
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
                    '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6b88f398',
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
                            ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6b88f398',
                            type: 'text',
                            group: [],
                            jumps: [
                                {
                                    to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                                    when: 'ALL',
                                    answer_ref: null
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
                            possible_answers: [],
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
            '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6b88f398': {
                data: {
                    max: null,
                    min: null,
                    ref: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6b88f398',
                    type: 'text',
                    group: [],
                    jumps: [
                        {
                            to: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a',
                            when: 'ALL',
                            answer_ref: null
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
                    possible_answers: [],
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
    }),
    mapping: JSON.stringify([]),
    last_updated: lastUpdated
};

const inputRef = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6b88f398';
const inputRefDestination = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c78f39a';

const entry = {
    entryUuid: '768f55ef-2982-4fa2-ae9d-2a81c98cf51f',
    formRef: '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf',
    projectRef: '548d97a8ec0d4bdfac131834f331a65d',
    answers: {
        [inputRef]: {
            was_jumped: false,
            answer: 'A text answer'
        }
    }
};

const inputDetails = {
    ref: inputRef,
    type: '',//to be set in tests
    jumps: [
        {
            to: inputRefDestination,
            when: 'ALL',
            answer_ref: null
        }
    ],
    question: 'Question with jump',
    possible_answers: []
};

const answer = { was_jumped: false, answer: 'A text answer' };
const nextInputIndex = 1;
const nextInputRef = '548d97a8ec0d4bdfac131834f331a65d_6310b618055cf_6310b6c18f399';

describe('processJumpsNext', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        projectModel.initialise(projectData);
    });


    it(PARAMETERS.QUESTION_TYPES.TEXT + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.TEXT;

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.INTEGER + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.INTEGER;
        answer.answer = 7;

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DECIMAL + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.DECIMAL;
        answer.answer = 8.125;

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.PHONE + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.PHONE;
        answer.answer = '07896756453';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DATE + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.DATE;
        answer.answer = '2022-08-12T00:00:00.000';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.TIME + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.TIME;
        answer.answer = '2022-08-12T13:45:12.000';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.TEXTAREA + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.TEXTAREA;
        answer.answer = 'SA long text answer...';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.README + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.README;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.PHOTO + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.PHOTO;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.AUDIO + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.AUDIO;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.VIDEO + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.VIDEO;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.LOCATION + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.LOCATION;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.BARCODE + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.BARCODE;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.BRANCH + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.BRANCH;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.GROUP;
        answer.answer = '';

        const result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });

    //todo: add multiple choice questions
    it(PARAMETERS.QUESTION_TYPES.RADIO + ' ' + PARAMETERS.JUMPS.ALL, () => {

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

        //1
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //3
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.DROPDOWN + ' ' + PARAMETERS.JUMPS.ALL, () => {

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

        //1
        answer.answer = '6311cc468f3a0';
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2
        answer.answer = '6311cc508f3a1';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //3
        answer.answer = '6311cc538f3a2';
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.CHECKBOX + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
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

        //1
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //1,2
        answer.answer = ['6311cc468f3a0', '6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //1,2,3
        answer.answer = ['6311cc468f3a0', '6311cc508f3a1', '6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
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

        //1
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //2
        answer.answer = ['6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //3
        answer.answer = ['6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE + ' ' + PARAMETERS.JUMPS.ALL, () => {

        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
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

        //1
        answer.answer = ['6311cc468f3a0'];
        let result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //1,2
        answer.answer = ['6311cc468f3a0', '6311cc508f3a1'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });

        //1,2,3
        answer.answer = ['6311cc468f3a0', '6311cc508f3a1', '6311cc538f3a2'];
        result = jumpsService.processJumpsNext(entry, answer, inputDetails, nextInputIndex, nextInputRef);
        expect(result).toMatchObject({
            next_input_ref: inputRefDestination,
            next_input_index: 2
        });
    });
});