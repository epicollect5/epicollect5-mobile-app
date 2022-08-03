<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{state.question}}
			</ion-card-title>
		</ion-card-header>
		<ion-card-content :class="{'ion-margin' : isGroupInput}">
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>

			<grid-question-wide>
				<template #content>
					<ion-item
						button
						class="question-dropdown-item"
						:class="{'has-error' : hasError}"
						@click="openModalPossibleAnswers()"
						color="secondary"
					>
						<ion-icon
							slot="end"
							:icon="caretDown"
						></ion-icon>

						<ion-label>
							{{dropdownButtonLabel}}
						</ion-label>
					</ion-item>
					<div
						class="question-error"
						v-if="hasError"
					>
						{{errorMessage}}
					</div>
				</template>
			</grid-question-wide>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';

import { useRootStore } from '@/stores/root-store';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject } from 'vue';
import { PARAMETERS } from '@/config';
import { modalController } from '@ionic/vue';
import ModalPossibleAnswers from '@/components/modals/ModalPossibleAnswers';
import GridQuestionWide from '@/components/GridQuestionWide';

export default {
	components: {
		GridQuestionWide
	},
	props: {
		inputRef: {
			type: String,
			required: true
		},
		type: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const questionType = readonly(props.type);
		const isGroupInput = readonly(props.isGroupInput);
		const entriesAddState = inject('entriesAddState');
		const state = reactive({
			inputDetails: {},
			currentInputRef: null,
			error: {
				errors: []
			},
			required: false,
			question: '',
			pattern: null,
			answer: {
				answer: '',
				was_jumped: false
			},
			confirmAnswer: {
				verify: false,
				answer: ''
			},
			selectedAnswers: []
		});

		const scope = {};

		//set up question
		services.questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const mode = rootStore.device.platform === PARAMETERS.IOS ? 'ios' : 'md';
		const hashMap = services.utilsService.buildPossibleAnswersHashMap(
			state.inputDetails.possible_answers
		);

		//set up array with the selected answer to make modals and child componets work
		if (state.answer.answer !== '') {
			state.selectedAnswers = [state.answer.answer];
		}

		const computedScope = {
			dropdownActionSheetOptions: {
				cssClass: 'question-dropdown-action-sheet',
				mode
			},
			hasError: computed(() => {
				return services.utilsService.hasQuestionError(state);
			}),
			dropdownButtonLabel: computed(() => {
				if (state.answer.answer === '') {
					return labels.pick_possible_answer;
				}

				return hashMap[state.answer.answer];
			}),
			errorMessage: computed(() => {
				if (Object.keys(state.error.errors).length > 0) {
					return state.error?.errors[state.currentInputRef]?.message;
				} else {
					return '';
				}
			})
		};

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to parent
			context.emit('question-mounted');
		});

		const methods = {
			async openModalPossibleAnswers() {
				await services.notificationService.showProgressDialog(STRINGS[language].labels.wait);

				scope.ModalPossibleAnswers = await modalController.create({
					cssClass: 'modal-search',
					component: ModalPossibleAnswers,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						selectedAnswers: state.selectedAnswers,
						questionType,
						possibleAnswers: state.inputDetails.possible_answers,
						isGroupInput
					}
				});

				scope.ModalPossibleAnswers.onWillDismiss().then((response) => {
					console.log('is', response.data);
					//get selected answer from modal
					//imp: we keep the selected answers array because if we convert it to string,
					//imp: and back to array, it becomes an empty string
					//imp: and we are not able to pass it to the modal possible answers
					//imp: for some reason, state.answer.answer is passed as an empty string
					//imp: therefore we pass it as array (without converting it) and all works....
					state.answer.answer = response.data[0] || '';
					state.selectedAnswers = [...response.data]; //<- this is important, it does get passed
				});
				scope.ModalPossibleAnswers.present().then(
					setTimeout(() => {
						services.notificationService.hideProgressDialog();
					}, PARAMETERS.DELAY_FAST)
				);
			}
		};

		return {
			labels: STRINGS[rootStore.language].labels,
			state,
			...icons,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>