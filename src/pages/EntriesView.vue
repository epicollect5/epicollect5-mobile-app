<template>
	<base-layout :title="state.projectName">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<ion-button disabled>
				<ion-icon slot="icon-only">
				</ion-icon>
			</ion-button>
		</template>

		<template #subheader>
			<ion-toolbar
				color="dark"
				mode="md"
			>
				<ion-buttons slot="start">
					<ion-button @click="goBack()">
						<ion-icon
							slot="start"
							:icon="chevronBackOutline"
						>
						</ion-icon>
						{{labels.back}}
					</ion-button>
				</ion-buttons>

				<ion-buttons slot="end">
					<ion-button @click="deleteEntry()">
						<ion-icon
							slot="start"
							:icon="trash"
						>
						</ion-icon>
						{{labels.delete}}
					</ion-button>
				</ion-buttons>

			</ion-toolbar>

		</template>

		<template #content>
			<ion-spinner
				v-if="state.isFetching"
				class="loader"
				name="crescent"
			></ion-spinner>

			<div v-else>
				<!-- Errors banner ----------------------------------------->
				<div v-if="state.errors?.errors?.length > 0">
					<ion-item-divider
						v-for="(error, index) in state.errors.errors"
						:key="index"
						color="danger"
						class="entry-error"
						sticky
					>
						<ion-label class="entry-title-label ion-text-wrap">
							{{ statusCodes[error.code] || error.title }}
						</ion-label>
					</ion-item-divider>
				</div>
				<!-- ----------------------------------------------------- -->

				<!-- Incomplete entry banner--------------------------------->
				<div v-if="state.synced === 2">
					<ion-item
						class="item-warning animate__animated animate__fadeIn"
						lines="full"
						mode="md"
					>
						<ion-icon
							slot="end"
							:icon="removeCircle"
						></ion-icon>
						<ion-label class="ion-text-uppercase"> {{ labels.incomplete_entry }}</ion-label>
					</ion-item>
				</div>
				<!-- ------------------------------------------------------ -->

				<!-- entries unsynced banner --------------------------------------->
				<ion-item
					v-if="state.synced ===0"
					class="item-warning ion-text-center animate__animated animate__fadeIn"
					lines="full"
				>
					<ion-label class="ion-text-uppercase ion-text-start">{{ labels.unsynced_entry }}</ion-label>
					<ion-button
						color="warning"
						size="default"
						@click="goToUploadPage()"
					>
						<ion-icon
							:icon="cloudUpload"
							slot="start"
						></ion-icon>
						{{labels.sync_now}}
					</ion-button>
				</ion-item>

				<!-- Remote entry warning banner -->
				<div v-if="state.entry.isRemote === 1">
					<ion-item
						class="item-warning animate__animated animate__fadeIn"
						lines="full"
						mode="md"
					>
						<ion-icon
							slot="end"
							:icon="desktopOutline"
						></ion-icon>
						<ion-label class="ion-text-uppercase">{{labels.remote_entry}}</ion-label>
					</ion-item>
				</div>

				<list-answers
					:formRef="state.formRef"
					:items="state.items"
					:entry="state.entry"
					:errors="state.errors"
					:areGroupAnswers="false"
					:areBranchAnswers="false"
				></list-answers>
			</div>
		</template>
	</base-layout>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import * as icons from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { PARAMETERS } from '@/config';
import { projectModel } from '@/models/project-model.js';
import { entryModel } from '@/models/entry-model';
import { useRouter, useRoute } from 'vue-router';
import { watch } from 'vue';
import * as services from '@/services';
import ListAnswers from '@/components/ListAnswers';
import { useBackButton } from '@ionic/vue';

export default {
	components: { ListAnswers },
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const statusCodes = STRINGS[language].status_codes;
		const router = useRouter();
		const route = useRoute();
		const state = reactive({
			isFetching: true,
			projectName: '',
			formRef: '',
			entryUuid: '',
			parentEntryUuid: '',
			title: '',
			entry: {},
			errors: {},
			branches: {},
			branchesMediaErrors: {},
			items: {},
			inputsExtra: {},
			statusCodes: STRINGS[language].status_codes,
			synced: null
		});

		const routeParams = rootStore.routeParams;

		state.entry = entryModel;

		state.entryUuid = routeParams.entryUuid;
		state.parentEntryUuid = routeParams.parentEntryUuid;
		state.formRef = routeParams.formRef;

		// Retrieve all form inputs
		state.inputs = projectModel.getFormInputs(state.formRef);

		// Retrieve the inputs extra details
		state.inputsExtra = projectModel.getExtraInputs();
		state.synced = state.entry.synced;

		const methods = {
			goBack() {
				if (rootStore.nextRoute) {
					const route = rootStore.nextRoute;
					const refreshEntries = route === PARAMETERS.ROUTES.ENTRIES;
					const refreshEntriesErrors = route === PARAMETERS.ROUTES.ENTRIES_ERRORS;
					//there is a route saved, go there
					router.replace({
						name: rootStore.nextRoute,
						params: {
							refreshEntries,
							refreshEntriesErrors,
							timestamp: Date.now()
						}
					});
					//reset route
					rootStore.nextRoute = null;
				} else {
					//go back to entries list
					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						params: {
							refreshEntries: true
						}
					});
				}
			},
			async deleteEntry() {
				const projectRef = projectModel.getProjectRef();
				let allEntries = [];
				const uuids = [];
				const files = [];

				//todo: should probably catch errors...
				async function _deleteAllEntries(uuids) {
					//map all the uuids to promises
					await Promise.all(
						uuids.map((uuid) => {
							return services.databaseDeleteService.deleteEntry(uuid);
						})
					);
					// Refresh bookmarks after deletion
					await services.bookmarksService.getBookmarks();

					//back to entries list with refresh
					if (rootStore.nextRoute) {
						const route = rootStore.nextRoute;
						const refreshEntries = route === PARAMETERS.ROUTES.ENTRIES;
						const refreshEntriesErrors = route === PARAMETERS.ROUTES.ENTRIES_ERRORS;

						//there is a route saved, go there
						//(should be either the EntriesError or Entries page)
						router.replace({
							name: rootStore.nextRoute,
							params: {
								refreshEntries,
								refreshEntriesErrors,
								timestamp: Date.now()
							}
						});
						//reset route
						rootStore.nextRoute = null;
					} else {
						rootStore.routeParams = {
							projectRef: projectModel.getProjectRef(),
							formRef: state.formRef
						};
						router.replace({
							name: PARAMETERS.ROUTES.ENTRIES,
							params: {
								refreshEntries: true,
								timestamp: Date.now()
							}
						});
					}
					services.notificationService.showToast(labels.entry_deleted);
				}

				const confirmed = await services.notificationService.confirmSingle(
					STRINGS[language].status_codes.ec5_129
				);

				if (confirmed) {
					// Get an array of all the child entries related to this entry (if any)
					services.databaseSelectService
						.getHierarchyEntries(state.entryUuid)
						.then(function(relatedEntries) {
							//get all media files names for this entry, child entries and branch entries
							allEntries = relatedEntries.entries
								.concat(relatedEntries.branchEntries)
								.concat([state.entryUuid]);

							// Now grab the media entries if any
							Promise.all(
								allEntries.map(function(uuid) {
									return services.databaseSelectService.selectEntryMedia(projectRef, uuid);
								})
							).then(function(mediaRows) {
								//mediaRows is an array of arrays, flat it to a single array of uuids
								//also a flat array of file objects for deletion
								mediaRows.forEach((rows) => {
									rows.forEach((entry) => {
										uuids.push(entry.entry_uuid);
										files.push({
											file_name: entry.file_name,
											file_path: entry.file_path,
											project_ref: projectRef
										});
									});
								});

								//if any, delete all media files for this entry, child entries and branch entries
								if (files.length > 0) {
									services.deleteFileService.removeFiles(files).then(function() {
										//then delete media entries in media table
										Promise.all(
											uuids.map(function(uuid) {
												return services.databaseDeleteService.deleteEntryMedia(uuid);
											})
										).then(function() {
											// Now delete all the entries
											_deleteAllEntries(allEntries);
										});
									});
								} else {
									// No files, just delete all the entries
									_deleteAllEntries(allEntries);
								}
							});
						});
				}
			},
			goToUploadPage() {
				rootStore.nextRoute = router.currentRoute.value.name;
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
				});
			}
		};

		async function fetchAnswers() {
			let branchIndex;
			let data;
			let inputDetails;

			// Show loader
			await services.notificationService.showProgressDialog(labels.wait, labels.loading_entry);

			Promise.all([
				services.databaseSelectService.selectEntry(state.entryUuid, state.parentEntryUuid),
				services.databaseSelectService.selectEntryMediaErrors([state.entryUuid])
			]).then(function(response) {
				const res = response[0];
				const mediaRes = response[1];
				let mediaErrors = [];
				let mediaError;

				//grab media errors if any
				for (let index = 0; index < mediaRes.rows.length; index++) {
					mediaError = JSON.parse(mediaRes.rows.item(index).synced_error);
					//media error is an array of errors
					mediaError.errors.forEach((error) => {
						error.inputRef = mediaRes.rows.item(index).input_ref;
						mediaErrors = mediaErrors.concat(error);
					});
				}

				try {
					if (res.rows.length > 0) {
						// Initialise the entry model
						data = res.rows.item(0);
						state.entry.initialise(data);
						state.title = state.entry.title;
						state.synced = state.entry.synced;
					}
					state.errors = JSON.parse(data.synced_error);
					//add media errors (if any)
					state.errors.errors = state.errors.errors.concat(mediaErrors);
				} catch (e) {
					state.errors = {};
					//add media errors (if any)
					if (mediaErrors.length > 0) {
						state.errors.errors = mediaErrors;
					}
				}

				// Retrieve branch entries
				services.databaseSelectService.selectBranches([state.entry.entryUuid]).then(function(res) {
					//reset branches counts
					state.branches = {};
					// Loop round branches, counting
					for (branchIndex = 0; branchIndex < res.rows.length; branchIndex++) {
						// Increment number of branches for this input ref
						if (!state.branches[res.rows.item(branchIndex).owner_input_ref]) {
							state.branches[res.rows.item(branchIndex).owner_input_ref] = 1;
						} else {
							state.branches[res.rows.item(branchIndex).owner_input_ref]++;
						}
					}

					// Now loop round all inputs and display questions and answers
					state.inputs.forEach((value, index) => {
						inputDetails = state.inputsExtra[value].data;

						// Check we have an answer for this question
						if (typeof state.entry.answers[inputDetails.ref] !== 'undefined') {
							// If the question wasn't jumped, add to items array
							if (!state.entry.answers[inputDetails.ref].was_jumped) {
								_addAnswerToItems(inputDetails, index);
							}
						}

						//For remote entries, rebuild group nested structure
						if (state.entry.isRemote === 1) {
							//remote entries are flatted out on the server, so check if this input is a group
							if (inputDetails.type === PARAMETERS.QUESTION_TYPES.GROUP) {
								//add to item array
								_addAnswerToItems(inputDetails, index);
							}
						}
					});

					state.isFetching = false;
					setTimeout(() => {
						services.notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
					}, PARAMETERS.DELAY_LONG);
				});
			});
		}

		function _addAnswerToItems(inputDetails, index) {
			let error = '';
			let scopeError;
			let groupIndex;
			let group;
			let groupInputDetails;
			let answer = '';

			switch (inputDetails.type) {
				case PARAMETERS.QUESTION_TYPES.GROUP:
					// Loop round group inputs
					answer = {};
					// Add group answers to main group
					group = projectModel.getFormGroups(state.entry.formRef);
					for (groupIndex = 0; groupIndex < group[inputDetails.ref].length; groupIndex++) {
						groupInputDetails = state.inputsExtra[group[inputDetails.ref][groupIndex]].data;

						error = '';
						// Check for synced errors on group input
						if (state.errors.errors) {
							// Check if this input has an error
							for (scopeError in state.errors.errors) {
								if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
									if (state.errors.errors[scopeError].source === groupInputDetails.ref) {
										// Get translated error code or, if it doesn't exist, server translation from 'title'
										error =
											STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
											state.errors.errors[scopeError].title;
									}

									//get media errors for the group if any
									if (
										state.errors.errors[scopeError].code === 'ec5_231' &&
										state.errors.errors[scopeError].inputRef
									) {
										if (state.errors.errors[scopeError].inputRef === groupInputDetails.ref) {
											error =
												STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
												state.errors.errors[scopeError].title;
										}
									}
								}
							}
						}

						//filter out README type when the entry is remote as we do not have a remote answer for it
						if (
							!(
								groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README &&
								state.entry.isRemote === 1
							)
						) {
							answer[groupInputDetails.ref] = {
								type: groupInputDetails.type,
								question:
									groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README
										? services.utilsService.htmlDecode(groupInputDetails.question)
										: groupInputDetails.question,
								answer: _getAnswer(
									groupInputDetails,
									state.entry.answers[groupInputDetails.ref].answer
								),
								synced_error: error
							};
						}
					}

					_renderErrors();
					_renderAnswers();
					break;
				case PARAMETERS.QUESTION_TYPES.BRANCH:
					// Get number of branches for this input
					//also find if there are media errors for this branch

					answer = _getAnswer(inputDetails, state.branches);

					//any media errors on branches?
					services.databaseSelectService
						.countCurrentBranchMediaErrors(inputDetails.ref)
						.then(function(response) {
							//set up generic branch error
							const branch_synced_error = {
								errors: [
									{
										code: 'ec5_231',
										title: STRINGS[language].entries_errors,
										source: inputDetails.ref
									}
								]
							};

							//set branch entry media error( to show bug icon next to branch input)
							state.branchesMediaErrors[inputDetails.ref] = response.rows.item(0).total > 0;

							//add generic media error so it appears at the top in the view
							if (state.branchesMediaErrors[inputDetails.ref]) {
								if (Object.keys(state.errors).length === 0) {
									state.errors = branch_synced_error;
								} else {
									state.errors.errors = state.errors.errors.concat(branch_synced_error);
								}
							}
							_renderErrors();
							_renderAnswers();
						});
					break;
				default:
					// Default show answer
					answer = _getAnswer(inputDetails, state.entry.answers[inputDetails.ref].answer);
					_renderErrors();
					_renderAnswers();
			}

			//Get answer for viewing via the AnswerService

			function _getAnswer(inputDetails, answer) {
				return services.answerService.parseAnswerForViewing(inputDetails, answer);
			}

			function _renderErrors() {
				// Check for synced errors on main input
				if (state.errors.errors) {
					// Check if this input has an error
					for (scopeError in state.errors.errors) {
						if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
							if (state.errors.errors[scopeError].source === inputDetails.ref) {
								// Get translated error code or, if it doesn't exist, server translation from 'title'
								error =
									STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
									state.errors.errors[scopeError].title;
							}

							//show error on media question (input) if any
							if (state.errors.errors[scopeError].inputRef) {
								if (state.errors.errors[scopeError].inputRef === inputDetails.ref) {
									// Get translated error code or, if it doesn't exist, server translation from 'title'
									error =
										STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
										state.errors.errors[scopeError].title;
								}
							}
						}
					}
				}
			}

			function _renderAnswers() {
				state.items[inputDetails.ref] = {
					question:
						inputDetails.type === PARAMETERS.QUESTION_TYPES.README
							? services.utilsService.htmlDecode(inputDetails.question)
							: inputDetails.question,
					answer: answer,
					possible_answers:
						inputDetails.possible_answers.length > 0 ? inputDetails.possible_answers : null,
					input_ref: inputDetails.ref,
					input_index: index,
					type: inputDetails.type,
					synced_error: error,
					can_edit: state.entry.canEdit
				};
			}

			//get markup to show project logo in page header
			state.projectName = services.utilsService.getProjectNameMarkup();

			return {
				labels,
				...icons,
				...methods,
				state
			};
		}

		fetchAnswers();

		watch(
			() => [
				{
					refreshEntriesView: route.params.refreshEntriesView,
					timestamp: route.params.timestamp
				}
			],
			async (changes) => {
				console.log('WATCH ROUTING CALLED WITH ->', route);
				//imp: fix this it gets checked all the  time

				if (changes[0].refreshEntriesView === 'true') {
					state.isFetching = true;
					await services.notificationService.showProgressDialog(labels.wait, labels.loading_entry);
					setTimeout(async () => {
						fetchAnswers();
					}, PARAMETERS.DELAY_LONG);
				}
			}
		);

		//back with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isFetching) {
				methods.goBack();
			}
		});

		return {
			state,
			labels,
			statusCodes,
			...icons,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>