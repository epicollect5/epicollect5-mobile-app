<template>
	<not-found v-if="notFound"></not-found>
	<base-layout
		v-else
		:title="projectName"
		:id="pageId"
		@exit-app="quitEntry()"
	>
		<template #actions-start>
			<ion-button
				v-if="!isPWA"
				class="button-quit"
				@click="quitEntry()"
			>
				<ion-icon
					slot="start"
					:icon="closeOutline"
				>
				</ion-icon>
				{{labels.quit}}
			</ion-button>
		</template>
		<template #actions-end>
			<ion-button
				v-if="isPWA"
				class="button-quit"
				@click="quitEntry()"
			>
				<ion-icon
					slot="start"
					:icon="power"
				>
				</ion-icon>
				{{labels.exit}}
			</ion-button>
			<!-- spacers for native app, just to fix UI centering -->
			<ion-button
				v-if="!isPWA"
				disabled
			>
				<ion-icon slot="icon-only">
				</ion-icon>
			</ion-button>
			<ion-button
				v-if="!isPWA"
				disabled
			>
				<ion-icon slot="icon-only">
				</ion-icon>
			</ion-button>
			<!-- end spacers -->
		</template>

		<template #subheader>
			<ion-toolbar
				color="dark"
				mode="md"
			>
				<ion-buttons slot="start">
					<ion-button
						:disabled="state.disablePrevious"
						@click="prev()"
					>
						<ion-icon
							slot="start"
							:icon="chevronBackOutline"
						>
						</ion-icon>
						{{labels.prev}}
					</ion-button>
				</ion-buttons>

				<div>
					<div class="question-progress-bar">
						<div :style="{width: progressBarWidth }">
						</div>
					</div>
				</div>

				<ion-buttons slot="end">
					<ion-button
						:disabled="state.disableNext"
						@click="next()"
					>
						{{labels.next}}
						<ion-icon
							slot="end"
							:icon="chevronForwardOutline"
						>
						</ion-icon>
					</ion-button>
				</ion-buttons>

			</ion-toolbar>
		</template>

		<template #content>
			<div>
				<ion-item-divider
					v-if="state.questionParams.type!=='branch'"
					class="entry-name"
					color="light"
					sticky
				>
					<ion-label class="entry-name-label ion-text-center">
						{{ parentEntryName }} {{ currentFormName }}
					</ion-label>
				</ion-item-divider>

				<div
					v-if="state.isFetching"
					class="text-center"
				>
					<ion-spinner
						class="loader loader-questions"
						name="crescent"
					></ion-spinner>
				</div>

				<ion-grid>
					<ion-row>
						<ion-col
							size-md="10"
							offset-md="1"
							size-lg="8"
							offset-lg="2"
							size-xl="6"
							offset-xl="3"
						>

							<div v-if="!state.showSave">
								<question-text
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='text'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-text>
								<question-integer
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='integer'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-integer>
								<question-decimal
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='decimal'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-decimal>
								<question-location
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='location'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-location>
								<question-group
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='group'"
									@question-mounted="onQuestionMounted"
								></question-group>
								<question-photo
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='photo'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-photo>
								<question-phone
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='phone'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-phone>
								<question-barcode
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='barcode'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-barcode>
								<question-audio
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='audio'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-audio>
								<question-video
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='video'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-video>
								<question-radio
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='radio'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-radio>
								<question-dropdown
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='dropdown'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-dropdown>
								<question-checkbox
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='checkbox'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-checkbox>
								<question-branch
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='branch'"
									@question-mounted="onQuestionMounted"
									:parentEntryName="parentEntryName"
									:currentFormName="currentFormName"
									@save-branch-entry="saveEntry()"
								></question-branch>
								<question-textarea
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='textarea'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-textarea>
								<question-readme
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='readme'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-readme>
								<question-date
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='date'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-date>
								<question-time
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='time'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-time>
								<question-search
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='searchsingle'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-search>
								<question-search
									:type="state.questionParams.type"
									:inputRef="state.questionParams.currentInputRef"
									v-if="state.questionParams.type==='searchmultiple'"
									@question-mounted="onQuestionMounted"
									:isGroupInput="false"
								></question-search>

							</div>

							<div v-if="state.showSave && !state.isFetching">
								<question-save
									type="save"
									@question-mounted="onQuestionMounted"
									@question-save="saveEntry()"
								>
								</question-save>
							</div>

							<div v-if="state.showSaved && !state.isFetching">
								<question-saved
									type="saved"
									:saved="state.entrySavedPWA"
									:failed="state.entryFailedPWA"
									:action="state.action"
									@question-mounted="onQuestionMounted"
									@add-entry-pwa="addEntryPWA()"
									@go-back-pwa="prev()"
								>
								</question-saved>
							</div>

						</ion-col>
					</ion-row>
				</ion-grid>

			</div>
		</template>
	</base-layout>
</template>

<script>
import { useRootStore } from '@/stores/root-store';
import { closeOutline, power, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { STRINGS } from '@/config/strings';
import { PARAMETERS } from '@/config';
import { useRouter } from 'vue-router';
import { reactive, computed } from '@vue/reactivity';
import { formModel } from '@/models/form-model.js';
import { projectModel } from '@/models/project-model.js';
import questionAudio from '@/components/questions/QuestionAudio';
import questionBarcode from '@/components/questions/QuestionBarcode';
import questionBranch from '@/components/questions/QuestionBranch';
import questionCheckbox from '@/components/questions/QuestionCheckbox';
import questionDate from '@/components/questions/QuestionDate';
import questionDecimal from '@/components/questions/QuestionDecimal';
import questionDropdown from '@/components/questions/QuestionDropdown';
import questionGroup from '@/components/questions/QuestionGroup';
import questionInteger from '@/components/questions/QuestionInteger';
import questionLocation from '@/components/questions/QuestionLocation';
import questionPhone from '@/components/questions/QuestionPhone';
import questionPhoto from '@/components/questions/QuestionPhoto';
import questionRadio from '@/components/questions/QuestionRadio';
import questionReadme from '@/components/questions/QuestionReadme';
import questionSearch from '@/components/questions/QuestionSearch';
import questionText from '@/components/questions/QuestionText';
import questionTextarea from '@/components/questions/QuestionTextarea';
import questionTime from '@/components/questions/QuestionTime';
import questionVideo from '@/components/questions/QuestionVideo';
import questionSave from '@/components/questions/QuestionSave';
import questionSaved from '@/components/questions/QuestionSaved';
import { provide } from 'vue';
import { initialSetup } from '@/use/questions/initial-setup';
import { handleNext } from '@/use/questions/handle-next';
import { handlePrev } from '@/use/questions/handle-prev';
import { useBackButton } from '@ionic/vue';
import { setupPWAEntry } from '@/use/setup-pwa-entry';
import NotFound from '@/pages/NotFound';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { locationService } from '@/services/utilities/location-cordova-service';
import { errorsService } from '@/services/errors-service';
import { entryService } from '@/services/entry/entry-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';

import { questionCommonService } from '@/services/entry/question-common-service';

export default {
	components: {
		questionAudio,
		questionBarcode,
		questionBranch,
		questionCheckbox,
		questionDate,
		questionDecimal,
		questionDropdown,
		questionGroup,
		questionInteger,
		questionLocation,
		questionPhone,
		questionPhoto,
		questionRadio,
		questionReadme,
		questionSearch,
		questionText,
		questionTextarea,
		questionTime,
		questionVideo,
		questionSave,
		questionSaved,
		NotFound
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();

		//if a wrong URL for the PWA is provided in the broswer, bail out
		if (rootStore.notFound && rootStore.isPWA) {
			return {
				notFound: true
			};
		}

		const projectName = utilsService.getProjectNameMarkup();

		const state = reactive({
			isFetching: true,
			progress: 0,
			disableNext: true,
			disablePrevious: true,
			questionParams: {},
			inputs: [],
			inputsExtra: {},
			inputsDetails: {},
			currentAnswer: {},
			answers: [],
			confirmAnswer: {},
			error: {
				hasError: false,
				errors: {}
			},
			// Allow saving by default (via quit button)
			//tjhis is to allow saveing halfway through
			//can be disabled when user edits jumps
			allowSave: null,
			action: null, //add or edit
			entrySavedPWA: false,
			entryFailedPWA: false,
			showSaved: false
		});

		if (rootStore.isPWA) {
			//hierarchy or branch?
			if (entryService) {
				//hierachy
				state.allowSave = entryService.allowSave;
				state.action = entryService.action;
			} else {
				//branch
				state.allowSave = branchEntryService.allowSave;
				state.action = branchEntryService.action;
			}
		}

		const lastNavIndex = rootStore.hierarchyNavigation.length - 1;
		const lastNavItem = rootStore.hierarchyNavigation[lastNavIndex];

		const computedScope = {
			parentEntryName: computed(() => {
				return lastNavItem ? '"' + lastNavItem.parentEntryName + '"' : '';
			}),
			currentFormName: computed(() => {
				return formModel.getName();
			}),
			progressBarWidth: computed(() => {
				return state.progress > 0 ? state.progress + '%' : 0;
			}),
			pageId: computed(() => {
				return state.questionParams.isBranch ? 'entries-branch-add' : 'entries-add';
			}),
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		function showEntrySavedSuccessScreen() {
			state.entrySavedPWA = true;
			state.entryFailedPWA = false;
			state.showSave = false;
			state.showSaved = true;
			state.disablePrevious = true;
			state.disableNext = true;
			notificationService.hideProgressDialog();
		}

		const methods = {
			async saveEntry(syncType) {
				if (rootStore.isPWA) {
					await notificationService.showProgressDialog(labels.wait, labels.saving);

					state.allowSave = true;
					state.action = rootStore.entriesAddScope.entryService.action;

					rootStore.entriesAddScope.entryService.saveEntryPWA().then(
						() => {
							//if branch, go back to branch question and update branches list
							if (rootStore.entriesAddScope.entryService.type === PARAMETERS.BRANCH_ENTRY) {
								//if editing a branch entry, just show the success screen
								if (rootStore.entriesAddScope.entryService.action === PARAMETERS.ENTRY_EDIT) {
									showEntrySavedSuccessScreen();
								} else {
									quit(
										questionCommonService.getNavigationParams(
											rootStore.entriesAddScope.entryService
										)
									);
								}
							} else {
								//this is a hierarchy entry:
								showEntrySavedSuccessScreen();
							}
						},
						(errorResponse) => {
							//random server errors bail out
							if (!errorResponse.data?.errors) {
								console.log(errorResponse);
								notificationService.hideProgressDialog();
								errorsService.handleWebError(errorResponse);
								return false;
							}

							//we need to map the server erros to match the question errors object
							const mappedErrors = {};
							for (const error of errorResponse.data.errors) {
								mappedErrors[error.source] = {
									message: error.title,
									code: error.code
								};
							}

							rootStore.routeParams = {
								error: { errors: mappedErrors }
							};
							state.error = {
								hasError: true,
								errors: mappedErrors
							};
							state.entrySavedPWA = false;
							state.entryFailedPWA = true;
							state.showSave = false;
							state.showSaved = true;
							state.disablePrevious = false;
							state.disableNext = true;

							//handle error, user can go back to check for errors
							errorsService.handleWebError(errorResponse);
							notificationService.hideProgressDialog();
						}
					);
				} else {
					methods.saveEntryToDatabase(syncType);
				}
			},
			// Save the entry to the local database
			async saveEntryToDatabase(syncType) {
				// Determine the syncType
				syncType = syncType ? syncType : PARAMETERS.SYNCED_CODES.UNSYNCED;

				await notificationService.showProgressDialog(labels.wait, labels.saving);
				// SAVE ENTRY
				rootStore.entriesAddScope.entryService.saveEntry(syncType).then(
					function () {
						// Quit with navigation params
						quit(questionCommonService.getNavigationParams(rootStore.entriesAddScope.entryService));
					},
					function (error) {
						console.log(error);
						// An error occurred
						notificationService.hideProgressDialog();
						if (error.error && state.error) {
							errorsService.handleEntryErrors(error.error, state.error, error.inputRefs);
						} else {
							//db errors are {code:0, message:'something'}
							if (error.message) {
								notificationService.showAlert(error.message, labels.error);
							} else {
								notificationService.showAlert(error, labels.error);
							}
						}
					}
				);
			},
			async addEntryPWA() {
				// Show loader
				await notificationService.showProgressDialog(STRINGS[language].labels.wait);
				// Set up a new entry based on URL params
				const formRef = await setupPWAEntry(PARAMETERS.PWA_ADD_ENTRY);
				//get first form question input ref
				const firstInputRef = projectModel.getInputs(formRef)[0];

				rootStore.routeParams = {
					formRef,
					inputRef: null,
					inputIndex: 0,
					isBranch: false,
					error: {}
				};

				//fake answer (to re-use prev() method)
				state.questionParams.currentInputIndex = 1;
				entryService.entry.answers[firstInputRef] = {
					answer: '',
					was_jumped: false
				};

				//reset UI
				state.entrySavedPWA = false;
				state.entryFailedPWA = false;
				state.showSave = false;
				state.disablePrevious = true;
				state.disableNext = false;

				//restart from first question
				methods.prev();
			},
			async quitEntry() {
				//do quitting things
				console.log('> Quit entry was called *************************************');
				// By default, mark saved entries unsynced (native app only)
				let syncType = PARAMETERS.SYNCED_CODES.UNSYNCED;
				let quitMessage = STRINGS[language].status_codes.ec5_100;

				if (rootStore.isPWA) {
					quitMessage = labels.are_you_sure;
				}

				const action = await notificationService.confirmMultiple(
					quitMessage,
					labels.quit,
					labels.save,
					labels.quit
				);

				switch (action) {
					case PARAMETERS.ACTIONS.ENTRY_QUIT:
						await notificationService.showProgressDialog(labels.wait, labels.quitting);
						// Remove any temp answers/entries
						try {
							await rootStore.entriesAddScope.entryService.removeTempBranches();
							// Quit with navigation params
							quit(
								questionCommonService.getNavigationParams(rootStore.entriesAddScope.entryService)
							);
						} catch (error) {
							console.log(error);
							//todo: handle this
						}
						break;

					case PARAMETERS.ACTIONS.ENTRY_SAVE:
						if (!state.allowSave) {
							// Has a jump question been changed while editing an entry?
							notificationService.showAlert(STRINGS[language].status_codes.ec5_140);
							return;
						}
						// SAVE AND QUIT

						// If we're on the last page, just save the entry, no further validation needed
						if (state.questionParams.currentInputRef === null) {
							// Save entry
							methods.saveEntry(syncType);
						} else {
							// Validate and save current answer
							try {
								await rootStore.entriesAddScope.entryService.validateAnswer({
									// Send in all answers
									answers: state.answers,
									// And all verified answers
									confirmAnswer: state.confirmAnswer,
									// Send in the main input details
									mainInputDetails: state.inputDetails,
									// And the current error object
									error: state.error
								});

								// Process the next set of jumps
								// So that we have correct was_jumped values if we save part way through an entry

								rootStore.entriesAddScope.entryService.processJumpsNext(
									state.answers[state.questionParams.currentInputRef],
									state.inputDetails,
									state.questionParams.currentInputIndex
								);

								// If the entry was previously completed (synced or unsynced), mark as unsynced
								// Otherwise, mark as incomplete
								syncType =
									rootStore.entriesAddScope.entryService.entry.synced <
									PARAMETERS.SYNCED_CODES.INCOMPLETE
										? syncType
										: PARAMETERS.SYNCED_CODES.INCOMPLETE;

								// Save entry
								methods.saveEntry(syncType);
							} catch (error) {
								// An error occurred
								errorsService.handleEntryErrors(error.error, state.error, error.inputRefs);
							}
						}
						break;
					default:
						//user dismissed the alert
						return false;
				}
			},
			prev() {
				state.showSaved = false;
				//if the user is on the first question, ask whether to quit the current entry
				//if the user is on any other question, go back by one question
				const currentQuestionIndex = state.questionParams.currentInputIndex;
				currentQuestionIndex === 0
					? methods.quitEntry()
					: handlePrev(state, rootStore.entriesAddScope);
			},
			/**
			 * Validate and save answers
			 * Go to next question/save entry (depending on where you are in the form)
			 */
			async next() {
				handleNext(state, rootStore.entriesAddScope);
			},
			onQuestionMounted() {
				state.isFetching = false;
				notificationService.hideProgressDialog();
			}
		};

		function quit(response) {
			const formRef = rootStore.entriesAddScope.entryService.form.formRef;
			const isBranch = rootStore.entriesAddScope.entryService.entry.isBranch;
			const refreshEntriesView = response.routeName === PARAMETERS.ROUTES.ENTRIES_VIEW;
			const refreshEntriesViewBranch = response.routeName === PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH;
			const refreshEntries = response.routeName === PARAMETERS.ROUTES.ENTRIES;
			const ownerInputRef = isBranch ? response.routeParams.ownerInputRef : null;
			const projectSlug = projectModel.getSlug();

			//on the PWA we do not track user location, we get it from the browser
			if (rootStore.device.platform !== PARAMETERS.PWA) {
				// Stop watching position if the form has any location BUT NOT IF IT IS A BRANCH ENTRY!!!!!
				// If we stop watching it would be impossible to add another location in a branch, as the watchPosition would not work
				if (projectModel.hasLocation(formRef) && !isBranch) {
					console.log('Stopped watching position ------------------------>');
					locationService.stopWatching();
				}
			}

			setTimeout(function () {
				//todo: why is this needed?
				//notificationService.hideProgressDialog();

				//imp: fix this, we need to handle quit entry (hierarchy) and quit branch

				rootStore.routeParams = {
					projectRef: projectModel.getProjectRef(),
					formRef,
					inputRef: response.routeParams.inputRef,
					ownerInputRef,
					inputIndex: response.routeParams.inputIndex,
					isBranch: response.routeParams.isBranch,
					entryUuid: response.routeParams.entryUuid,
					parentEntryUuid: response.routeParams.parentEntryUuid
				};

				//lets check if we are quitting from the PWA

				if (rootStore.isPWA) {
					if (response.routeName === PARAMETERS.ROUTES.PWA_QUIT) {
						if (process.env.NODE_ENV === 'production') {
							//redirect to dataviewer URL ()
							console.log(utilsService.getDataViewerURL(projectSlug));
							window.location.href = utilsService.getDataViewerURL(projectSlug);
						} else {
							console.log(utilsService.getDataViewerURL(projectSlug));
							notificationService.showAlert('Should go back to dataviewer :)');
							notificationService.hideProgressDialog();
						}
						return false;
					}
				}

				//todo: fix this for all the use cases or just refresh all ha ha ha
				router.replace({
					name: response.routeName,
					params: {
						refreshBranchEntries: isBranch && !refreshEntriesView ? 'true' : null,
						refreshEntries: !isBranch && refreshEntries ? 'true' : null,
						refreshEntriesView, //this is to refresh after entry edit,
						refreshEntriesViewBranch, //this is to refresh after branch edit,
						timestamp: Date.now() //force a refresh
					}
				});
			}, PARAMETERS.DELAY_LONG);
		}

		//get markup to show project logo in page header
		rootStore.entriesAddScope.projectName = utilsService.getProjectNameMarkup();

		// Retrieve state params from previous view
		const routeParams = rootStore.routeParams;
		state.questionParams = {
			currentInputRef: routeParams.inputRef,
			currentInputIndex: routeParams.inputIndex,
			previousInputIndex: routeParams.inputIndex - 1,
			isBranch: routeParams.isBranch
		};

		//Set up the scope errors
		if (state.questionParams.currentInputRef !== null) {
			// Reset error message for this question
			state.error.errors[state.questionParams.currentInputRef] = {
				message: ''
			};
		}

		// Check if we have had any errors passed in and assign to scope error object
		if (routeParams.error?.errors) {
			if (routeParams.error.errors.length > 0) {
				// We have errors passed in via the routeParams
				state.error.hasError = true;
				for (let i = 0; i < routeParams.error.errors.length; i++) {
					// Add the error messages to the scope errors
					state.error.errors[routeParams.error.errors[i].source] = {
						message: STRINGS[language].status_codes[routeParams.error.errors[i].code]
					};
				}
			}
		}

		// Set up the question
		initialSetup(state, rootStore.entriesAddScope);
		provide('entriesAddState', state);

		//back with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			console.log('useBackButton EntriesAdd');
			if (state.isFetching) {
				return false;
			}

			switch (state.questionParams.type) {
				case PARAMETERS.QUESTION_TYPES.AUDIO:
					//do nothing while recording audio
					if (!rootStore.isAudioModalActive) {
						methods.prev();
					}
					break;
				case PARAMETERS.QUESTION_TYPES.LOCATION:
					//do nothing while getting location
					if (!rootStore.isLocationModalActive) {
						methods.prev();
					}
					break;
				default:
					//any other cases go back
					methods.prev();
			}
		});

		return {
			labels,
			state,
			...methods,
			...computedScope,
			projectName,
			notFound: false,
			//icons
			closeOutline,
			power,
			chevronBackOutline,
			chevronForwardOutline
		};
	}
};
</script>

<style lang="scss" scoped>
</style>