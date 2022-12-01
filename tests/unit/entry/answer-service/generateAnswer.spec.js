import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model';
import { setActivePinia, createPinia } from 'pinia';
import { answerService } from '@/services/entry/answer-service';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';



//mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getExtraInputs = vi.fn();
    projectModel.getFormGroups = vi.fn();
    return { projectModel };
});

const entry = {
    entryUuid: '0811d417-2a64-43f4-9670-844efc6ca8f2',
    parentEntryUuid: '',
    isRemote: 0,
    synced: 2,
    canEdit: 1,
    createdAt: '',
    title: '',
    formRef: '70dcdb0b606843989674d3851c544f23_62fa24c5161be',
    parentFormRef: '',
    projectRef: '70dcdb0b606843989674d3851c544f23',
    branchEntries: {},
    media: {},
    uniqueAnswers: {},
    syncedError: '',
    isBranch: false,
    verifyAnswers: {},
    answers: {}
};

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630359fca637c';
const inputsExtra = {
    [inputRef]: {
        data: {
            max: null,
            min: null,
            ref: inputRef,
            type: 'text',
            group: [],
            jumps: [],
            regex: null,
            branch: [],
            verify: false,
            default: null,
            is_title: true,
            question: 'Name',
            uniqueness: 'none',
            is_required: true,
            datetime_format: null,
            possible_answers: [],
            set_to_current_datetime: false
        }
    }
};


describe('generateAnswer', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        entry.answers = {};
        inputsExtra[inputRef].data.default = '';
    });

    it(PARAMETERS.QUESTION_TYPES.TEXT, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.TEXT;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = 'Mirko';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: 'Mirko',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.INTEGER, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.INTEGER;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '5';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '5',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.DECIMAL, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.DECIMAL;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '0.0005';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '0.0005',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.PHONE, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.PHONE;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '0754676789';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '0754676789',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.DATE, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.DATE;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });
    it(PARAMETERS.QUESTION_TYPES.TIME, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.TIME;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.RADIO, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.RADIO;
        inputsExtra[inputRef].data.possible_answers = [
            {
                answer: '1',
                answer_ref: '6303947f7ea60'
            },
            {
                answer: '2',
                answer_ref: '630394857ea61'
            }
        ];

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '6303947f7ea60';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '6303947f7ea60',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.DROPDOWN, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;
        inputsExtra[inputRef].data.possible_answers = [
            {
                answer: '1',
                answer_ref: '6303947f7ea60'
            },
            {
                answer: '2',
                answer_ref: '630394857ea61'
            }
        ];

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '6303947f7ea60';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '6303947f7ea60',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.CHECKBOX, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
        inputsExtra[inputRef].data.possible_answers = [
            {
                answer: '1',
                answer_ref: '6303947f7ea60'
            },
            {
                answer: '2',
                answer_ref: '630394857ea61'
            }
        ];

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: [],
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '6303947f7ea60';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: ['6303947f7ea60'],
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
        inputsExtra[inputRef].data.possible_answers = [
            {
                answer: '1',
                answer_ref: '6303947f7ea60'
            },
            {
                answer: '2',
                answer_ref: '630394857ea61'
            }
        ];

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: [],
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '6303947f7ea60';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: ['6303947f7ea60'],
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
        inputsExtra[inputRef].data.possible_answers = [
            {
                answer: '1',
                answer_ref: '6303947f7ea60'
            },
            {
                answer: '2',
                answer_ref: '630394857ea61'
            }
        ];

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: [],
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '6303947f7ea60';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: ['6303947f7ea60'],
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.TEXTAREA, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.TEXTAREA;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = 'Mirko';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: 'Mirko',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.PHOTO, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.PHOTO;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.AUDIO, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.AUDIO;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.VIDEO, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.VIDEO;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.LOCATION, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.LOCATION;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        const answers = {
            [inputRef]: {
                answer: {
                    latitude: '',
                    longitude: '',
                    accuracy: ''
                },
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    it(PARAMETERS.QUESTION_TYPES.BARCODE, () => {

        inputsExtra[inputRef].data.type = PARAMETERS.QUESTION_TYPES.BARCODE;

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        let answers = {
            [inputRef]: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);

        //with default
        inputsExtra[inputRef].data.default = '9900OOp';
        projectModel.getExtraInputs.mockReturnValue(inputsExtra);
        answers = {
            [inputRef]: {
                answer: '9900OOp',
                was_jumped: false
            }
        };

        answerService.generateAnswer(entry, inputRef);
        expect(entry.answers).toMatchObject(answers);
    });

    //testing a group with 2 group questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' (2 group questions)', () => {

        const groupInputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62';
        const groupInputExtra = {
            [groupInputRef]: {
                data: {
                    max: null,
                    min: null,
                    ref: '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62',
                    type: 'group',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'A group',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            [groupInputRef + '_630396f47ea63']: {
                data: {
                    max: null,
                    min: null,
                    ref: '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62_630396f47ea63',
                    type: 'text',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Name',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            [groupInputRef + '_630396f77ea64']: {
                data: {
                    max: '',
                    min: '',
                    ref: '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62_630396f77ea64',
                    type: 'integer',
                    group: [],
                    jumps: [],
                    regex: '',
                    branch: [],
                    verify: false,
                    default: '',
                    is_title: false,
                    question: 'Age',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            }
        };

        const group = {
            '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62': [
                '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62_630396f47ea63',
                '70dcdb0b606843989674d3851c544f23_62fa24c5161be_630396ec7ea62_630396f77ea64'
            ]
        };

        //empty answer
        projectModel.getExtraInputs.mockReturnValue(groupInputExtra);
        projectModel.getFormGroups.mockReturnValue(group);
        const answers = {
            [groupInputRef]: {
                answer: '',
                was_jumped: false
            },
            [groupInputRef + '_630396f47ea63']: {
                answer: '',
                was_jumped: false
            },
            [groupInputRef + '_630396f77ea64']: {
                answer: '',
                was_jumped: false
            }
        };
        answerService.generateAnswer(entry, groupInputRef);
        expect(entry.answers).toMatchObject(answers);
    });
});