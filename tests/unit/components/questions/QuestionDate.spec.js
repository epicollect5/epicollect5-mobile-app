import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import QuestionDate from '@/components/questions/QuestionDate.vue';
import GridQuestionNarrow from '@/components/GridQuestionNarrow.vue';
import { questionCommonService } from '@/services/entry/question-common-service';
import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';

vi.mock('@/services/entry/question-common-service', () => {
	const questionCommonService = {
		setUpInputParams: vi.fn()
	};
	return { questionCommonService };
});

vi.mock('@/services/utilities/utils-service', () => {
	const utilsService = {
		getUserFormattedDate: vi.fn(() => ''),
		getInputFormattedDate: vi.fn(() => ''),
		getISODateOnly: vi.fn(() => ''),
		toISOStringLocale: vi.fn(() => ''),
		hasQuestionError: vi.fn(() => false)
	};
	return { utilsService };
});

const ION_STUBS = {
	'ion-card': true,
	'ion-card-header': true,
	'ion-card-title': true,
	'ion-card-subtitle': true,
	'ion-card-content': true,
	'ion-chip': true,
	'ion-icon': true,
	'ion-label': true,
	'ion-grid': true,
	'ion-row': true,
	'ion-col': true
};

describe('QuestionDate.vue - native date field', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	const factory = (props = {}) => {
		return mount(QuestionDate, {
			props: {
				inputRef: 'test_ref',
				type: 'date',
				...props
			},
			provide: {
				entriesAddState: {}
			},
			global: {
				stubs: {
					...ION_STUBS,
					'date-time-field': {
						name: 'DateTimeField',
						template: '<div class="date-time-field-stub"></div>',
						props: ['type', 'answer', 'datetimeFormat', 'min', 'max', 'locale', 'hasError']
					}
				}
			}
		});
	};

	it('renders the shared date-time-field', () => {
		const wrapper = factory();
		expect(wrapper.findComponent({ name: 'DateTimeField' }).exists()).toBe(true);
	});

	it('passes answer and datetime-format to the shared field', () => {
		const wrapper = factory();
		const field = wrapper.findComponent({ name: 'DateTimeField' });
		expect(field.exists()).toBe(true);
		expect(field.props('type')).toBe('date');
	});

	it('forwards the question error state to the shared field', () => {
		utilsService.hasQuestionError.mockReturnValueOnce(true);
		const wrapper = factory();
		expect(wrapper.findComponent({ name: 'DateTimeField' }).props('hasError')).toBe(true);
	});

	it('updates the answer on change', async () => {
		const wrapper = factory();
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('change', '2026-10-09T00:00:00.000');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('2026-10-09T00:00:00.000');
	});

	it('clears the answer on clear', async () => {
		const wrapper = factory();
		wrapper.vm.state.answer.answer = '2026-10-09T00:00:00.000';
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('clear');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.answer.answer).toBe('');
	});

	it('resets the input error on change', async () => {
		const wrapper = factory();
		wrapper.vm.state.currentInputRef = 'test_ref';
		wrapper.vm.state.error.errors = { test_ref: { message: 'required' } };
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('change', '2026-10-09T00:00:00.000');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.error.errors.test_ref.message).toBe('');
	});

	it('resets the input error on clear', async () => {
		const wrapper = factory();
		wrapper.vm.state.currentInputRef = 'test_ref';
		wrapper.vm.state.error.errors = { test_ref: { message: 'required' } };
		wrapper.findComponent({ name: 'DateTimeField' }).vm.$emit('clear');
		await wrapper.vm.$nextTick();
		expect(wrapper.vm.state.error.errors.test_ref.message).toBe('');
	});

	it('keys the grid wrapper by error state', () => {
		//the field lives in grid-question-narrow's slot: the key on the
		//grid (same level as the toggling error div) forces a fresh
		//subtree on error flips instead of trusting a stale slot patch
		const clean = factory();
		expect(clean.findComponent(GridQuestionNarrow).vm.$.vnode.key).toBe('grid-ok');

		utilsService.hasQuestionError.mockReturnValueOnce(true);
		const errored = factory();
		expect(errored.findComponent(GridQuestionNarrow).vm.$.vnode.key).toBe('grid-error');
	});
});

describe('QuestionDate.vue - cached answers and defaults', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		//mimic the real setUpInputParams contract (input details + answer)
		questionCommonService.setUpInputParams.mockImplementation((state, inputRef, entriesAddState) => {
			state.inputDetails = entriesAddState.inputDetails;
			state.currentInputRef = inputRef;
			state.error = entriesAddState.error;
			state.required = !!entriesAddState.inputDetails.is_required;
			state.question = entriesAddState.inputDetails.question;
			state.answer = entriesAddState.answers[inputRef];
		});
	});

	afterEach(() => {
		questionCommonService.setUpInputParams.mockReset();
	});

	const factoryWithState = (inputDetails, answer) => {
		return mount(QuestionDate, {
			props: {
				inputRef: 'date_ref',
				type: 'date'
			},
			global: {
				provide: {
					entriesAddState: {
						inputDetails,
						answers: { date_ref: answer },
						error: { errors: [] }
					}
				},
				stubs: {
					...ION_STUBS,
					'date-time-field': {
						name: 'DateTimeField',
						template: '<div class="date-time-field-stub"></div>',
						props: ['type', 'answer', 'datetimeFormat', 'min', 'max', 'locale', 'hasError']
					}
				}
			}
		});
	};

	it.each([
		PARAMETERS.DATE_FORMAT_1,
		PARAMETERS.DATE_FORMAT_2,
		PARAMETERS.DATE_FORMAT_3,
		PARAMETERS.DATE_FORMAT_4,
		PARAMETERS.DATE_FORMAT_5
	])('renders the cached answer for format %s', (format) => {
		const wrapper = factoryWithState(
			{ datetime_format: format, question: 'Q?' },
			{ answer: '2026-10-09T00:00:00.000', was_jumped: false }
		);
		const field = wrapper.findComponent({ name: 'DateTimeField' });
		expect(field.props('type')).toBe('date');
		expect(field.props('answer')).toBe('2026-10-09T00:00:00.000');
		expect(field.props('datetimeFormat')).toBe(format);
	});

	it('defaults to the current date when requested', () => {
		//utils-service is mocked in this file: drive the wiring with
		//controlled values and assert the canonical answer is stored
		utilsService.toISOStringLocale.mockReturnValueOnce('2026-10-09T08:15:30.000');
		utilsService.getISODateOnly.mockReturnValueOnce('2026-10-09T00:00:00.000');
		const wrapper = factoryWithState(
			{ datetime_format: PARAMETERS.DATE_FORMAT_1, set_to_current_datetime: true, question: 'Q?' },
			{ answer: '', was_jumped: false }
		);
		expect(utilsService.toISOStringLocale).toHaveBeenCalledWith(expect.any(Date));
		expect(utilsService.getISODateOnly).toHaveBeenCalledWith('2026-10-09T08:15:30.000', PARAMETERS.DATE_FORMAT_1);
		expect(wrapper.vm.state.answer.answer).toBe('2026-10-09T00:00:00.000');
	});

	it('leaves an empty answer alone without the default flag', () => {
		const wrapper = factoryWithState(
			{ datetime_format: PARAMETERS.DATE_FORMAT_1, question: 'Q?' },
			{ answer: '', was_jumped: false }
		);
		expect(wrapper.vm.state.answer.answer).toBe('');
	});
});
