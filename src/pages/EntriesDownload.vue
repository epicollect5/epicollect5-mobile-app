<template>
	<base-layout :title="state.projectName">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<!-- imp: Added only as spacers to center project name -->
			<ion-button disabled>
				<ion-icon>
				</ion-icon>
			</ion-button>
			<!-- imp: End spacers ----------------------------------->
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
						{{ labels.back }}
					</ion-button>
				</ion-buttons>
			</ion-toolbar>
		</template>

		<template #content>
			<ion-list>
				<ion-item
					v-for="form in state.forms"
					:key="form.ref"
					lines="none"
				>
					<div class="center-item-content-wrapper">
						<ion-button
							@click="downloadEntries(form.formRef)"
							:disabled="!state.enabledButtons[form.formRef] || state.entriesDownloaded[form.formRef] || state.noEntriesFound || state.completed"
							size="default"
							color="secondary"
							expand="block"
						>
							<ion-icon
								slot="start"
								:icon="documentText"
							></ion-icon>
							&nbsp;{{ form.name }}
						</ion-button>
						<ion-grid class="download-progress-grid">
							<ion-row>
								<ion-col size="6">
									<span class="download-progress-value">
										{{ labels.download_progress }}: {{ getDownloadProgressLabel(form.formRef) }}
									</span>
								</ion-col>
								<ion-col
									size="6"
									class="download-progress-action"
								>
									<ion-button
										@click="clearDownloadProgress(form.formRef)"
										:disabled="state.isFetching || !hasDownloadProgress(form.formRef)"
										size="small"
										fill="clear"
										color="tertiary"
									>
										{{ labels.clear_download_progress }}
									</ion-button>
								</ion-col>
							</ion-row>
						</ion-grid>
					</div>
				</ion-item>
			</ion-list>

		</template>
	</base-layout>
</template>

<script>
import { chevronBackOutline, documentText } from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer';
import { modalController, onIonViewWillEnter, onIonViewWillLeave } from '@ionic/vue';
import { showModalLogin } from '@/use/auth/show-modal-login';
import { useBackButton } from '@ionic/vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { downloadService } from '@/services/utilities/download-service';
import { entriesDownloadProgressService } from '@/services/utilities/entries-download-progress-service';
import { logout } from '@/use/auth/logout';

export default {
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const router = useRouter();
		const state = reactive({
			projectName: '',
			forms: [],
			errors: false,
			completed: false,
			noEntriesFound: false,
			enabledButtons: [],
			entriesDownloaded: [],
			resumeAvailable: [],
			showWarning: true,
			wasAttemptedDownload: false,
			isFetching: false,
			downloadCache: {}
		});

		//get markup to show project logo in page header
		state.projectName = utilsService.getProjectNameMarkup();

		// Get all the forms (in order) for the form download buttons
		function _getFormButtons() {
      const orderedForms = projectModel.getFormsInOrder();

      orderedForms.forEach((form, formIndex) => {
        // Only enable the first form button initially
        if (formIndex === 0) {
          state.enabledButtons[form.formRef] = true;
        }
        state.forms.push(form);
      });
		}

		function _persistFormDownloadCache(formRef) {
			entriesDownloadProgressService.save(projectModel.getProjectRef(), formRef, state.downloadCache[formRef]);
		}

		function _loadFormDownloadCache(formRef) {
			return entriesDownloadProgressService.load(projectModel.getProjectRef(), formRef);
		}

		function _syncResumeAvailability(formRef) {
			const formCache = _getFormDownloadCache(formRef);
			state.resumeAvailable[formRef] = Object.keys(formCache.urls).length > 0;
		}

		function _hasFormDownloadProgress(formRef) {
			const formCache = _getFormDownloadCache(formRef);
			return Boolean(formCache.updatedAt || formCache.processedEntries || formCache.totalEntries || Object.keys(formCache.urls).length > 0);
		}

		function _getFormDownloadProgressLabel(formRef) {
			if (!_hasFormDownloadProgress(formRef)) {
				return '-/-';
			}

			const formCache = _getFormDownloadCache(formRef);
      return `${formCache.processedEntries ?? 0}/${formCache.totalEntries ?? 0}`;
    }

		function _getFormDownloadCache(formRef) {
			if (!state.downloadCache[formRef]) {
				state.downloadCache[formRef] = _loadFormDownloadCache(formRef);
			}

			return state.downloadCache[formRef];
		}

		function _rememberDownloadedUrl(formRef, currentUrl, nextUrl, progress) {
			if (!currentUrl) {
				return;
			}

			const formCache = _getFormDownloadCache(formRef);
			formCache.startUrl = formCache.startUrl || currentUrl;
			formCache.urls[currentUrl] = nextUrl || null;
			formCache.totalEntries = progress?.totalEntries ?? formCache.totalEntries;
			formCache.processedEntries = progress?.processedEntries ?? formCache.processedEntries;
			formCache.updatedAt = Date.now();
			_persistFormDownloadCache(formRef);
			_syncResumeAvailability(formRef);
		}

		function _updateStoredProgress(formRef, progress) {
			const formCache = _getFormDownloadCache(formRef);
			formCache.totalEntries = progress?.totalEntries ?? formCache.totalEntries;
			formCache.processedEntries = progress?.processedEntries ?? formCache.processedEntries;
			formCache.updatedAt = Date.now();
			_persistFormDownloadCache(formRef);
		}

		function _clearFormDownloadCache(formRef) {
			delete state.downloadCache[formRef];
			entriesDownloadProgressService.clear(projectModel.getProjectRef(), formRef);
			state.resumeAvailable[formRef] = false;
		}

		const methods = {
			hasDownloadProgress(formRef) {
				return _hasFormDownloadProgress(formRef);
			},
			getDownloadProgressLabel(formRef) {
				return _getFormDownloadProgressLabel(formRef);
			},
			async clearDownloadProgress(formRef) {
				const confirmed = await notificationService.confirmSingle(labels.are_you_sure, labels.clear_download_progress);

				if (confirmed) {
					_clearFormDownloadCache(formRef);
				}
			},
			goBack() {
				const currentRouteName = router.currentRoute.value.name;
				if (!state.wasAttemptedDownload) {
					//if next route not specified or itself, default back to entries
					if (rootStore.nextRoute === null || rootStore.nextRoute === currentRouteName) {
						router.replace({
							name: PARAMETERS.ROUTES.ENTRIES,
							query: {
								refreshEntries: true,
								timestamp: Date.now()
							}
						});
					} else {
						router.replace({
							name: rootStore.nextRoute,
							query: { ...rootStore.routeParams }
						});
					}
				} else {
					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						query: {
							refreshEntries: true,
							timestamp: Date.now()
						}
					});
				}
			},
			downloadEntries(formRef, shouldResume = false) {
				let downloadCancelled = false;

				async function _showModalUploadProgress(progress = { total: 0, done: 0 }) {
					rootStore.progressTransfer = progress;
					const modal = await modalController.create({
						cssClass: 'modal-progress-transfer',
						component: ModalProgressTransfer,
						showBackdrop: true,
						backdropDismiss: false,
						componentProps: {
							header: labels.downloading_entries,
							showCloseButton: true,
							onClose() {
								downloadCancelled = true;
							}
						}
					});

						return modal.present();
					}

				const beginDownload = (resumeDownload = false) => {
					state.wasAttemptedDownload = true;
					startDownload(resumeDownload);
				};

				const startDownload = (resumeDownload = false) => {
					const formCache = _getFormDownloadCache(formRef);
					state.isFetching = true;
					_showModalUploadProgress({
						total: resumeDownload ? formCache.totalEntries : 0,
						done: resumeDownload ? formCache.processedEntries : 0
					});

					// Start downloading for this form
					downloadService.downloadFormEntries(formRef, {
						delayMs: 3 * PARAMETERS.DELAY_LONG,
						startUrl: resumeDownload ? formCache.startUrl : null,
						initialTotalEntries: resumeDownload ? formCache.totalEntries : 0,
						initialEntryNumber: resumeDownload ? formCache.processedEntries : 0,
						isCancelled() {
							return downloadCancelled;
						},
						shouldSkipUrl(url) {
							return Object.prototype.hasOwnProperty.call(formCache.urls, url);
						},
						getCachedNextUrl(url) {
							return formCache.urls[url] || null;
						},
						onProgress(progress) {
							_updateStoredProgress(formRef, progress);
						},
						onPageDownloaded(currentUrl, nextUrl, progress) {
							_rememberDownloadedUrl(formRef, currentUrl, nextUrl, progress);
						}
					}).then(
						function (hasEntries) {
							// Entries downloaded code
							let code = 'ec5_143';

							//dismiss the upload modal
							modalController.dismiss();

							// If no entries were found, then there are no more to download for other forms
							if (!hasEntries) {
								// No entries found code
								code = 'ec5_144';

								// Is this the first form?
								if (projectModel.getFirstFormRef() === formRef) {
									state.noEntriesFound = true;
								} else {
									// Otherwise we've finished downloading entries for another form and have completed
									state.completed = true;
								}
							} else {
								// Enable the next form
								state.enabledButtons[projectModel.getNextFormRef(formRef)] = true;
								state.entriesDownloaded[formRef] = true;

								// Is this the last form?
								if (projectModel.getLastFormRef() === formRef) {
									state.completed = true;
								}
							}

							_clearFormDownloadCache(formRef);
							notificationService.showToast(STRINGS[language].status_codes[code]);
						},
						async function (error) {
							const authErrors = PARAMETERS.AUTH_ERROR_CODES;

							//dismiss the upload modal
							modalController.dismiss();
							_syncResumeAvailability(formRef);

							if (error?.cancelled) {
								return;
							}

							/*
						 ec5_77: user is not logged in (or jwt expired)
						 ec5_78: user is logged but cannot access the project
						 */

							// Check if we have an auth error
							if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
								//if error code is ec5_78 it means the user is logged in but has no role in the requested project
								if (error.data.errors[0].code !== 'ec5_78') {
									const confirmed = await notificationService.confirmSingle(
										STRINGS[rootStore.language].status_codes[error.data.errors[0].code]
									);

									if (confirmed) {
										//the user is not logged in or token expired,
										//send it to login page
										await logout();
										showModalLogin();
									}
								}
							} else {
								// Other error
								await errorsService.handleWebError(error);
							}
						}
					).finally(function () {
						state.isFetching = false;
					});
				};

				const handleResumePrompt = async () => {
					const action = await notificationService.confirmMultiple(
						labels.resume_last_download_message,
						labels.download_remote_entries,
						labels.resume_last_download,
						labels.restart_download,
						PARAMETERS.ACTIONS.DOWNLOAD_RESUME,
						PARAMETERS.ACTIONS.DOWNLOAD_RESTART
					);

					if (action === PARAMETERS.ACTIONS.DOWNLOAD_RESUME) {
						beginDownload(true);
					}

					if (action === PARAMETERS.ACTIONS.DOWNLOAD_RESTART) {
						_clearFormDownloadCache(formRef);
						beginDownload(false);
					}
				};

				// Warn user
				if (state.isFetching) {
					return;
				}

				if (!shouldResume && state.resumeAvailable[formRef]) {
					handleResumePrompt();
					return;
				}

				if (state.showWarning && !shouldResume) {
					notificationService
						.confirmSingle(labels.download_warning, labels.download_remote_entries)
						.then(function (result) {
							// If ok was selected, download
							if (result) {
								state.showWarning = false;
								beginDownload(false);
							}
						});
				} else {
					beginDownload(shouldResume);
				}
			}
		};

		_getFormButtons();

		onIonViewWillEnter(() => {
			state.forms.forEach((form) => {
				_syncResumeAvailability(form.formRef);
			});
		});

		onIonViewWillLeave(() => {
			state.downloadCache = {};
		});

		//back with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isFetching) {
				methods.goBack();
			}
		});

		return {
			labels,
			...methods,
			state,
			//icons
			chevronBackOutline,
			documentText
		};
	}
};
</script>

<style
	lang="scss"
	scoped
>
.download-progress-grid {
	padding: 0;
	width: 100%;
}

.download-progress-value {
	display: inline-flex;
	align-items: center;
	height: 100%;
	color: var(--ion-color-medium);
	font-size: 0.875rem;
}

.download-progress-action {
	display: flex;
	justify-content: flex-end;
	padding: 0;
}
</style>
