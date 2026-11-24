<template>
	<ion-item
		v-if="isOwnerEntryRemote && state.hasUnsavedBranches"
		class="item-warning ion-text-center animate__animated animate__fadeIn"
		lines="full"
	>
		<ion-label class="ion-text-uppercase ion-text-start">{{ labels.unsaved_branch_entries }}</ion-label>
		<ion-button
			class="ion-text-nowrap"
			color="warning"
			size="default"
			:disabled="entriesAddState.isSavingEntry"
			@click="saveBranchEntry()"
		>
			<ion-icon
				:icon="archive"
				slot="start"
			></ion-icon>
			{{ labels.save }}
		</ion-button>
	</ion-item>

	<ion-item-divider
		class="entry-name"
		color="light"
		sticky
	>
		<ion-label class="entry-name-label ion-text-center ion-text-nowrap">
			{{ parentEntryName }} {{ currentFormName }}
		</ion-label>
	</ion-item-divider>

	<ion-card class="question-card animate__animated animate__fadeIn">
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:disabled="isPWA || state.isFetching || state.countNoFilters === 0"
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
							<ion-label class="item-divider-label-centered ion-text-wrap">{{ pwaEntryEditWarning }}
								<button
									type="button"
									class="pwa-branch-edit-warning-link"
									@click="openBranchEntriesDocs()"
								>{{ labels.learn_more }}</button>
							</ion-label>
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
							class="question-action-button ion-text-nowrap"
							color="secondary"
							expand="block"
							@click="addBranch()"
						>
							<ion-icon
								slot="start"
								:icon="add"
							></ion-icon>
							{{ labels.add_branch }}
						</ion-button>
					</ion-col>
				</ion-row>

				<branch-pwa
					v-if="isPWA"
					:parentState="state"
					:inputRef="inputRef"
					@load-entries-chunk="loadEntriesChunk($event)"
				></branch-pwa>

				<branch-native
					v-else
					:parentState="state"
					:inputRef="inputRef"
					@load-entries-chunk="loadEntriesChunk($event)"
					@filters-clear="filtersClear()"
				></branch-native>
			</ion-grid>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { onMounted } from 'vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { add, archive } from 'ionicons/icons';
import { reactive, computed, readonly } from '@vue/reactivity';
import { inject, watch } from 'vue';
import { modalController } from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import { projectModel } from '@/models/project-model.js';
import { fetchBranchEntries } from '@/use/entries/fetch-branch-entries';
import ModalEntriesBranchFilter from '@/components/modals/ModalEntriesBranchFilter';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import BranchPwa from '@/components/platform/BranchPwa';
import BranchNative from '@/components/platform/BranchNative';
import { branchEntriesFilterService } from '@/services/entry/branch-entries-filter-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		QuestionLabelAction,
		BranchPwa,
		BranchNative
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

		onMounted(async () => {
			console.log('Component Question is mounted, type ->', questionType);

			//emit event to entriesAddState
			context.emit('question-mounted');
		});

		function _updateEntriesFilterBranchByDates() {
			return new Promise((resolve) => {
				(async () => {
					const ownerEntryUuid = entriesAddScope.entryService.entry.entryUuid;
					//get count without filters to have the total reference in the UI
					//i.e "Found 6/50 entries"
					//imp: not the most optimised solution, for now it will do
					const counts = await branchEntriesFilterService.getBranchFilterCounts(
						ownerEntryUuid,
						inputRef,
						state.filters
					);

					//set entries counters and seeded filters
					state.countNoFilters = counts.countNoFilters;
					state.countWithFilters = counts.countWithFilters;
					state.filters = counts.filters;
					resolve(counts.countWithFilters);
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

				//keep the owner url: on the PWA the address bar stays on the
				//hierarchy entry, so a refresh boots a fresh entry flow instead
				//of landing on the unmatched /branch path
				const ownerUrl = router.currentRoute.value.fullPath;

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
				}).then(() => {
					if (rootStore.isPWA) {
						window.history.replaceState(window.history.state, '', ownerUrl);
					}
				});
			},
			saveBranchEntry() {
				context.emit('save-branch-entry');
			},
			openBranchEntriesDocs() {
				window.open(PARAMETERS.EDIT_BRANCH_ENTRIES_DOCS_URL);
			},
			async openModalEntriesBranchFilter() {
				if (state.isFetching || state.countNoFilters === 0) {
					return;
				}
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
						const formRef = entriesAddScope.entryService.entry.formRef;
						const fetchParams = {
							projectRef,
							formRef,
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
					const formRef = entriesAddScope.entryService.entry.formRef;
					const fetchParams = {
						projectRef,
						formRef,
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
						const formRef = entriesAddScope.entryService.entry.formRef;
						const fetchParams = {
							projectRef,
							formRef,
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
			}
		};

		function getBranchEntries() {
			const { entriesOffset, filters } = state;
			const uuid = entriesAddScope.entryService.entry.entryUuid;
			const formRef = entriesAddScope.entryService.entry.formRef;
			const fetchParams = {
				projectRef,
				formRef,
				inputRef,
				uuid,
				entriesOffset,
				filters
			};
			//get the first branch entries chuck for this branch question
			fetchBranchEntries(fetchParams).then((result) => {
				state.branchEntries = result.branchEntries;
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
						const formRef = entriesAddScope.entryService.entry.formRef;
						const fetchParams = {
							projectRef,
							formRef,
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
			entriesAddState,
			...computedScope,
			...methods,
			//icons
			add,
			archive
		};
	}
};
</script>

<style src="@/theme/components/questions/QuestionBranch.scss" lang="scss"></style>
