<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-item-divider
			v-if="showFilters"
			sticky
			color="dark"
			class="possible-answers-serchbar-wrapper"
		>
			<ion-searchbar
				animated
				debounce="500"
				:placeholder="labels.type_hint"
				@ionChange="filterPossibleAnswers"
			></ion-searchbar>
		</ion-item-divider>

		<ion-spinner
			v-if="state.isFetching"
			class="spinner-search-possible-answers"
			name="crescent"
		></ion-spinner>

		<div
			v-if="!state.isFetching && state.hits.length >0"
			class="possible-answers-list"
		>
			<list-possible-answers-radio
				v-if="isSingleSelectionType"
				:possibleAnswers="state.hits"
				:selectedAnswers="selectedAnswers"
				:isGroupInput="isGroupInput"
				@on-selected-answers="onSelectedAnswers"
			>
			</list-possible-answers-radio>

			<list-possible-answers-checkbox
				v-if="!isSingleSelectionType"
				:possibleAnswers="state.hits"
				:selectedAnswers="selectedAnswers"
				:isGroupInput="isGroupInput"
				@on-selected-answers="onSelectedAnswers"
			>
			</list-possible-answers-checkbox>
		</div>
		<div
			v-if="!state.isFetching && state.hits.length === 0"
			class="animate__animated animate__fadeIn"
		>
			<ion-card class="ion-text-center">
				<ion-card-header>
					<ion-card-title>{{labels.no_hits_found}}</ion-card-title>
				</ion-card-header>
			</ion-card>
		</div>
	</ion-content>

</template>

<script>
import { reactive, computed, toRefs } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import ListPossibleAnswersCheckbox from '@/components/ListPossibleAnswersCheckbox';
import ListPossibleAnswersRadio from '@/components/ListPossibleAnswersRadio';
import HeaderModal from '@/components/HeaderModal.vue';

export default {
	components: { ListPossibleAnswersCheckbox, ListPossibleAnswersRadio, HeaderModal },
	props: {
		possibleAnswers: {
			type: Array,
			required: true
		},
		selectedAnswers: {
			type: Array,
			required: true
		},
		questionType: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { possibleAnswers, questionType } = readonly(props);
		const { selectedAnswers } = toRefs(props);
		let request_timeout;

		const state = reactive({
			isFetching: false,
			selectedAnswers: selectedAnswers.value,
			searchTerm: '',
			hits: []
		});

		//load possible answers (hits in this case), not filtered
		state.hits = [...possibleAnswers];

		const methods = {
			onSelectedAnswers(answerRefs) {
				console.log('onSelectedAnswers modal called');
				state.selectedAnswers = answerRefs;
				//dropdown close after selection (expected behaviour)
				if (questionType === PARAMETERS.QUESTION_TYPES.DROPDOWN) {
					methods.dismiss();
				}
			},
			dismiss() {
				modalController.dismiss(state.selectedAnswers);
			},
			filterPossibleAnswers(e) {
				state.searchTerm = e.target.value;
				state.isFetching = true;
				// Throttle requests before checking for empty search, so we clear the previuos one
				//this is to avoid having a list of hits appear before clearing the previous request
				clearTimeout(request_timeout);
				//reset when no search term
				if (state.searchTerm === '') {
					//empty hits -> imp: does not refresh UI without this and timeout...
					state.hits = [];
					setTimeout(() => {
						//reset hits
						state.hits = [...possibleAnswers];
						state.isFetching = false;
						return false;
					}, PARAMETERS.DELAY_FAST);
				}

				request_timeout = setTimeout(function () {
					state.hits = [];
					possibleAnswers.forEach((possibleAnswer) => {
						if (possibleAnswer.answer.toLowerCase().indexOf(state.searchTerm.toLowerCase()) >= 0) {
							//do not limit the number of hits returned, we have the lazy loading anyway
							state.hits.push(possibleAnswer);
						}
					});
					state.isFetching = false;
				}, PARAMETERS.DELAY_LONG);
			}
		};

		const computedScope = {
			isSingleSelectionType: computed(() => {
				return (
					questionType === PARAMETERS.QUESTION_TYPES.DROPDOWN ||
					questionType === PARAMETERS.QUESTION_TYPES.RADIO ||
					questionType === PARAMETERS.QUESTION_TYPES.SEARCH_SINGLE
				);
			}),
			showFilters: computed(() => {
				if (questionType === PARAMETERS.QUESTION_TYPES.DROPDOWN) {
					if (possibleAnswers.length >= PARAMETERS.POSSIBLE_ANSWERS_FILTER_THRESHOLD) {
						return true;
					} else {
						return false;
					}
				}

				return true;
			})
		};

		return {
			labels,
			state,
			...props,
			...computedScope,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>