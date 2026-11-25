import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { reactive } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import QuestionText from '@/components/questions/QuestionText.vue';
import QuestionTextarea from '@/components/questions/QuestionTextarea.vue';
import QuestionPhone from '@/components/questions/QuestionPhone.vue';
import QuestionInteger from '@/components/questions/QuestionInteger.vue';
import QuestionDecimal from '@/components/questions/QuestionDecimal.vue';
import QuestionDate from '@/components/questions/QuestionDate.vue';
import QuestionTime from '@/components/questions/QuestionTime.vue';
import QuestionRadio from '@/components/questions/QuestionRadio.vue';
import QuestionDropdown from '@/components/questions/QuestionDropdown.vue';
import QuestionCheckbox from '@/components/questions/QuestionCheckbox.vue';
import QuestionSearch from '@/components/questions/QuestionSearch.vue';
import QuestionBarcode from '@/components/questions/QuestionBarcode.vue';
import QuestionLocation from '@/components/questions/QuestionLocation.vue';
import QuestionGroup from '@/components/questions/QuestionGroup.vue';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model.js';

//every question component renders its validation error in a .question-error
//container, wired to the shared entriesAddState.error object by reference.
//These specs mount each component with an error present and assert the message
//is visible, and hidden when there is none, for every question type.

//the real service pulls from the project model, which does not exist in unit
//tests: wire the shared state exactly as the real setUpInputParams does
vi.mock('@/services/entry/question-common-service', () => ({
    questionCommonService: {
        setUpInputParams: vi.fn((state, inputRef, entriesAddState) => {
            state.inputDetails = entriesAddState.inputDetails;
            state.currentInputRef = inputRef;
            state.error = entriesAddState.error;
            state.required = !!entriesAddState.inputDetails?.is_required;
            state.question = entriesAddState.inputDetails?.question;
            state.pattern = entriesAddState.inputDetails?.regex ?? null;
            state.answer = entriesAddState.answers[inputRef];
            state.confirmAnswer = entriesAddState.confirmAnswer[inputRef];
        })
    }
}));

vi.mock('@/models/project-model.js', () => ({
    projectModel: {
        getProjectRef: vi.fn(() => 'p1'),
        getGroupInputs: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(() => Promise.resolve()),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/utilities/location-cordova-service', () => ({
    locationService: {
        getWatchTimeout: vi.fn(() => PARAMETERS.DEFAULT_TIMEOUT)
    }
}));

vi.mock('@/use/questions/popover-location-handler', () => ({
    popoverLocationHandler: vi.fn()
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

//child components are stubbed: the .question-error lives in each question
//component's own template (or in the platform variant for location/barcode),
//so the children only need to resolve. grid-question-* render their content
//slot, where dropdown nests its error container
const STUBS = {
    QuestionLabelAction: { template: '<div><slot /></div>' },
    QuestionLabelPossibleAnswers: { template: '<div><slot /></div>' },
    ListPossibleAnswersRadio: { template: '<div><slot /></div>' },
    ListPossibleAnswersCheckbox: { template: '<div><slot /></div>' },
    GridQuestionWide: { template: '<div><slot name="content" /></div>' },
    GridQuestionNarrow: { template: '<div><slot name="content" /></div>' },
    DateTimeField: true
};

const REF = 'input_ref';
const MESSAGE = 'This is a required question';
const STRING_ANSWER = { answer: '', was_jumped: false };
const ARRAY_ANSWER = { answer: [], was_jumped: false };
const LOCATION_ANSWER = { answer: {}, was_jumped: false };

const INPUT_DETAILS = {
    ref: REF,
    is_required: true,
    regex: null,
    min: '',
    max: '',
    question: 'Q?',
    datetime_format: PARAMETERS.DATE_FORMAT_1,
    set_to_current_datetime: false,
    possible_answers: []
};

//one case per question type; searchsingle/searchmultiple share QuestionSearch
const CASES = [
    { name: 'text', Component: QuestionText, props: { type: 'text' }, answer: STRING_ANSWER },
    { name: 'textarea', Component: QuestionTextarea, props: { type: 'textarea', isGroupInput: false }, answer: STRING_ANSWER },
    { name: 'phone', Component: QuestionPhone, props: { type: 'phone' }, answer: STRING_ANSWER },
    { name: 'integer', Component: QuestionInteger, props: { type: 'integer' }, answer: STRING_ANSWER },
    { name: 'decimal', Component: QuestionDecimal, props: { type: 'decimal' }, answer: STRING_ANSWER },
    { name: 'date', Component: QuestionDate, props: { type: 'date' }, answer: STRING_ANSWER },
    { name: 'time', Component: QuestionTime, props: { type: 'time' }, answer: STRING_ANSWER },
    { name: 'radio', Component: QuestionRadio, props: { type: 'radio' }, answer: STRING_ANSWER },
    { name: 'dropdown', Component: QuestionDropdown, props: { type: 'dropdown' }, answer: STRING_ANSWER },
    { name: 'checkbox', Component: QuestionCheckbox, props: { type: 'checkbox' }, answer: ARRAY_ANSWER },
    { name: 'searchsingle', Component: QuestionSearch, props: { type: 'searchsingle' }, answer: ARRAY_ANSWER },
    { name: 'searchmultiple', Component: QuestionSearch, props: { type: 'searchmultiple' }, answer: ARRAY_ANSWER },
    { name: 'barcode', Component: QuestionBarcode, props: { type: 'barcode' }, answer: STRING_ANSWER },
    { name: 'location', Component: QuestionLocation, props: { type: 'location', isGroupInput: false }, answer: LOCATION_ANSWER }
];

function mountQuestion(Component, props, { message, answer, isBranch = false }) {
    const entriesAddState = reactive({
        error: message ? { errors: { [REF]: { message } } } : { errors: {} },
        answers: { [REF]: answer },
        confirmAnswer: { [REF]: { verify: false, answer: '' } },
        inputDetails: INPUT_DETAILS,
        questionParams: { isBranch, currentInputRef: REF }
    });

    return mount(Component, {
        props: { inputRef: REF, ...props },
        global: {
            provide: { entriesAddState },
            stubs: STUBS
        }
    });
}

function errorTexts(wrapper) {
    return wrapper.findAll('.question-error').map((node) => node.text());
}

describe('the question error is shown in its .question-error container', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.isPWA = false;
    });

    it.each(CASES)('$name shows the message when there is an error', ({ Component, props, answer }) => {
        const wrapper = mountQuestion(Component, props, { message: MESSAGE, answer });
        expect(errorTexts(wrapper)).toContain(MESSAGE);
    });

    it.each(CASES)('$name hides the container when there is no error', ({ Component, props, answer }) => {
        const wrapper = mountQuestion(Component, props, { message: '', answer });
        expect(errorTexts(wrapper)).toHaveLength(0);
    });
});

describe('a question nested in a group', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.isPWA = false;
        rootStore.entriesAddScope = {
            entryService: { form: { formRef: 'form-1' } }
        };
        //the group banner string arrives from the server at init
        STRINGS.en.status_codes = { ec5_128: 'The group has errors' };
    });

    //every question type is also nested in a group: the group renders each
    //child through the same component, so the container must render there too
    function mountGroup(props, answer, message) {
        //getGroupInputs returns input descriptors (ref + type), unlike
        //getFormGroups which returns refs
        projectModel.getGroupInputs.mockReturnValue([
            { ref: 'child_ref', type: props.type, verify: false }
        ]);

        const entriesAddState = reactive({
            error: message ? { errors: { child_ref: { message } } } : { errors: {} },
            answers: {
                group_ref: { answer: '', was_jumped: false },
                child_ref: answer
            },
            confirmAnswer: {
                group_ref: { verify: false, answer: '' },
                child_ref: { verify: false, answer: '' }
            },
            inputsExtra: {
                child_ref: { data: { ...INPUT_DETAILS, ref: 'child_ref', type: props.type } }
            },
            inputDetails: { ...INPUT_DETAILS, ref: 'group_ref', type: 'group' },
            questionParams: { isBranch: false, currentInputRef: 'group_ref' }
        });

        return mount(QuestionGroup, {
            props: {
                inputRef: 'group_ref',
                type: 'group',
                parentEntryName: 'Parent',
                currentFormName: 'Form'
            },
            global: {
                provide: { entriesAddState },
                stubs: STUBS
            }
        });
    }

    it.each(CASES)('a $name child shows the message and the group banner', ({ props, answer }) => {
        const wrapper = mountGroup(props, answer, MESSAGE);
        expect(errorTexts(wrapper)).toContain(MESSAGE);
        expect(wrapper.text()).toContain('The group has errors');
    });

    it('shows neither the child error nor the banner when there is no error', () => {
        const textProps = CASES[0].props;
        const wrapper = mountGroup(textProps, CASES[0].answer, '');
        expect(errorTexts(wrapper)).toHaveLength(0);
        expect(wrapper.text()).not.toContain('The group has errors');
    });
});

describe('a question nested in a branch entry', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.isPWA = false;
    });

    //a branch entry edits the same question components with questionParams
    //isBranch true: the container must render there too, for every type
    it.each(CASES)('$name shows the message when isBranch', ({ Component, props, answer }) => {
        const wrapper = mountQuestion(Component, props, { message: MESSAGE, answer, isBranch: true });
        expect(errorTexts(wrapper)).toContain(MESSAGE);
    });

    it.each(CASES)('$name hides the container when isBranch and there is no error', ({ Component, props, answer }) => {
        const wrapper = mountQuestion(Component, props, { message: '', answer, isBranch: true });
        expect(errorTexts(wrapper)).toHaveLength(0);
    });
});
