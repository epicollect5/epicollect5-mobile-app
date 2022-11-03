<template>
	<base-layout :title="state.projectName">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<!-- imp: Added only as spacers to center project name -->
			<ion-button disabled="true">
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
						{{labels.back}}
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
							&nbsp;{{form.name}}
						</ion-button>
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
import { modalController } from '@ionic/vue';
import { showModalLogin } from '@/use/show-modal-login';
import { useBackButton } from '@ionic/vue';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { downloadService } from '@/services/utilities/download-service';

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
			showWarning: true,
			wasAttemptedDownload: false,
			isFetching: false
		});

		//get markup to show project logo in page header
		state.projectName = utilsService.getProjectNameMarkup();

		// Get all the forms for the form download buttons
		function _getFormButtons() {
			const forms = projectModel.getExtraForms();
			let formIndex = 0;

			for (const [formRef, form] of Object.entries(forms)) {
				// Only enable the first form button initially
				if (formIndex === 0) {
					state.enabledButtons[formRef] = true;
				}
				formIndex++;

				state.forms.push({
					name: form.details.name,
					formRef
				});
			}
		}

		const methods = {
			goBack() {
				const currentRouteName = router.currentRoute.value.name;
				if (!state.wasAttemptedDownload) {
					//if next route not specified or itself, default back to entries
					if (rootStore.nextRoute === null || rootStore.nextRoute === currentRouteName) {
						router.replace({
							name: PARAMETERS.ROUTES.ENTRIES,
							params: {
								refreshEntries: true,
								timestamp: Date.now()
							}
						});
					} else {
						router.replace({
							name: rootStore.nextRoute,
							params: { ...rootStore.routeParams }
						});
					}
				} else {
					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						params: {
							refreshEntries: true,
							timestamp: Date.now()
						}
					});
				}
			},
			downloadEntries(formRef) {
				async function _showModalUploadProgress() {
					rootStore.progressTransfer = { total: 0, done: 0 };
					const modal = await modalController.create({
						cssClass: 'modal-progress-transfer',
						component: ModalProgressTransfer,
						showBackdrop: true,
						backdropDismiss: false,
						componentProps: {
							header: labels.downloading_entries
						}
					});

					modal.onDidDismiss().then((response) => {
						state.isFetching = false;
					});
					state.isFetching = true;
					return modal.present();
				}

				// Warn user
				if (state.showWarning) {
					notificationService
						.confirmSingle(labels.download_warning, labels.download_remote_entries)
						.then(function (result) {
							// If ok was selected, download
							if (result) {
								state.showWarning = false;
								state.wasAttemptedDownload = true;
								startDownload();
							}
						});
				} else {
					startDownload();
				}

				function startDownload() {
					_showModalUploadProgress();

					// Start downloading for this form
					downloadService.downloadFormEntries(formRef).then(
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

							notificationService.showToast(STRINGS[language].status_codes[code]);
						},
						async function (error) {
							const authErrors = PARAMETERS.AUTH_ERROR_CODES;

							//dismiss the upload modal
							modalController.dismiss();

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
										//the user is not logged in, send to login page
										showModalLogin();
									}
								}
							} else {
								// Other error
								errorsService.handleWebError(error);
							}
						}
					);
				}
			}
		};

		_getFormButtons();

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

<style lang="scss" scoped>
</style>