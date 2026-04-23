<template>
	<ion-list class="saved-answers-list ion-no-padding">
		<div
			class="saved-answer-item animate__animated animate__fadeIn"
			v-for="(savedAnswer, index) in state.savedAnswersChunk"
			:key="index"
			@click="toggleCheckbox(savedAnswer)"
			:class="state.selectedAnswer === savedAnswer ? 'checkbox-checked' : ''"
		>
			<ion-grid class="half-padding-start radio-padding">
				<ion-row class="ion-align-items-center">
					<ion-col
						size-xs="10"
						size-sm="11"
						size-md="11"
						size-lg="11"
						size-xl="11"
					>
						<ion-label class="saved-answer-label">{{ savedAnswer }}</ion-label>
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
								type="checkbox"
								class="saved-answer-checkbox"
								color="secondary"
								:checked="state.selectedAnswer === savedAnswer"
							/>
						</div>
					</ion-col>
				</ion-row>

			</ion-grid>
		</div>
	</ion-list>

	<ion-infinite-scroll
		class="ion-margin-top"
		@ionInfinite="loadSavedAnswersChunk($event)"
		threshold="100px"
	>

		<ion-infinite-scroll-content
			:disabled="savedAnswers.length <= PARAMETERS.ANSWERS_PER_PAGE"
			loading-spinner="crescent"
			:loading-text="labels.loading"
		>
		</ion-infinite-scroll-content>
	</ion-infinite-scroll>
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { useRootStore } from '@/stores/root-store';
import { reactive, toRefs } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
export default {
	props: {
		savedAnswers: {
			type: Array,
			required: true
		}
	},
	emits: ['on-selected-answer'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { savedAnswers } = toRefs(props);
		const state = reactive({
			selectedAnswer: '',
			savedAnswersChunk: savedAnswers.value
		});

		const methods = {
			toggleCheckbox(answer) {
				//this is a safety net to avoid double taps
				if (answer === null || answer === undefined) {
					return;
				}

				if (state.selectedAnswer === answer) {
					state.selectedAnswer = '';
				} else {
					state.selectedAnswer = answer;
				}
				//emit to parent
				context.emit('on-selected-answer', state.selectedAnswer);
			},
			loadSavedAnswersChunk(ev) {
				function pushSavedAnswersChunk() {
					const offset = PARAMETERS.ANSWERS_PER_PAGE;
					const max = state.savedAnswersChunk.length + offset;
					const min = max - offset;
					for (let i = min; i < max; i++) {
						if (savedAnswers[i] === undefined) {
							break;
						}
						state.savedAnswersChunk.push(savedAnswers[i]);
					}
				}

				if (state.savedAnswersChunk.length === 0) {
					//on an empty page, add the result immediately
					pushSavedAnswersChunk();
				} else {
					//we are scrolling so
					//we use a timeout otherwise the spinning loader
					//does not have the time to appear
					setTimeout(() => {
						pushSavedAnswersChunk();
						if (ev) {
							ev.target.complete();
						}
						// App logic to determine if all data is loaded
						// and disable the infinite scroll
						if (state.savedAnswersChunk.length === savedAnswers.length) {
							if (ev) {
								ev.target.disabled = true;
							}
						}
					}, PARAMETERS.DELAY_MEDIUM);
				}
			}
		};
		methods.loadSavedAnswersChunk();

		return {
			labels,
			state,
			...props,
			...methods,
			PARAMETERS
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>