import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { setActivePinia, createPinia } from 'pinia';
import { answerService } from '@/services/entry/answer-service';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';

//mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

const dateFormats = [
    PARAMETERS.DATE_FORMAT_1,
    PARAMETERS.DATE_FORMAT_2,
    PARAMETERS.DATE_FORMAT_3,
    PARAMETERS.DATE_FORMAT_4,
    PARAMETERS.DATE_FORMAT_5
];

const timeFormats = [
    PARAMETERS.TIME_FORMAT_1,
    PARAMETERS.TIME_FORMAT_2,
    PARAMETERS.TIME_FORMAT_3,
    PARAMETERS.TIME_FORMAT_4,
    PARAMETERS.TIME_FORMAT_5
];

function faker (type) {

    const formRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be';
    const answers = {};
    const inputs = [];
    const inputList = {};
    for (let i = 0; i < 3; i++) {
        const uniqID = utilsService.generateUniqID();
        const inputRef = formRef + '_' + uniqID;
        answers[inputRef] = {};
        inputList[inputRef] = {
            data: {
                ref: inputRef,
                type,
                group: [],
                is_title: true,
                possible_answers: []
            }
        };

        switch (type) {
            case PARAMETERS.QUESTION_TYPES.DATE:
                answers[inputRef].answer = '2022-08-20T00:00:00.000';
                inputList[inputRef].data.datetime_format = dateFormats[i];
                break;
            case PARAMETERS.QUESTION_TYPES.TIME:
                answers[inputRef].answer = '2022-08-20T18:45:58.000';
                inputList[inputRef].data.datetime_format = timeFormats[i];
                break;
            case PARAMETERS.QUESTION_TYPES.RADIO:
            case PARAMETERS.QUESTION_TYPES.DROPDOWN:
                inputList[inputRef].data.possible_answers = [
                    {
                        answer: '1',
                        answer_ref: '6304d60d7ea6e'
                    },
                    {
                        answer: '2',
                        answer_ref: '6304d6167ea6f'
                    },
                    {
                        answer: '3',
                        answer_ref: '6304d6197ea70'
                    }
                ];
                answers[inputRef].answer = inputList[inputRef].data
                    .possible_answers[i].answer_ref;
                break;
            case PARAMETERS.QUESTION_TYPES.CHECKBOX:
            case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
            case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE:
                inputList[inputRef].data.possible_answers = [
                    {
                        answer: '1',
                        answer_ref: '6304d60d7ea6e'
                    },
                    {
                        answer: '2',
                        answer_ref: '6304d6167ea6f'
                    },
                    {
                        answer: '3',
                        answer_ref: '6304d6197ea70'
                    }
                ];
                answers[inputRef].answer = [inputList[inputRef].data
                    .possible_answers[i].answer_ref];
                break;
            default:
                answers[inputRef].answer = 'Title ' + i;
        }

        answers[inputRef].was_jumped = false;
        inputs.push(inputRef);
    }

    return {
        entry: { answers },
        inputs,
        group: [],
        inputList
    };
}

function fakerGroup (type) {

    const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_6304d8d87ea71';
    const answers = {
        [inputRef]: {
            'was_jumped': false,
            'answer': ''
        }
    };
    const inputs = [
        inputRef
    ];

    const group = {};
    group[inputRef] = [];

    const inputList = {
        [inputRef]: {
            data: {
                ref: inputRef,
                type: 'group',
                is_title: false,
                question: 'A Group'
            }
        }
    };

    for (let i = 0; i < 3; i++) {
        const uniqID = utilsService.generateUniqID();
        const groupInputRef = inputRef + '_' + uniqID;
        answers[groupInputRef] = {};
        group[inputRef].push(groupInputRef);

        inputList[groupInputRef] = {
            data: {
                ref: groupInputRef,
                type,
                is_title: true,
                question: 'Name'
            }
        };

        switch (type) {
            case PARAMETERS.QUESTION_TYPES.DATE:
                answers[groupInputRef].answer = '2022-08-20T00:00:00.000';
                inputList[groupInputRef].data.datetime_format = dateFormats[i];
                break;
            case PARAMETERS.QUESTION_TYPES.TIME:
                answers[groupInputRef].answer = '2022-08-20T18:45:58.000';
                inputList[groupInputRef].data.datetime_format = timeFormats[i];
                break;
            case PARAMETERS.QUESTION_TYPES.RADIO:
            case PARAMETERS.QUESTION_TYPES.DROPDOWN:
                inputList[groupInputRef].data.possible_answers = [
                    {
                        answer: '1',
                        answer_ref: '6304d60d7ea6e'
                    },
                    {
                        answer: '2',
                        answer_ref: '6304d6167ea6f'
                    },
                    {
                        answer: '3',
                        answer_ref: '6304d6197ea70'
                    }
                ];
                answers[groupInputRef].answer = inputList[groupInputRef].data
                    .possible_answers[i].answer_ref;
                break;
            case PARAMETERS.QUESTION_TYPES.CHECKBOX:
            case PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE:
            case PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE:
                inputList[groupInputRef].data.possible_answers = [
                    {
                        answer: '1',
                        answer_ref: '6304d60d7ea6e'
                    },
                    {
                        answer: '2',
                        answer_ref: '6304d6167ea6f'
                    },
                    {
                        answer: '3',
                        answer_ref: '6304d6197ea70'
                    }
                ];
                answers[groupInputRef].answer = [inputList[groupInputRef].data
                    .possible_answers[i].answer_ref];
                break;
            default:
                answers[groupInputRef].answer = 'Title ' + i;

        }
    }

    return {
        entry: { answers },
        inputs,
        group,
        inputList
    };

}

describe('getAnswersTitles', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it(PARAMETERS.QUESTION_TYPES.TEXT, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.TEXT);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    it(PARAMETERS.QUESTION_TYPES.INTEGER, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.INTEGER);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    it(PARAMETERS.QUESTION_TYPES.DECIMAL, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.DECIMAL);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    it(PARAMETERS.QUESTION_TYPES.PHONE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.PHONE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    it(PARAMETERS.QUESTION_TYPES.DATE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.DATE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['20/08/2022', '08/20/2022', '2022/08/20']);
    });

    it(PARAMETERS.QUESTION_TYPES.TIME, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.TIME);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['18:45:58', '06:45:58 PM', '18:45']);
    });

    it(PARAMETERS.QUESTION_TYPES.RADIO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.RADIO);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    it(PARAMETERS.QUESTION_TYPES.DROPDOWN, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.DROPDOWN);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    it(PARAMETERS.QUESTION_TYPES.CHECKBOX, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.CHECKBOX);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = faker(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    it(PARAMETERS.QUESTION_TYPES.TEXTAREA, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.TEXTAREA);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    it(PARAMETERS.QUESTION_TYPES.BARCODE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';

        const fake = faker(PARAMETERS.QUESTION_TYPES.BARCODE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, [], fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    //group with 3 text questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.QUESTION_TYPES.TEXT, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = fakerGroup(PARAMETERS.QUESTION_TYPES.TEXT);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['Title 0', 'Title 1', 'Title 2']);
    });

    //group with 3 date questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.QUESTION_TYPES.DATE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = fakerGroup(PARAMETERS.QUESTION_TYPES.DATE);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['20/08/2022', '08/20/2022', '2022/08/20']);
    });

    //group with 3 time questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.QUESTION_TYPES.TIME, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        const fake = fakerGroup(PARAMETERS.QUESTION_TYPES.TIME);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['18:45:58', '06:45:58 PM', '18:45']);
    });

    //group with 3 radio (dropdown) questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.QUESTION_TYPES.RADIO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        let fake = fakerGroup(PARAMETERS.QUESTION_TYPES.RADIO);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['1', '2', '3']);

        fake = fakerGroup(PARAMETERS.QUESTION_TYPES.DROPDOWN);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });

    //group with 3 checkbox (search) questions
    it(PARAMETERS.QUESTION_TYPES.GROUP + ' ' + PARAMETERS.QUESTION_TYPES.CHECKBOX, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        let fake = fakerGroup(PARAMETERS.QUESTION_TYPES.CHECKBOX);

        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['1', '2', '3']);

        fake = fakerGroup(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE);
        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['1', '2', '3']);

        fake = fakerGroup(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE);
        expect(answerService.getAnswersTitles(fake.entry, fake.inputs, fake.group, fake.inputList, null))
            .toMatchObject(['1', '2', '3']);
    });
});