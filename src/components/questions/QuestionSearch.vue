<template>
	<ion-card
		class="question-card"
		:class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
	>
		<ion-card-header class="question-label">
			<ion-card-title>
				{{ state.question }}
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{ 'ion-margin': isGroupInput }"
		>
			<div
				class="question-required"
				v-if="state.required"
			>
				{{ labels.required }}
			</div>
			<div
				class="question-error"
				v-if="hasError"
			>
				{{ errorMessage }}
			</div>

			<grid-question-narrow>
				<ion-button
					class="question-action-button"
					color="secondary"
					expand="block"
					@click="openSearch()"
				>
					<ion-icon
						slot="start"
						:icon="search"
					></ion-icon>
					{{ labels.search }}
				</ion-button>
			</grid-question-narrow>

			<ion-grid class="ion-no-padding">
				<ion-row
					v-if="state.answer.answer.length > 0"
					class="animate__animated animate__fadeIn"
				>
					<ion-col
						size-xs="12"
						offset-xs="0"
						size-sm="10"
						offset-sm="1"
						size-md="8"
						offset-md="2"
						size-lg="8"
						offset-lg="2"
						class="ion-align-self-center"
					>
						<ion-item
							v-for="(pick, index) in state.picks"
							:key="pick.ref"
						>
							<ion-label>
								{{ pick.answer }}
							</ion-label>
							<div class="ion-activatable ripple-parent">
								<ion-icon
									@click="removePick(index)"
									class="icon-danger question-search-remove-pick"
									:icon="trash"
									slot="end"
								></ion-icon>
								<ion-ripple-effect type="unbounded"></ion-ripple-effect>
							</div>
						</ion-item>
					</ion-col>
				</ion-row>
			</ion-grid>

		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';

import { useRootStore } from '@/stores/root-store';
import { trash, search } from 'ionicons/icons';
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject } from 'vue';
import { modalController } from '@ionic/vue';
import ModalPossibleAnswers from '@/components/modals/ModalPossibleAnswers';
import GridQuestionNarrow from '@/components/GridQuestionNarrow.vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		GridQuestionNarrow
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
			type: Boolean,
			default: false
		}
	},
	emits: ['question-mounted'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { type: questionType, isGroupInput } = readonly(props);
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
			answer: [],
			picks: []
		});

		const scope = {
			ModalSearch: {}
		};

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		console.log(state.answer.answer);

		const hashMap = utilsService.buildPossibleAnswersHashMap(state.inputDetails.possible_answers);

		//search types come as array, check if we have a cached answer to display
		if (state.answer.answer.length > 0) {
			state.picks = [];
			state.answer.answer.forEach((value) => {
				//build picks array
				state.picks.push({
					ref: value,
					answer: hashMap[value] //get answer from ref....
				});
			});
		}

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);
			//emit event to entriesAddState
			context.emit('question-mounted');
		});

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

		const methods = {
			test() { },
			async openSearch() {
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);

				scope.ModalPossibleAnswers = await modalController.create({
					cssClass: 'modal-search',
					component: ModalPossibleAnswers,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						selectedAnswers: state.answer.answer,
						questionType,
						isGroupInput,
						possibleAnswers: state.inputDetails.possible_answers
					}
				});

				scope.ModalPossibleAnswers.onWillDismiss().then((response) => {
					console.log('is', response.data);
					//get picks from modal search
					state.answer.answer = response.data;
					//build picks array
					state.picks = [];
					state.answer.answer.forEach((value) => {
						//build picks array
						state.picks.push({
							ref: value,
							answer: hashMap[value] //get answer from ref....
						});
					});
				});
				scope.ModalPossibleAnswers.present().then(
					setTimeout(() => {
						notificationService.hideProgressDialog();
					}, PARAMETERS.DELAY_FAST)
				);
			},
			removePick(index) {
				setTimeout(() => {
					if (questionType === PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE) {
						//clear cached answers if any
						state.answer.answer = [];
						state.picks = [];
					} else {
						//clear current picks
						state.picks.splice(index, 1);
						//clear cached answers if any
						state.answer.answer.splice(index, 1);
					}
				}, PARAMETERS.DELAY_FAST);
			}
		};

		return {
			labels,
			state,
			...computedScope,

			...methods,
			...props,
			//icons
			trash,
			search
		};
	}
};
</script>

<style lang="scss" scoped></style>