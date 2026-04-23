<template>
	<ion-list
		class="possible-answers-list ion-no-padding"
		:class="{ 'has-error': hasError }"
	>
		<div
			class="possible-answer-item animate__animated animate__fadeIn"
			v-for="possibleAnswer in state.possibleAnswersChunk"
			:key="possibleAnswer.answer_ref"
			:class="state.currentSelectedAnswers.indexOf(possibleAnswer.answer_ref) > -1 ? 'checkbox-checked' : ''"
		>
			<ion-grid
				class="half-padding-start radio-padding"
				@click="toggleRadio(possibleAnswer.answer_ref)"
			>
				<ion-row class="ion-align-items-center">
					<ion-col
						size-xs="10"
						size-sm="11"
						size-md="11"
						size-lg="11"
						size-xl="11"
					>
						<ion-label class="possible-answer-label">{{ possibleAnswer.answer }}</ion-label>
					</ion-col>

					<ion-col
						size-xs="2"
						size-sm="1"
						size-md="1"
						size-lg="1"
						size-xl="1"
						class="ion-text-center"
					>
						<div>
							<input
								class="possible-answer-radio"
								type="checkbox"
								:checked="isChecked(possibleAnswer.answer_ref)"
							/>
						</div>
					</ion-col>
				</ion-row>
			</ion-grid>
		</div>
	</ion-list>

	<ion-infinite-scroll
		v-show="showInfiniteLoader"
		class="ion-margin-top"
		:disabled="disableInfiniteLoader"
		@ionInfinite="loadPossibleAnswersChunk($event)"
		threshold="100px"
	>
		<ion-infinite-scroll-content
			loading-spinner="crescent"
			:loading-text="labels.loading"
		>
		</ion-infinite-scroll-content>
	</ion-infinite-scroll>
</template>

<script>
import { watch } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { reactive, readonly, toRefs, computed } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
export default {
	props: {
		possibleAnswers: {
			type: Array,
			required: true
		},
		selectedAnswers: {
			type: Array,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		},
		isModal: {
			type: Boolean,
			required: true
		},
		hasError: {
			type: Boolean,
			default: false
		}
	},
	emits: ['on-selected-answers'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { possibleAnswers, isGroupInput, isModal } = readonly(props);
		const { selectedAnswers } = toRefs(props);

		const state = reactive({
			currentSelectedAnswers: selectedAnswers.value,
			possibleAnswersChunk: [],
			isFetching: false
		});

		//do not use lazy loading for checkboxes within a GROUP
		//imp: ONLY when NOT loading list in a modal (SEARCH or filtering)
		if (isModal) {
			state.possibleAnswersChunk = possibleAnswers.slice(0, PARAMETERS.POSSIBLE_ANSWERS_PER_PAGE);
		}
		else {
			if (isGroupInput) {
				state.possibleAnswersChunk = possibleAnswers.slice(0);
			} else {
				state.possibleAnswersChunk = possibleAnswers.slice(0, PARAMETERS.POSSIBLE_ANSWERS_PER_PAGE);
			}
		}

		const methods = {
			isChecked(answerRef) {
				return state.currentSelectedAnswers.indexOf(answerRef) > -1;
			},
			toggleRadio(answerRef) {
				const idx = state.currentSelectedAnswers.indexOf(answerRef);
				// If currently selected
				if (idx > -1) {
					//deselect radio
					state.currentSelectedAnswers.splice(idx, 1);
				}
				// Is newly selected
				else {
					//replace selected radio
					//imp: splice works
					state.currentSelectedAnswers.splice(0, 1, answerRef);

					//imp: this does not, lose reactivity
					//imp: radio does NOT get de-selected
					//state.currentSelectedAnswers =[];
					//state.currentSelectedAnswers.push(answerRef);
				}
				//emit to parent
				context.emit('on-selected-answers', state.currentSelectedAnswers);
			},
			loadPossibleAnswersChunk(ev) {
				state.isFetching = true;
				function pushPossibleAnswersChunk() {
					const offset = PARAMETERS.POSSIBLE_ANSWERS_PER_PAGE;
					const max = state.possibleAnswersChunk.length + offset;
					const min = max - offset;
					for (let i = min; i < max; i++) {
						if (possibleAnswers[i] === undefined) {
							break;
						}
						state.possibleAnswersChunk.push(possibleAnswers[i]);
					}
				}

				setTimeout(() => {
					const limit = PARAMETERS.POSSIBLE_ANSWERS_LIMIT;
					pushPossibleAnswersChunk();
					if (ev) {
						ev.target.complete();
					}
					// App logic to determine if all data is loaded
					// and disable the infinite scroll
					if (state.possibleAnswersChunk.length === limit) {
						ev.target.disabled = true;
					}
					state.isFetching = false;
				}, PARAMETERS.DELAY_MEDIUM);
			}
		};

		const computedScope = {
			showInfiniteLoader: computed(() => {
				return state.possibleAnswersChunk.length < possibleAnswers.length;
			}),
			disableInfiniteLoader: computed(() => {
				if (isModal) {
					return false;
				}
				return isGroupInput || possibleAnswers.length <= PARAMETERS.POSSIBLE_ANSWERS_LAZY_THRESHOLD;
			})
		};

		//do not use lazy loading for checkboxes within a GROUP
		if (!isGroupInput) {
			methods.loadPossibleAnswersChunk();
		}

		watch(selectedAnswers, () => {
			console.log('selectedAnswers is-> ', selectedAnswers.value);
		});

		return {
			labels,
			state,
			...props,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped></style>