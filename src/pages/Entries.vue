<template>
	<base-layout v-if="true"
				 :title="state.projectName">
		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<ion-button @click="goToUploadPage()">
				<ion-icon slot="icon-only"
						  :icon="cloudUpload"> </ion-icon>
			</ion-button>
			<ion-button @click="openRightDrawer()">
				<ion-icon slot="icon-only"
						  :icon="ellipsisVertical"> </ion-icon>
			</ion-button>
		</template>

		<template #subheader>
			<ion-toolbar color="dark"
						 mode="md">
				<ion-buttons slot="start">
					<ion-button @click="goBack()">
						<ion-icon slot="start"
								  :icon="chevronBackOutline"> </ion-icon>
						<div class="overflow-ellipsis toolbar-navigation-button">
							{{ state.backLabel }}
						</div>
					</ion-button>
				</ion-buttons>

				<ion-buttons slot="end">
					<ion-button :disabled="isEntriesLimitReached"
								@click="addEntry()">
						<ion-icon slot="start"
								  :icon="add"> </ion-icon>
						<div class="overflow-ellipsis toolbar-navigation-button">
							{{ labels.add_entry }}
						</div>
					</ion-button>
				</ion-buttons>
			</ion-toolbar>

			<!-- fake entries toolbar -->
			<ion-toolbar v-if="state.isDebug && !state.isFetching"
						 color="tertiary"
						 mode="ios"
						 class="animate__animated animate__fadeIn ion-no-margin ion-no-padding ion-text-center">
				<ion-button class="ion-text-uppercase ion-no-margin ion-no-padding"
							fill="clear"
							color="dark"
							@click="addFakeEntries()">
					<ion-icon slot="start"
							  :icon="add"> </ion-icon>
					Add fakes
				</ion-button>
			</ion-toolbar>

			<!-- entries unsynced toolbar -->
			<ion-item v-if="state.hasUnsyncedEntries && !state.isFetching"
					  class="item-warning ion-text-center animate__animated animate__fadeIn"
					  lines="full">
				<ion-label class="ion-text-uppercase ion-text-start">{{
					labels.unsynced_entries
				}}</ion-label>
				<ion-button color="warning"
							size="default"
							@click="goToUploadPage()">
					<ion-icon :icon="cloudUpload"
							  slot="start"></ion-icon>
					{{ labels.sync_now }}
				</ion-button>
			</ion-item>

			<!-- form name (and filters button)  toolbar -->
			<toolbar-form-name :isFetching="state.isFetching"
							   :projectRef="projectRef"
							   :parentEntryName="state.parentEntryName"
							   :currentFormName="state.currentFormName"
							   :formRef="state.formRef"
							   :parentEntryUuid="state.parentEntryUuid"
							   :countWithFilters="state.countWithFilters"
							   :countNoFilters="state.countNoFilters"
							   :filters="{ ...state.filters }"
							   @filters-params="applyFilters"></toolbar-form-name>
		</template>

		<template #content>
			<ion-spinner v-if="state.isFetching"
						 class="loader"
						 name="crescent"></ion-spinner>

			<div v-else
				 class="animate__animated animate__fadeIn">
				<ion-item v-if="isEntriesLimitReached"
						  class="ion-text-center ion-no-padding ion-no-margin"
						  lines="none">
					<ion-label color="warning"
							   class="ion-no-padding ion-no-margin ion-text-wrap">
						{{ warningEntriesLimitReached }}
					</ion-label>
				</ion-item>
				<list-entries v-show="!state.isFetching"
							  :projectRef="projectRef"
							  :entries="state.entries"
							  :nextFormRef="state.nextFormRef"
							  :formRef="state.formRef"
							  :parentEntryUuid="state.parentEntryUuid"
							  :filters="state.filters"
							  :countWithFilters="state.countWithFilters"
							  :countNoFilters="state.countNoFilters">
				</list-entries>
			</div>
		</template>
	</base-layout>
</template>

<script>
import { menuController } from '@ionic/vue';
import { useRootStore } from '@/stores/root-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { STRINGS } from '@/config/strings';
import {
	cloudUpload,
	add,
	chevronBackOutline,
	ellipsisVertical
} from 'ionicons/icons';
import { reactive, computed } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { formModel } from '@/models/form-model.js';
import { useRouter, useRoute } from 'vue-router';
import { onMounted, watch } from 'vue';
import { updateLocalProject } from '@/use/update-local-project';
import { addFakeEntries } from '@/use/add-fake-entries';
import { format } from 'date-fns';
import { fetchEntries } from '@/use/fetch-entries.js';
import ListEntries from '@/components/ListEntries';
import ToolbarFormName from '@/components/ToolbarFormName';
import { provide } from 'vue';
import { useBackButton } from '@ionic/vue';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { entryService } from '@/services/entry/entry-service';

export default {
	components: { ListEntries, ToolbarFormName },
	setup () {
		const rootStore = useRootStore();
		const bookmarkStore = useBookmarkStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const route = useRoute();
		const scope = {};
		const state = reactive({
			isFetching: true,
			entries: [],
			countNoFilters: 0,
			countWithFilters: 0,
			projectName: '',
			currentFormName: '',
			parentFormName: '',
			parentEntryName: '',
			formRef: '',
			nextFormRef: '',
			parentEntryUuid: '',
			hasUnsyncedEntries: false,
			limit: Infinity,
			status: PARAMETERS.STATUS.ALL,
			backLabel: STRINGS[language].labels.projects,
			allMediaUuids: [],
			branchMediaUuids: [],
			filters: { ...PARAMETERS.FILTERS_DEFAULT },
			isDebug: PARAMETERS.DEBUG,
			isAddingFakeEntries: false
		});

		const routeParams = rootStore.routeParams;

		// Attempt to get project/form refs from state params or Models, if already initialised
		scope.projectRef = routeParams.projectRef
			? routeParams.projectRef
			: projectModel.getProjectRef();

		state.formRef =
			routeParams.formRef !== '' ? routeParams.formRef : formModel.formRef;

		function _updateEntriesFilterByDates () {
			let oldestDateISO;
			let newestDateISO;

			return new Promise((resolve) => {
				(async () => {
					//get count without filters to have the total reference in the UI
					//i.e "Found 6/50 entries"
					//imp: not the most optimised solution, for now it will do
					const resultWithoutFilters = await databaseSelectService.countEntries(
						scope.projectRef,
						state.formRef,
						state.parentEntryUuid,
						PARAMETERS.FILTERS_DEFAULT,
						PARAMETERS.STATUS.ALL
					);

					//set entries counter without any filter

					state.countNoFilters = resultWithoutFilters.rows.item(0).total;

					const result = await databaseSelectService.countEntries(
						scope.projectRef,
						state.formRef,
						state.parentEntryUuid,
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
							if (
								state.filters.oldest === null &&
								state.filters.newest === null
							) {
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

		//Retrieve the project and entries
		scope.getProjectAndEntries = async function () {
			await notificationService.showProgressDialog(
				STRINGS[language].labels.wait,
				STRINGS[language].labels.loading_entries
			);

			//Load the form model
			function _loadForm () {
				let form = projectModel.getExtraForm(state.formRef);
				// We set the first form ref as the current form ref if we don't have one already or if the form doesn't exist
				if (
					state.formRef === '' ||
					(Object.keys(form).length === 0 && form.constructor === Object)
				) {
					state.formRef = projectModel.getFirstFormRef();
					form = projectModel.getExtraForm(state.formRef);
					// Reset the hierarchy navigation
					rootStore.hierarchyNavigation = [];
				}

				formModel.initialise(form);

				// Set scope variables
				const lastIndex = rootStore.hierarchyNavigation.length - 1;
				const lastItem = rootStore.hierarchyNavigation[lastIndex];
				state.parentEntryUuid = lastItem ? lastItem.parentEntryUuid : '';
				state.parentEntryName = lastItem
					? '"' + lastItem.parentEntryName + '"'
					: '';
				state.currentFormName = formModel.getName();
				state.nextFormRef = projectModel.getNextFormRef(state.formRef);

				state.parentFormRef = projectModel.getParentFormRef(state.formRef);
				if (state.parentFormRef) {
					//child form
					state.parentFormName = projectModel.getFormName(state.parentFormRef);
					state.backLabel = state.parentFormName;
				} else {
					//top parent form
					state.backLabel = PARAMETERS.ROUTES.PROJECTS;
				}

				//imp: Do we have this page bookmarked?
				bookmarkStore.bookmarkId = bookmarksService.getBookmarkId(
					scope.projectRef,
					state.formRef,
					state.parentEntryUuid
				);

				//any entries limit?
				state.limit = parseInt(projectModel.getEntriesLimit(state.formRef), 10);
			}

			function _loadFormEntries () {
				state.entries = [];
				//get markup to show project logo in page header
				state.projectName = utilsService.getProjectNameMarkup();

				_loadForm();

				_updateEntriesFilterByDates().then(function (total) {
					console.log('Total unfiltered entries: ' + total);
					//no entries at all yet so disable filters controls

					setTimeout(function () {
						const { formRef, parentEntryUuid, filters, status } = state;
						const { projectRef } = scope;
						const fetchParams = {
							projectRef,
							formRef,
							parentEntryUuid,
							currentEntryOffset: 0,
							filters,
							status
						};

						//get the first entries chunk
						fetchEntries(fetchParams).then((response) => {
							state.entries = response.entries;
							state.branchMediaUuids = response.branchMediaUuids;

							state.hasUnsyncedEntries = response.hasUnsyncedEntries;
							state.allMediaUuids = response.allMediaUuids;

							state.isFetching = false;
							setTimeout(function () {
								notificationService.hideProgressDialog();
							}, PARAMETERS.DELAY_MEDIUM);
						});
					}, 0);
				});
			}

			// Check if the project is not already loaded

			console.log('project store ->', projectModel.getProjectRef());
			if (!projectModel.hasInitialised()) {
				const result = await databaseSelectService.selectProject(
					scope.projectRef
				);
				// Can update
				rootStore.continueProjectVersionUpdate = true;
				// Initialise the project model
				projectModel.initialise(result.rows.item(0));
				// Load the form entries
				_loadFormEntries();

				// Check and update project version (background check) if needed

				updateLocalProject(scope).then((updated) => {
					if (updated) {
						notificationService.hideProgressDialog();
						_loadFormEntries();
					}
				});
			} else {
				// Otherwise just load the form entries
				_loadFormEntries();
			}
		};

		onMounted(async () => {
			console.log('Component Entries is mounted!');
			// Retrieve the project and entries
			scope.getProjectAndEntries();
		});

		const methods = {
			openRightDrawer () {
				menuController.open('right-drawer');
			},
			//redirect to projects list (first form)
			//otherwise go up one level in the hierarchy
			goBack () {
				// Project update cannot take place if navigating away
				rootStore.continueProjectVersionUpdate = false;

				if (state.parentFormRef === '') {
					//reset stores
					projectModel.destroy();
					formModel.destroy();

					router.replace({
						name: PARAMETERS.ROUTES.PROJECTS
						// query: {
						// 	projectName: state.projectName
						// }
					});
				} else {
					// Remove last parent object from the history
					const hierarchyNavigation = [...rootStore.hierarchyNavigation];
					hierarchyNavigation.pop();
					rootStore.hierarchyNavigation = [...hierarchyNavigation];

					const routeParams = { ...rootStore.routeParams };
					routeParams.formRef = state.parentFormRef;

					//reset formRef if we are at the top level
					if (rootStore.hierarchyNavigation.length === 0) {
						routeParams.formRef = '';
					}
					rootStore.routeParams = routeParams;
					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						query: {
							refreshEntries: 'true',
							timestamp: Date.now()
						}
					});
				}
			},
			goToUploadPage () {
				// Project update cannot take place if navigating away
				rootStore.continueProjectVersionUpdate = false;
				rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;
				rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;
				rootStore.routeParamsEntries = rootStore.routeParams;

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
				});
			},
			utcToLocal (utcDateString) {
				return format(new Date(utcDateString), 'dd MMM, yyyy @ h:mma');
			},
			viewEntry (entry) {
				// Project update cannot take place if navigating away
				rootStore.continueProjectVersionUpdate = false;

				rootStore.routeParams = {
					entryUuid: entry.entry_uuid,
					parentEntryUuid: state.parentEntryUuid,
					formRef: state.formRef
				};

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_VIEW
				});
			},
			async addEntry () {
				//Project update cannot take place if navigating away
				rootStore.continueProjectVersionUpdate = false;

				//reset file delete queue (in case previous entries leftovers)
				rootStore.queueFilesToDelete = [];

				// Show loader
				await notificationService.showProgressDialog(
					STRINGS[language].labels.wait
				);
				// Set up a new entry
				entryService.setUpNew(
					state.formRef,
					state.parentEntryUuid,
					state.parentFormRef
				);

				rootStore.routeParams = {
					formRef: state.formRef,
					inputRef: null,
					inputIndex: 0,
					isBranch: false,
					error: {}
				};

				window.setTimeout(function () {
					notificationService.hideProgressDialog();
				}, PARAMETERS.DELAY_LONG);

				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_ADD
				});
			},
			//generate fake entries for debugging
			async addFakeEntries () {
				const { formRef, parentEntryUuid, parentFormRef } = state;
				const params = { formRef, parentEntryUuid, parentFormRef };
				state.isAddingFakeEntries = true;
				await addFakeEntries(params);
				state.isAddingFakeEntries = false;

				setTimeout(function () {
					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						query: {
							refreshEntries: 'true',
							timestamp: Date.now()
						}
					});
				}, PARAMETERS.DELAY_FAST);
			},
			applyFilters (params) {
				//if filters changed, refresh entries
				if (!utilsService.objectsMatch(state.filters, params.filters)) {
					state.isFetching = true;
					state.filters = params.filters;
					state.countWithFilters = params.count;

					console.log('countNoFilters', state.countNoFilters);
					//re-fetch entries
					scope.getProjectAndEntries();
				}
			}
		};

		const computedScope = {
			isEntriesLimitReached: computed(() => {
				if (!state.formRef) {
					return false;
				}
				return state.limit !== null && state.countNoFilters >= state.limit;
			}),
			warningEntriesLimitReached: computed(() => {
				return STRINGS[language].status_codes.ec5_250.split('.')[0];
			})
		};

		//re-fetch entries list when needed (after add or delete)
		watch(
			() => [
				{
					refreshEntries: route.query.refreshEntries,
					refresh: route.query.refresh,
					timestamp: route.query.timestamp
				}
			],
			async (changes) => {
				debugger;
				console.log('WATCH ROUTING CALLED WITH ->', route);
				// Indicator as to whether a project update can take place
				// eg if the user goes to a different page, then this must be set to false;
				rootStore.continueProjectVersionUpdate = false;
				//imp: fix this it gets checked all the  time
				if (changes[0].refreshEntries === 'true') {


					state.isFetching = true;
					await notificationService.showProgressDialog(
						STRINGS[language].labels.wait,
						STRINGS[language].labels.loading_entries
					);
					setTimeout(async () => {
						// Retrieve the project and entries
						state.formRef = rootStore.routeParams.formRef;
						scope.projectRef = rootStore.routeParams.projectRef
							? rootStore.routeParams.projectRef
							: projectModel.getProjectRef();
						//reset filters since we are navigating to another form
						state.filters = { ...PARAMETERS.FILTERS_DEFAULT };
						//re-fetch entries
						//	console.error('ENTRIES PAGE routeParams -> ', rootStore.routeParams);
						scope.getProjectAndEntries();
					}, PARAMETERS.DELAY_LONG);
				}
			}
		);

		provide('entriesState', state);

		//back to projects list with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			console.log('useBackButton Entries');
			// Project update cannot take place if navigating away
			rootStore.continueProjectVersionUpdate = false;

			if (!(state.isAddingFakeEntries || state.isFetching)) {
				methods.goBack();
			}
		});

		return {
			labels,
			...methods,
			...scope,
			...computedScope,
			state,
			//icons
			cloudUpload,
			add,
			chevronBackOutline,
			ellipsisVertical
		};
	}
};
</script>

<style lang="scss" scoped></style>
