<template>
	<ion-item
		v-if="isOwnerEntryRemote && state.hasUnsavedBranches"
		class="item-warning ion-text-center animate__animated animate__fadeIn"
		lines="full"
	>
		<ion-label class="ion-text-uppercase ion-text-start">{{ labels.unsaved_branch_entries }}</ion-label>
		<ion-button
			color="warning"
			size="default"
			@click="saveBranchEntry()"
		>
			<ion-icon
				:icon="cloudUpload"
				slot="start"
			></ion-icon>
			{{labels.save}}
		</ion-button>
	</ion-item>

	<ion-item-divider
		class="entry-name"
		color="light"
		sticky
	>
		<ion-label class="entry-name-label ion-text-center">
			{{ parentEntryName }} {{ currentFormName }}
		</ion-label>
	</ion-item-divider>

	<ion-card class="question-card animate__animated animate__fadeIn">
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:disabled="isPWA"
					action="filter"
					:questionText="state.question"
					answer=" "
					@on-label-button-click="openModalEntriesBranchFilter"
				></question-label-action>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content class="ion-text-center question-branch">
			<ion-grid class="ion-no-padding">
				<ion-row v-if="isPWA && isPWAEntryEdit">
					<ion-col>
						<ion-item color="warning">
							<ion-label class="item-divider-label-centered ion-text-wrap">{{pwaEntryEditWarning}}</ion-label>
						</ion-item>
					</ion-col>
				</ion-row>
				<ion-row class="ion-padding-top ion-padding-bottom">
					<ion-col
						size-xs="10"
						offset-xs="1"
						size-sm="8"
						offset-sm="2"
						size-md="6"
						offset-md="3"
						size-lg="6"
						offset-lg="3"
						class="ion-align-self-center"
					>
						<ion-button
							class="question-action-button"
							color="secondary"
							expand="block"
							@click="addBranch()"
						>
							<ion-icon
								slot="start"
								:icon="add"
							></ion-icon>
							{{labels.add_branch}}
						</ion-button>
					</ion-col>
				</ion-row>

				<ion-row v-if="isPWA">
					<ion-col
						size-xs="10"
						offset-xs="1"
						size-sm="8"
						offset-sm="2"
						size-md="6"
						offset-md="3"
						size-lg="6"
						offset-lg="3"
						class="ion-align-self-center"
					>
						<ion-spinner
							v-if="state.isFetching"
							class="ion-margin"
							name="crescent"
						></ion-spinner>
						<div
							v-if="!state.isFetching && state.branchEntries.length > 0"
							class="list-entries-branch"
						>
							<ion-list
								class="animate__animated animate__fadeIn"
								lines="none"
								mode="md"
							>
								<ion-item
									lines="full"
									class="list-entries-item"
									v-for="entry in state.branchEntries"
									:key="entry.id"
								>
									<ion-icon
										class="icon-primary"
										:icon="create"
										slot="start"
										@click="editBranchPWA(entry.id)"
									></ion-icon>
									<ion-label>
										{{ entry.branch_entry.title }}
									</ion-label>
									<ion-icon
										class="icon-danger"
										:icon="trash"
										slot="end"
										@click="removeBranchPWA(entry.id)"
									></ion-icon>
								</ion-item>
							</ion-list>

							<ion-infinite-scroll
								:disabled="state.branchEntries.length <= PARAMETERS.ENTRIES_PER_PAGE"
								v-show="state.branchEntries.length >0"
								@ionInfinite="loadEntriesChunk($event)"
								threshold="100px"
								class="ion-padding-top"
							>
								<ion-infinite-scroll-content
									loading-spinner="crescent"
									:loading-text="labels.loading"
								>
								</ion-infinite-scroll-content>
							</ion-infinite-scroll>
						</div>

					</ion-col>
				</ion-row>

				<ion-row v-if="!isPWA">
					<ion-col>
						<ion-spinner
							v-if="state.isFetching"
							class="ion-margin"
							name="crescent"
						></ion-spinner>
						<div
							v-if="!state.isFetching && state.countNoFilters > 0"
							class="list-entries-branch"
						>
							<ion-list
								class="animate__animated animate__fadeIn"
								lines="full"
								mode="md"
							>

								<toolbar-entries-filters
									:countWithFilters="state.countWithFilters"
									:countNoFilters="state.countNoFilters"
									@filters-clear="filtersClear()"
								>
								</toolbar-entries-filters>
								<ion-item
									class="list-entries-item"
									v-for="entry in state.branchEntries"
									:key="entry.uuid"
									@click="viewBranch(entry.entry_uuid)"
								>
									<ion-grid>
										<ion-row>
											<ion-col>
												<ion-label>
													<icon-entry :entry="entry"></icon-entry>
													{{ entry.title }}
												</ion-label>
											</ion-col>

										</ion-row>
										<ion-row>
											<ion-col>
												<small class="text-left collected-on">
													{{labels.collected_on + utcToLocal(entry.created_at)}}
												</small>
											</ion-col>
										</ion-row>
									</ion-grid>
								</ion-item>
							</ion-list>

							<ion-infinite-scroll
								:disabled="state.countNoFilters <= PARAMETERS.ENTRIES_PER_PAGE"
								v-show="state.countWithFilters >0"
								@ionInfinite="loadEntriesChunk($event)"
								threshold="100px"
								class="ion-padding-top"
							>
								<ion-infinite-scroll-content
									loading-spinner="crescent"
									:loading-text="labels.loading"
								>
								</ion-infinite-scroll-content>
							</ion-infinite-scroll>
						</div>

					</ion-col>
				</ion-row>
				<ion-row v-if="!isPWA && !state.isFetching && state.branchEntries.length === 0">
					<ion-col
						size-xs="10"
						offset-xs="1"
						size-sm="8"
						offset-sm="2"
						size-md="6"
						offset-md="3"
						size-lg="6"
						offset-lg="3"
						class="ion-align-self-center"
					>
						<ion-item
							class="ion-text-center ion-margin-bottom"
							lines="none"
						>
							<ion-label>{{labels.no_entries_found}}</ion-label>
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
import { trash, cloudUpload, create, add } from 'ionicons/icons';
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject, watch } from 'vue';
import { modalController } from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import { projectModel } from '@/models/project-model.js';
import { format } from 'date-fns';
import { fetchBranchEntries } from '@/use/fetch-branch-entries';
import ModalEntriesBranchFilter from '@/components/modals/ModalEntriesBranchFilter';
import ToolbarEntriesFilters from '@/components/ToolbarEntriesFilters';
import IconEntry from '@/components/IconEntry';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		QuestionLabelAction,
		ToolbarEntriesFilters,
		IconEntry
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
		parentEntryName: {
			type: String,
			required: true
		},
		currentFormName: {
			type: String,
			required: true
		}
	},
	emits: ['question-mounted', 'save-branch-entry'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const route = useRoute();
		const { type: questionType, inputRef } = readonly(props);
		const entriesAddState = inject('entriesAddState');
		const entriesAddScope = rootStore.entriesAddScope;

		const projectRef = projectModel.getProjectRef();
		const state = reactive({
			inputDetails: {},
			currentInputRef: null,
			error: {
				errors: []
			},
			required: false,
			question: '',
			answer: [],
			branchEntries: [],
			hasUnsavedBranches: false,
			entriesLimitReached: false,
			isFetching: true,
			countNoFilters: 0,
			countWithFilters: 0,
			entriesOffset: 0,
			filters: { ...PARAMETERS.FILTERS_DEFAULT },
			isInfiniteScrollDisabled: false
		});

		const scope = {};

		//set up question
		questionCommonService.setUpInputParams(state, props.inputRef, entriesAddState);

		console.log(state.answer.answer);

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);

			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		function _updateEntriesFilterBranchByDates() {
			let oldestDateISO;
			let newestDateISO;

			return new Promise((resolve) => {
				(async () => {
					const ownerEntryUuid = entriesAddScope.entryService.entry.entryUuid;
					//get count without filters to have the total reference in the UI
					//i.e "Found 6/50 entries"
					//imp: not the most optimised solution, for now it will do
					const resultWithoutFilters = await databaseSelectService.countBranchesForQuestion(
						ownerEntryUuid,
						inputRef,
						PARAMETERS.FILTERS_DEFAULT,
						PARAMETERS.STATUS.ALL
					);

					//set entries counter without any filter
					state.countNoFilters = resultWithoutFilters.rows.item(0).total;
					//check entries limit
					state.entriesLimit = parseInt(projectModel.getEntriesLimit(inputRef), 10);
					state.entriesLimitReached =
						state.entriesLimit !== null && state.countNoFilters >= state.entriesLimit;

					const result = await databaseSelectService.countBranchesForQuestion(
						ownerEntryUuid,
						inputRef,
						state.filters,
						state.filters.status
					);

					if (result.rows.length > 0) {
						//any entries found?
						if (result.rows.item(0).total > 0) {
							//update entries counter with filters
							state.countWithFilters = result.rows.item(0).total;

							//oldest and newest values here are filtered,
							oldestDateISO = result.rows.item(0).oldest.split('T')[0];
							newestDateISO = result.rows.item(0).newest.split('T')[0];

							//we save the oldest and newest on the first run only to reset
							//dates if needed
							if (state.filters.oldest === null && state.filters.newest === null) {
								state.filters.oldest = oldestDateISO;
								state.filters.newest = newestDateISO;
								//set from and to on first run.
								state.filters.from = oldestDateISO;
								state.filters.to = newestDateISO;
							}
						} else {
							state.countWithFilters = 0;
						}
					}
					resolve(result.rows.item(0).total);
				})();
			});
		}

		const computedScope = {
			isOwnerEntryRemote: computed(() => {
				return entriesAddScope.entryService.entry.isRemote;
			}),
			isPWAEntryEdit: computed(() => {
				return entriesAddScope.entryService.action === PARAMETERS.ENTRY_EDIT;
			}),
			parentEntryName: props.parentEntryName,
			currentFormName: props.currentFormName,
			isPWA: computed(() => {
				return rootStore.isPWA;
			}),
			pwaEntryEditWarning: computed(() => {
				return STRINGS[language].labels.editing_branches_pwa;
			})
		};

		const methods = {
			addBranch() {
				// Set up a new branch entry
				branchEntryService.setUpNew(
					entriesAddScope.entryService.entry.formRef,
					entriesAddState.questionParams.currentInputRef,
					entriesAddScope.entryService.entry.entryUuid
				);

				// Load a EntriesAdd component passing in a branch
				rootStore.routeParams = {
					projectRef,
					formRef: entriesAddScope.entryService.entry.formRef,
					inputRef: '',
					inputIndex: 0,
					isBranch: true,
					error: {}
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				});
			},
			utcToLocal(utcDateString) {
				return format(new Date(utcDateString), 'dd MMM, yyyy @ h:mma');
			},
			saveBranchEntry() {
				context.emit('save-branch-entry');
			},
			viewBranch(entryUuid) {
				rootStore.routeParams = {
					projectRef,
					formRef: entriesAddScope.entryService.entry.formRef,
					ownerInputRef: inputRef,
					ownerEntryUuid: entriesAddScope.entryService.entry.entryUuid,
					entryUuid: entryUuid
				};

				//todo: push or replace?
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH
				});
			},
			async openModalEntriesBranchFilter() {
				//clone reactive properties we do not want to modify in the modal
				const countWithFilters = state.countWithFilters;
				const countNoFilters = state.countNoFilters;
				const filters = { ...state.filters };

				scope.ModalEntriesBranchFilter = await modalController.create({
					cssClass: 'modal-entries-filter',
					component: ModalEntriesBranchFilter,
					showBackdrop: true,
					backdropDismiss: false,
					componentProps: {
						ownerInputRef: inputRef,
						ownerEntryUuid: entriesAddScope.entryService.entry.entryUuid,
						countWithFilters,
						countNoFilters,
						filters
					}
				});

				scope.ModalEntriesBranchFilter.onWillDismiss().then((response) => {
					//if filters changed, refresh entries
					if (!utilsService.objectsMatch(state.filters, response.data.filters)) {
						state.isFetching = true;
						state.filters = response.data.filters;
						state.countWithFilters = response.data.count;

						const { entriesOffset, filters } = state;
						const uuid = entriesAddScope.entryService.entry.entryUuid;
						const fetchParams = {
							inputRef,
							uuid,
							entriesOffset,
							filters
						};
						//re-fetch entries
						fetchBranchEntries(fetchParams).then((result) => {
							state.branchEntries = result.branchEntries;
							state.hasUnsavedBranches = result.hasUnsavedBranches;
							state.isFetching = false;
							// hide loader (progress dialog) with a bit of delay for UX
							notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
						});
					}
				});
				return scope.ModalEntriesBranchFilter.present();
			},
			filtersClear() {
				//reset all filters
				state.filters = { ...PARAMETERS.FILTERS_DEFAULT };
				state.isFetching = true;
				_updateEntriesFilterBranchByDates().then(() => {
					const { entriesOffset, filters } = state;
					const uuid = entriesAddScope.entryService.entry.entryUuid;
					const fetchParams = {
						inputRef,
						uuid,
						entriesOffset,
						filters
					};
					//get the first branch entries chunk for this branch question
					fetchBranchEntries(fetchParams).then((result) => {
						state.branchEntries = result.branchEntries;
						state.hasUnsavedBranches = result.hasUnsavedBranches;
						state.isFetching = false;
					});
				});
			},
			loadEntriesChunk(ev) {
				async function pushEntriesChunk() {
					return new Promise((resolve) => {
						const offset = PARAMETERS.ENTRIES_PER_PAGE;
						const max = state.branchEntries.length + offset;
						const min = max - offset;

						const { filters } = state;
						const uuid = entriesAddScope.entryService.entry.entryUuid;
						const fetchParams = {
							inputRef,
							uuid,
							entriesOffset: min,
							filters
						};

						fetchBranchEntries(fetchParams).then((result) => {
							if (result.branchEntries.length > 0) {
								state.branchEntries.push(...result.branchEntries);
							} else {
								state.isInfiniteScrollDisabled = true;
							}

							resolve();
						});
					});
				}

				setTimeout(async () => {
					await pushEntriesChunk();
					console.log('Loaded branch entries chunk');
					if (ev) {
						ev.target.complete();
					}
					if (state.isInfiniteScrollDisabled) {
						ev.target.disabled = true;
					}
				}, PARAMETERS.DELAY_MEDIUM);
			},
			async removeBranchPWA(id) {
				//ask delete confirmation
				const confirmed = await notificationService.confirmSingle(
					labels.are_you_sure,
					labels.delete
				);

				if (confirmed) {
					//remove branch from store
					//const result = words.filter(word => word.length > 6);
					state.branchEntries = state.branchEntries.filter((entry) => {
						return entry.id !== id;
					});
					rootStore.queueTempBranchEntriesPWA[props.inputRef] = state.branchEntries;
				}
			},
			async editBranchPWA(id) {
				const formRef = entriesAddScope.entryService.entry.formRef;
				const entry = state.branchEntries.find((entry) => {
					return entry.id === id;
				});
				const branchEntry = {
					entryUuid: entry.id,
					ownerEntryUuid: entry.relationships.branch.data.owner_entry_uuid,
					ownerInputRef: entry.relationships.branch.data.owner_input_ref,
					isRemote: 0,
					synced: 0,
					canEdit: 1,
					createdAt: entry.branch_entry.created_at,
					title: entry.branch_entry.title,
					formRef,
					projectRef,
					media: {},
					uniqueAnswers: {},
					syncedError: '',
					isBranch: true,
					answers: entry.branch_entry.answers
				};
				// Show loader
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);

				//edit on PWA onlways start from first question
				await branchEntryService.setUpExisting(branchEntry);
				rootStore.routeParams = {
					formRef,
					inputRef: '',
					inputIndex: 0,
					error: {}, //todo: build error object
					isBranch: true
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				});
			}
		};

		function getBranchEntries() {
			const { entriesOffset, filters } = state;
			const uuid = entriesAddScope.entryService.entry.entryUuid;
			const fetchParams = {
				inputRef,
				uuid,
				entriesOffset,
				filters
			};
			//get the first branch entries chuck for this branch question
			fetchBranchEntries(fetchParams).then((result) => {
				state.branchEntries = result.branchEntries;
				console.log(JSON.stringify(state.branchEntries));
				state.hasUnsavedBranches = result.hasUnsavedBranches;
				state.isFetching = false;
				// hide loader (progress dialog) with a bit of delay for UX
				notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
			});
		}

		if (rootStore.device.platform !== PARAMETERS.PWA) {
			//use filters on native apps
			_updateEntriesFilterBranchByDates().then(() => {
				getBranchEntries();
			});
		} else {
			//ignore filters on PWA
			getBranchEntries();
		}

		//re-fetch branch entries list when needed (after add or delete)
		watch(
			() => [
				{
					refreshBranchEntries: route.params.refreshBranchEntries,
					timestamp: route.params.timestamp
				}
			],
			(changes) => {
				if (changes[0].refreshBranchEntries === 'true') {
					state.isFetching = true;
					window.setTimeout(async function () {
						const { entriesOffset, filters } = state;
						const uuid = entriesAddScope.entryService.entry.entryUuid;
						const fetchParams = {
							inputRef,
							uuid,
							entriesOffset,
							filters
						};
						fetchBranchEntries(fetchParams).then((result) => {
							state.branchEntries = result.branchEntries;
							state.hasUnsavedBranches = result.hasUnsavedBranches;
							state.isFetching = false;
							// hide loader (progress dialog) with a bit of delay for UX
							notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
						});
					}, PARAMETERS.DELAY_LONG);
				}
			}
		);

		return {
			labels,
			state,
			...computedScope,
			...methods,
			PARAMETERS,
			//icons
			trash,
			cloudUpload,
			create,
			add
		};
	}
};
</script>

<style lang="scss" scoped>
</style>