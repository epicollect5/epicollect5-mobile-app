<template>
	<ion-card
		class="question-card"
		:class="{'animate__animated animate__fadeIn' : !isGroupInput}"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:disabled="false"
					action="search"
					:questionText="state.question"
					:answer="state.answer.answer"
					@on-label-button-click="openModalSavedAnswer"
				></question-label-action>
			</ion-card-title>
			<ion-card-subtitle
				v-if="hasPattern"
				class="ion-text-right ion-padding"
			>
				{{ labels.pattern }}
				<span>
					{{state.pattern}}
				</span>
				>
			</ion-card-subtitle>
		</ion-card-header>
		<ion-card-content :class="{'ion-margin' : isGroupInput}">
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<textarea
				rows="5"
				class="question-input"
				:class="{'has-error' : hasError}"
				:placeholder="labels.type_answer_here"
				:value="state.answer.answer"
				@input="onInputValueChange($event)"
			></textarea>
			<div
				class="question-error"
				v-if="hasError"
			>
				{{errorMessage}}
			</div>
			<div v-if="state.confirmAnswer.verify">
				<hr />
				<textarea
					rows="5"
					class="question-input"
					:class="{'has-error' : hasError}"
					:placeholder="labels.confirm_answer_here"
					:value="state.confirmAnswer.answer"
					@input="onInputValueChangeConfirm($event)"
				></textarea>
			</div>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { reactive, computed } from '@vue/reactivity';
import { inject } from 'vue';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { modalController } from '@ionic/vue';
import ModalSavedAnswers from '@/components/modals/ModalSavedAnswers';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: { QuestionLabelAction },
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
			type: Boolean,
			required: true
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const questionType = props.type.toUpperCase();
		const labels = STRINGS[rootStore.language].labels;
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
			}
		});

		const scope = {};

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		const computedScope = {
			hasPattern: computed(() => {
				return state.pattern !== '' && state.pattern !== null;
			}),
			hasError: computed(() => {
				return utilsService.hasQuestionError(state);
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
			async openModalSavedAnswer() {
				const projectRef = projectModel.getProjectRef();
				const formRef = formModel.formRef;
				const inputRef = state.inputDetails.ref;
				const isBranch = entriesAddState.questionParams.isBranch;

				await notificationService.showProgressDialog(labels.wait);

				scope.ModalSavedAnswers = await modalController.create({
					cssClass: 'modal-search',
					component: ModalSavedAnswers,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						projectRef,
						formRef,
						inputRef,
						isBranch
					}
				});

				scope.ModalSavedAnswers.onWillDismiss().then((response) => {
					console.log('is', response.data);
					if (response.data !== '') {
						state.answer.answer = response.data;
					}
				});

				scope.ModalSavedAnswers.present().then(
					setTimeout(() => {
						notificationService.hideProgressDialog();
					}, PARAMETERS.DELAY_FAST)
				);
			},
			onInputValueChange(event) {
				const value = event.target.value;
				state.answer.answer = utilsService.getSanitisedAnswer(value);
			},
			onInputValueChangeConfirm(event) {
				const value = event.target.value;
				state.confirmAnswer.answer = utilsService.getSanitisedAnswer(value);
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			...props
		};
	}
};
</script>

<style lang="scss" scoped>
</style>