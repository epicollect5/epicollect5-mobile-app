<template>
	<header-modal @on-dismiss="dismiss()"></header-modal>
	<ion-content>
		<ion-item-divider
			sticky
			color="dark"
			class="saved-answers-serchbar-wrapper"
		>
			<ion-searchbar
				animated
				debounce="500"
				:placeholder="labels.type_hint"
				@ionChange="filterSavedAnswers"
			></ion-searchbar>
		</ion-item-divider>

		<ion-spinner
			v-if="state.isFetching"
			class="spinner-search-saved-answers"
			name="crescent"
		></ion-spinner>

		<div
			v-if="!state.isFetching && state.hits.length >0"
			class="saved-answers-list"
		>
			<list-saved-answers
				:savedAnswers="state.hits"
				@on-selected-answer="onSelectedAnswer"
			>
			</list-saved-answers>

		</div>
		<div
			v-if="!state.isFetching && state.hits.length === 0 && state.searchTerm.length >= 3"
			class="animate__animated animate__fadeIn"
		>
			<ion-card class="ion-text-center">
				<ion-card-header>
					<ion-card-title>{{labels.no_hits_found}}</ion-card-title>
				</ion-card-header>
			</ion-card>
		</div>
		<div
			v-if="!state.isFetching && state.hits.length === 0 && state.searchTerm.length ===0"
			class="animate__animated animate__fadeIn"
		>
			<ion-item
				class="ion-text-center ion-margin-bottom"
				lines="none"
			>
				<ion-label>{{labels.no_entries_found}}</ion-label>
			</ion-item>
		</div>
	</ion-content>

</template>

<script>
import * as icons from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { modalController } from '@ionic/vue';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import ListSavedAnswers from '@/components/ListSavedAnswers';
import HeaderModal from '@/components/HeaderModal';
import * as services from '@/services';

export default {
	components: { ListSavedAnswers, HeaderModal },
	props: {
		projectRef: {
			type: String,
			required: true
		},
		formRef: {
			type: String,
			required: true
		},
		inputRef: {
			type: String,
			required: true
		},
		isBranch: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const { projectRef, formRef, inputRef, isBranch } = readonly(props);
		let request_timeout;

		const state = reactive({
			isFetching: false,
			selectedAnswer: '',
			searchTerm: '',
			hits: []
		});

		const methods = {
			onSelectedAnswer(answer) {
				state.selectedAnswer = answer;
			},
			dismiss() {
				modalController.dismiss(state.selectedAnswer);
			},
			filterSavedAnswers(e) {
				state.searchTerm = e.target.value.toLowerCase().trim();

				if (state.searchTerm.length < 3) {
					return;
				}

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
						state.hits = [];
						state.isFetching = false;
						return false;
					}, PARAMETERS.DELAY_FAST);
				}

				//search the db for matching answers
				//one row at a time to keep memory low
				request_timeout = setTimeout(function() {
					state.hits = [];

					let offset = -1;

					function searchNeedle() {
						offset++;

						if (offset > PARAMETERS.MAX_SAVED_ANSWERS) {
							setTimeout(() => {
								state.isFetching = false;
							}, PARAMETERS.DELAY_MEDIUM);
							return false;
						}

						services.databaseSelectService
							.getSavedAnswers(projectRef, formRef, isBranch, offset)
							.then((result) => {
								if (result.rows.length === 0) {
									setTimeout(() => {
										state.isFetching = false;
									}, PARAMETERS.DELAY_MEDIUM);

									return false;
								} else {
									const answers = JSON.parse(result.rows.item(0).answers);
									const answer = answers[inputRef];

									//show only matching answers
									if (answer.answer.toLowerCase().includes(state.searchTerm)) {
										//skip duplicates
										if (!state.hits.includes(answer.answer)) {
											state.hits.push(answer.answer);
										}
									}
									searchNeedle();
								}
							});
					}
					searchNeedle();
				}, PARAMETERS.DELAY_LONG);
			},
			//imp: initially load saved answers without any filtering
			//imp: lazy loading is done on the front end
			//imp: this works by assuming on the mobile app users will not have
			//imp: thousand of entries saved. We do limit to a set of 50,
			//imp: no reason to load more than that
			loadSavedAnswers() {
				let offset = -1;
				function loadSavedAnswer() {
					offset++;

					if (offset > PARAMETERS.MAX_SAVED_ANSWERS) {
						setTimeout(() => {
							state.isFetching = false;
						}, PARAMETERS.DELAY_MEDIUM);
						return false;
					}

					services.databaseSelectService
						.getSavedAnswers(projectRef, formRef, isBranch, offset)
						.then((result) => {
							if (result.rows.length === 0) {
								setTimeout(() => {
									state.isFetching = false;
								}, PARAMETERS.DELAY_MEDIUM);

								return false;
							} else {
								const answers = JSON.parse(result.rows.item(0).answers);
								const answer = answers[inputRef];
								//if an answer is found, show it
								if (answer.answer.trim() !== '') {
									//skip duplicates
									if (!state.hits.includes(answer.answer)) {
										state.hits.push(answer.answer);
									}
								}
								loadSavedAnswer();
							}
						});
				}
				loadSavedAnswer();
			}
		};

		const computedScope = {};

		methods.loadSavedAnswers();

		return {
			labels,
			state,
			...props,
			...computedScope,
			...icons,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
ion-content {
	--background: transparent;
}
ion-header {
	ion-toolbar {
		--background: transparent;
		ion-button,
		ion-icon {
			color: #333;
		}
	}
}
</style>