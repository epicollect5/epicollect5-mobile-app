import ModalSavedAnswers from '@/components/modals/ModalSavedAnswers.vue';
import { shallowMount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { answerService } from '@/services/entry/answer-service';

vi.mock('@ionic/vue', () => ({
	modalController: {
		dismiss: vi.fn()
	}
}));

const INPUT_REF = 'form1_input1';

function rowsFixture(payloads) {
	const entries = payloads.map((answers) => ({ answers: JSON.stringify(answers) }));
	return {
		rows: {
			length: entries.length,
			item(index) {
				return entries[index];
			}
		}
	};
}

function emptyRows() {
	return {
		rows: {
			length: 0,
			item() {
				return null;
			}
		}
	};
}

async function flush(times = 5) {
	for (let i = 0; i < times; i++) {
		await Promise.resolve();
	}
}

function mountModal() {
	return shallowMount(ModalSavedAnswers, {
		props: {
			projectRef: 'project-ref',
			formRef: 'form-ref',
			inputRef: INPUT_REF,
			isBranch: false
		},
		global: {
			stubs: {
				'header-modal': true,
				'list-saved-answers': true,
				'ion-content': true,
				'ion-item-divider': true,
				'ion-searchbar': true,
				'ion-spinner': true,
				'ion-card': true,
				'ion-card-header': true,
				'ion-card-title': true,
				'ion-item': true,
				'ion-label': true
			}
		}
	});
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.useFakeTimers();
	vi.spyOn(answerService, 'getSavedAnswers').mockReset();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('ModalSavedAnswers saved-answers guards', () => {
	it('skips entries saved before the question existed instead of throwing', async () => {
		vi.mocked(answerService.getSavedAnswers)
			.mockResolvedValueOnce(
				rowsFixture([
					{ some_old_ref: { answer: 'old', was_jumped: false } },
					{}
				])
			)
			.mockResolvedValue(emptyRows());

		let wrapper;
		expect(() => {
			wrapper = mountModal();
		}).not.toThrow();

		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toEqual([]);
		expect(wrapper.vm.state.isFetching).toBe(false);
	});

	it('skips non-string and blank answers and dedupes valid hits', async () => {
		vi.mocked(answerService.getSavedAnswers)
			.mockResolvedValueOnce(
				rowsFixture([
					{ [INPUT_REF]: { answer: 'Hello', was_jumped: false } },
					{ [INPUT_REF]: { answer: 'Hello', was_jumped: false } },
					{ [INPUT_REF]: { answer: '   ', was_jumped: false } },
					{ [INPUT_REF]: { answer: '', was_jumped: false } },
					{ [INPUT_REF]: { answer: null, was_jumped: false } },
					{ [INPUT_REF]: { answer: 123, was_jumped: false } },
					{ [INPUT_REF]: { answer: { text: 'object' }, was_jumped: false } },
					{ [INPUT_REF]: { was_jumped: false } }
				])
			)
			.mockResolvedValue(emptyRows());

		const wrapper = mountModal();

		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toEqual(['Hello']);
	});

	it('stops paging once MAX_SAVED_ANSWERS hits are collected', async () => {
		const payloads = Array.from({ length: PARAMETERS.MAX_SAVED_ANSWERS }, (_, index) => ({
			[INPUT_REF]: { answer: `answer-${index}`, was_jumped: false }
		}));
		vi.mocked(answerService.getSavedAnswers).mockResolvedValue(rowsFixture(payloads));

		const wrapper = mountModal();

		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toHaveLength(PARAMETERS.MAX_SAVED_ANSWERS);
		//capped: second page is never requested (array-vs-number comparison would fetch again)
		expect(vi.mocked(answerService.getSavedAnswers)).toHaveBeenCalledTimes(1);
	});

	it('search filters case-insensitively and skips non-string answers', async () => {
		vi.mocked(answerService.getSavedAnswers).mockResolvedValue(emptyRows());
		const wrapper = mountModal();
		await flush();

		vi.mocked(answerService.getSavedAnswers).mockReset();
		vi.mocked(answerService.getSavedAnswers)
			.mockResolvedValueOnce(
				rowsFixture([
					{ [INPUT_REF]: { answer: 'Hello World', was_jumped: false } },
					{ [INPUT_REF]: { answer: 'unrelated', was_jumped: false } },
					{ [INPUT_REF]: { answer: 12345, was_jumped: false } },
					{}
				])
			)
			.mockResolvedValue(emptyRows());

		wrapper.vm.filterSavedAnswers({ target: { value: 'hel' } });
		vi.advanceTimersByTime(PARAMETERS.DELAY_LONG + 10);
		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toEqual(['Hello World']);
	});

	it('never exceeds MAX_SAVED_ANSWERS when a page holds more than the remaining capacity', async () => {
		const firstPage = Array.from({ length: PARAMETERS.MAX_SAVED_ANSWERS - 1 }, (_, index) => ({
			[INPUT_REF]: { answer: `answer-${index}`, was_jumped: false }
		}));
		const secondPage = Array.from({ length: PARAMETERS.MAX_SAVED_ANSWERS }, (_, index) => ({
			[INPUT_REF]: { answer: `overflow-${index}`, was_jumped: false }
		}));
		vi.mocked(answerService.getSavedAnswers)
			.mockResolvedValueOnce(rowsFixture(firstPage))
			.mockResolvedValueOnce(rowsFixture(secondPage))
			.mockResolvedValue(emptyRows());

		const wrapper = mountModal();

		await flush();
		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toHaveLength(PARAMETERS.MAX_SAVED_ANSWERS);
		//paging stops once capped instead of requesting further pages
		expect(vi.mocked(answerService.getSavedAnswers)).toHaveBeenCalledTimes(2);
	});

	it('never exceeds MAX_SAVED_ANSWERS when searching across pages', async () => {
		vi.mocked(answerService.getSavedAnswers).mockResolvedValue(emptyRows());
		const wrapper = mountModal();
		await flush();

		const firstPage = Array.from({ length: PARAMETERS.MAX_SAVED_ANSWERS - 1 }, (_, index) => ({
			[INPUT_REF]: { answer: `needle-${index}`, was_jumped: false }
		}));
		const secondPage = Array.from({ length: PARAMETERS.MAX_SAVED_ANSWERS }, (_, index) => ({
			[INPUT_REF]: { answer: `needle-overflow-${index}`, was_jumped: false }
		}));
		vi.mocked(answerService.getSavedAnswers).mockReset();
		vi.mocked(answerService.getSavedAnswers)
			.mockResolvedValueOnce(rowsFixture(firstPage))
			.mockResolvedValueOnce(rowsFixture(secondPage))
			.mockResolvedValue(emptyRows());

		wrapper.vm.filterSavedAnswers({ target: { value: 'needle' } });
		vi.advanceTimersByTime(PARAMETERS.DELAY_LONG + 10);
		await flush();
		await flush();
		await flush();
		vi.advanceTimersByTime(PARAMETERS.DELAY_MEDIUM + 10);
		await flush();

		expect(wrapper.vm.state.hits).toHaveLength(PARAMETERS.MAX_SAVED_ANSWERS);
		expect(vi.mocked(answerService.getSavedAnswers)).toHaveBeenCalledTimes(2);
	});
});
