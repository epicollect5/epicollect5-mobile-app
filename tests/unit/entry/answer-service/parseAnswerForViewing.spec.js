import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { setActivePinia, createPinia } from 'pinia';
//import { errorsService } from '@/services/errors-service';
import { answerService } from '@/services/entry/answer-service';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';

//mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

const inputRef = '70dcdb0b606843989674d3851c544f23_62fa24c5161be_62ff9ff960683';
const inputDetails = {
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
    is_title: false,
    question: 'Name ?',
    uniqueness: 'none',
    is_required: false,
    datetime_format: null,
    possible_answers: [],
    set_to_current_datetime: false
};


describe('parseAnswerForViewing', () => {

    let answer = '';

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it(PARAMETERS.QUESTION_TYPES.TEXT, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.TEXT;
        answer = 'Mirko';

        expect(answerService.parseAnswerForViewing(inputDetails, answer)).toEqual('Mirko');
    });
    it(PARAMETERS.QUESTION_TYPES.INTEGER, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.INTEGER;
        answer = '45';

        expect(answerService.parseAnswerForViewing(inputDetails, answer)).toEqual('45');
    });
    it(PARAMETERS.QUESTION_TYPES.DECIMAL, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.DECIMAL;
        answer = '4.5';

        expect(answerService.parseAnswerForViewing(inputDetails, answer)).toEqual('4.5');
    });
    it(PARAMETERS.QUESTION_TYPES.PHONE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.PHONE;
        answer = '0078924774327243';

        expect(answerService.parseAnswerForViewing(inputDetails, answer)).toEqual('0078924774327243');
    });

    it(PARAMETERS.QUESTION_TYPES.DATE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.DATE;
        answer = '2022-08-17T00:00:00.000';
        //dd/MM/YYYY
        inputDetails.datetime_format = PARAMETERS.DATE_FORMAT_1;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('17/08/2022');

        //MM/dd/YYYY
        inputDetails.datetime_format = PARAMETERS.DATE_FORMAT_2;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08/17/2022');

        //YYYY/MM/dd
        inputDetails.datetime_format = PARAMETERS.DATE_FORMAT_3;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('2022/08/17');

        //MM/YYYY
        inputDetails.datetime_format = PARAMETERS.DATE_FORMAT_4;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08/2022');

        //dd/MM/
        inputDetails.datetime_format = PARAMETERS.DATE_FORMAT_5;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('17/08');

    });

    it(PARAMETERS.QUESTION_TYPES.TIME, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.TIME;
        answer = '2022-08-17T16:31:47.000';
        //HH:mm:ss      
        inputDetails.datetime_format = PARAMETERS.TIME_FORMAT_1;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('16:31:47');

        //hh:mm:ss
        inputDetails.datetime_format = PARAMETERS.TIME_FORMAT_2;
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('04:31:47 PM');
        answer = '2022-08-17T08:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08:31:47 AM');

        //HH:mm
        inputDetails.datetime_format = PARAMETERS.TIME_FORMAT_3;
        answer = '2022-08-17T08:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08:31');
        answer = '2022-08-17T20:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('20:31');

        //hh:mm
        inputDetails.datetime_format = PARAMETERS.TIME_FORMAT_4;
        answer = '2022-08-17T08:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08:31 AM');
        answer = '2022-08-17T20:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('08:31 PM');

        // mm:ss
        inputDetails.datetime_format = PARAMETERS.TIME_FORMAT_5;
        answer = '2022-08-17T20:31:47.000';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('31:47');
    });

    it(PARAMETERS.QUESTION_TYPES.DROPDOWN, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.DROPDOWN;
        inputDetails.possible_answers = [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ];
        answer = '62fcfbfba1b1b';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One');
        answer = '62fcfc03a1b1c';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Two');
        answer = '62fcfc2ba1b1d';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Three');
    });

    it(PARAMETERS.QUESTION_TYPES.RADIO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.RADIO;
        inputDetails.possible_answers = [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ];
        answer = '62fcfbfba1b1b';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One');
        answer = '62fcfc03a1b1c';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Two');
        answer = '62fcfc2ba1b1d';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Three');
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE;
        inputDetails.possible_answers = [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ];
        answer = ['62fcfbfba1b1b'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One');
        answer = ['62fcfc03a1b1c'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Two');
        answer = ['62fcfc2ba1b1d'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Three');
    });

    it(PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.SEARCH_MULTIPLE;
        inputDetails.possible_answers = [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ];
        answer = ['62fcfbfba1b1b'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One');
        answer = ['62fcfbfba1b1b', '62fcfc03a1b1c'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One, Two');
        answer = ['62fcfbfba1b1b', '62fcfc03a1b1c', '62fcfc2ba1b1d'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One, Two, Three');
    });

    it(PARAMETERS.QUESTION_TYPES.CHECKBOX, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.CHECKBOX;
        inputDetails.possible_answers = [
            {
                answer: 'One',
                answer_ref: '62fcfbfba1b1b'
            },
            {
                answer: 'Two',
                answer_ref: '62fcfc03a1b1c'
            },
            {
                answer: 'Three',
                answer_ref: '62fcfc2ba1b1d'
            }
        ];
        answer = ['62fcfbfba1b1b'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One');
        answer = ['62fcfbfba1b1b', '62fcfc03a1b1c'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One, Two');
        answer = ['62fcfbfba1b1b', '62fcfc03a1b1c', '62fcfc2ba1b1d'];
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('One, Two, Three');
    });
    it(PARAMETERS.QUESTION_TYPES.BARCODE, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.BARCODE;
        answer = 'ID001OP';

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('ID001OP');
    });
    it(PARAMETERS.QUESTION_TYPES.TEXTAREA, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.TEXTAREA;
        answer = 'Far far away, behind the word mountains,';

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('Far far away, behind the word mountains,');
    });
    it(PARAMETERS.QUESTION_TYPES.LOCATION, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.LOCATION;
        answer = {
            latitude: '45.900967',
            longitude: '12.004856',
            accuracy: 8
        };

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toMatchObject(answer);
    });
    it(PARAMETERS.QUESTION_TYPES.AUDIO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.AUDIO;
        answer = '451dfd6b-df1d-ff98-869d-a54e49880da5_1499877699.mp4';

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(STRINGS[rootStore.language].labels.file_available);

        answer = '';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(' ');
    });
    it(PARAMETERS.QUESTION_TYPES.PHOTO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.PHOTO;
        answer = '451dfd6b-df1d-ff98-869d-a54e49880da5_1499877699.jpg';

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(STRINGS[rootStore.language].labels.file_available);

        answer = '';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(' ');
    });
    it(PARAMETERS.QUESTION_TYPES.VIDEO, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.VIDEO;
        answer = '451dfd6b-df1d-ff98-869d-a54e49880da5_1499877699.mp4';

        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(STRINGS[rootStore.language].labels.file_available);

        answer = '';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual(' ');
    });
    it(PARAMETERS.QUESTION_TYPES.BRANCH, () => {

        const rootStore = useRootStore();
        rootStore.language = 'en';
        inputDetails.type = PARAMETERS.QUESTION_TYPES.BRANCH;

        answer = { [inputRef]: 8 };
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('8 ' + STRINGS[rootStore.language].labels.entries);

        answer = { [inputRef]: 150 };
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('150 ' + STRINGS[rootStore.language].labels.entries);

        answer = '';
        expect(answerService.parseAnswerForViewing(inputDetails, answer))
            .toEqual('0 ' + STRINGS[rootStore.language].labels.entries);
    });
});