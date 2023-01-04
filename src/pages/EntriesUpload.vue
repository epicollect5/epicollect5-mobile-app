<template>
	<base-layout :title="projectName">

		<template #actions-start>
			<ion-menu-button></ion-menu-button>
		</template>

		<template #actions-end>
			<!-- imp: Added only as spacer to center project name -->
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

			<ion-grid class="ion-no-padding">
				<ion-row
					v-cloak
					v-show="areAllEntrieUploaded"
					class="animate__animated animate__fadeIn"
				>
					<ion-col class="subheader-success">
						<div class="ion-text-center">
							<p>
								<ion-icon :icon="checkmark"></ion-icon>
								{{labels.all_entries_uploaded}}
							</p>
						</div>
					</ion-col>
				</ion-row>

				<ion-row v-if="state.totalEntries === 0">
					<ion-col class="ion-text-center subheader-default">
						<p>
							{{labels.no_entries_found}}
						</p>
					</ion-col>
				</ion-row>

				<ion-row
					v-if="state.totalEntriesIncomplete > 0"
					class="subheader-error"
				>
					<ion-col>
						<div class="ion-text-center">
							<p>
								<ion-icon :icon="alertCircle"></ion-icon>
								{{labels.incomplete_entries}}
							</p>
						</div>
					</ion-col>
				</ion-row>

				<ion-row
					v-if="state.totalEntries > 0 && state.errors"
					class="ion-margin-top"
				>
					<ion-col
						size-xs="8"
						offset-xs="2"
						size-sm="6"
						offset-sm="3"
						size-md="4"
						offset-md="4"
						size-lg="4"
						offset-lg="4"
						class="ion-align-self-center"
					>
						<ion-button
							color="danger"
							expand="block"
							@click="goToEntriesErrors()"
						>
							{{labels.check_entries}}
						</ion-button>
					</ion-col>
				</ion-row>

				<ion-row class="ion-margin-bottom ion-margin-top">
					<ion-col
						size-xs="8"
						offset-xs="2"
						size-sm="6"
						offset-sm="3"
						size-md="4"
						offset-md="4"
						size-lg="4"
						offset-lg="4"
						class="ion-align-self-center"
					>
						<ion-button
							:disabled="!state.canUploadData"
							color="secondary"
							expand="block"
							@click="uploadData()"
						>
							<ion-icon
								slot="start"
								:icon="documentText"
							></ion-icon>
							{{labels.upload_data}}
						</ion-button>
					</ion-col>
				</ion-row>

				<ion-row class="ion-margin-bottom">
					<ion-col
						size-xs="8"
						offset-xs="2"
						size-sm="6"
						offset-sm="3"
						size-md="4"
						offset-md="4"
						size-lg="4"
						offset-lg="4"
						class="ion-align-self-center"
					>
						<ion-button
							:disabled="state.photos.length===0"
							color="secondary"
							expand="block"
							@click="uploadMedia(PARAMETERS.QUESTION_TYPES.PHOTO)"
						>
							<ion-icon
								slot="start"
								:icon="images"
							></ion-icon>
							{{labels.upload_photos}}
						</ion-button>
					</ion-col>
				</ion-row>

				<ion-row class="ion-margin-bottom">
					<ion-col
						size-xs="8"
						offset-xs="2"
						size-sm="6"
						offset-sm="3"
						size-md="4"
						offset-md="4"
						size-lg="4"
						offset-lg="4"
						class="ion-align-self-center"
					>
						<ion-button
							:disabled="state.audios.length===0"
							color="secondary"
							expand="block"
							@click="uploadMedia(PARAMETERS.QUESTION_TYPES.AUDIO)"
						>
							<ion-icon
								slot="start"
								:icon="musicalNotes"
							></ion-icon>
							{{labels.upload_audios}}
						</ion-button>
					</ion-col>
				</ion-row>

				<ion-row class="ion-margin-bottom">
					<ion-col
						size-xs="8"
						offset-xs="2"
						size-sm="6"
						offset-sm="3"
						size-md="4"
						offset-md="4"
						size-lg="4"
						offset-lg="4"
						class="ion-align-self-center"
					>
						<ion-button
							:disabled="state.videos.length===0"
							color="secondary"
							expand="block"
							@click="uploadMedia(PARAMETERS.QUESTION_TYPES.VIDEO)"
						>
							<ion-icon
								slot="start"
								:icon="videocam"
							></ion-icon>
							{{labels.upload_videos}}
						</ion-button>
					</ion-col>
				</ion-row>

			</ion-grid>

		</template>
	</base-layout>
</template>

<script>
import {
	videocam,
	chevronBackOutline,
	checkmark,
	images,
	musicalNotes,
	alertCircle,
	documentText
} from 'ionicons/icons';
import { reactive } from '@vue/reactivity';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { useRouter } from 'vue-router';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { computed } from '@vue/runtime-core';
import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer';
import { modalController } from '@ionic/vue';
import { updateProject } from '@/use/update-project';
import { showModalLogin } from '@/use/show-modal-login';
import { useBackButton } from '@ionic/vue';
import { databaseSelectService } from '@/services/database/database-select-service';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { errorsService } from '@/services/errors-service';
import { mediaService } from '@/services/entry/media-service';
import { uploadMediaService } from '@/services/upload-media-service';
import { uploadDataService } from '@/services/upload-data-service';

export default {
	setup() {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const router = useRouter();
		const state = reactive({
			totalEntriesIncomplete: 0,
			totalEntriesUnsynced: 0,
			totalEntriesWithErrors: 0,
			totalEntries: 0,
			photos: [],
			videos: [],
			audios: [],
			errors: false,
			canUploadData: false,
			isUploading: false
		});

		//Check if we have any media to upload
		function _checkMedia() {
			return new Promise((resolve, reject) => {
				(async function () {
					const response = await mediaService.getProjectStoredMedia({
						project_ref: projectModel.getProjectRef(),
						synced: 0,
						entry_uuid: null
					});

					if (response.photos.length > 0) {
						state.photos = response.photos;
					}
					if (response.videos.length > 0) {
						state.videos = response.videos;
					}
					if (response.audios.length > 0) {
						state.audios = response.audios;
					}
					resolve();
				})();
			});
		}

		//Check if we have any unsynced data to upload
		function _checkData() {
			const projectRef = projectModel.getProjectRef();

			return new Promise((resolve) => {
				(async function () {
					const result = await databaseSelectService.countUnsyncedEntries(projectRef);

					state.totalEntries = result.rows.item(0).total_number_of_entries;
					state.totalEntriesUnsynced = result.rows.item(0).total_number_of_entries_unsynced;
					state.totalEntriesWithErrors = result.rows.item(0).total_number_of_entries_with_errors;
					state.totalEntriesIncomplete = result.rows.item(0).total_number_of_incomplete_entries;

					console.log('totalEntriesUnsynced: ' + state.totalEntriesUnsynced);
					console.log('totalEntriesWithErrors: ', state.totalEntriesWithErrors);

					// If we only have entries to upload, with no errors
					if (state.totalEntriesUnsynced > 0 && state.totalEntriesWithErrors === 0) {
						state.canUploadData = true;
						if (state.totalEntriesWithErrors > 0) {
							state.errors = true;
						}
						resolve();
					} else {
						state.canUploadData = false;
						if (state.totalEntriesWithErrors > 0) {
							state.errors = true;
							resolve();
						} else {
							// If we have no unsynced data, check if we have any media unsynced
							await _checkMedia();
							resolve();
						}
					}
				})();
			});
		}

		async function _showModalProgressTransfer(header, total) {
			rootStore.progressTransfer = { total, done: 0 };
			const modal = await modalController.create({
				cssClass: 'modal-progress-transfer',
				component: ModalProgressTransfer,
				showBackdrop: true,
				backdropDismiss: false,
				componentProps: {
					header
				}
			});
			return modal.present();
		}

		async function _handleGeneralError(error) {
			const projectOutdatedErrors = PARAMETERS.PROJECT_OUTDATED_ERROR_CODES;
			const authErrors = PARAMETERS.AUTH_ERROR_CODES;
			// Check the state of the data/media left to upload
			await _checkData();
			//dismiss the upload modal
			modalController.dismiss();
			state.isUploading = false;

			// Check if we have a project out of date error
			if (projectOutdatedErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
				const confirmed = await notificationService.confirmSingle(
					STRINGS[language].labels.update_project,
					STRINGS[language].labels.project_outdated
				);

				if (confirmed) {
					updateProject();
				} else {
					//warn user abut project put of date and entries cannot be synced
					errorsService.handleWebError(error);
				}
			} else if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
				// Check if we have an auth error
				//if error code is ec5_78 it means the user is logged in but has no role in the requested project
				if (error.data.errors[0].code !== 'ec5_78') {
					const confirmed = await notificationService.confirmSingle(
						STRINGS[rootStore.language].status_codes[error.data.errors[0].code]
					);

					if (confirmed) {
						//the user is not logged in, send to login page
						showModalLogin();
					}
				} else {
					errorsService.handleWebError(error);
				}
			} else {
				// Other error
				errorsService.handleWebError(error);
			}
		}

		const methods = {
			/**
			 * Upload all entry data
			 * Start with top level parent forms and their branches
			 * Then move on to related children, child branches and repeat
			 */
			async uploadData() {
				//no internet connection -> bail out
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].labels.connect_to_internet_to_upload);
					return false;
				}
				//no entries to upload -> bail out
				if (state.totalEntriesUnsynced === 0) {
					notificationService.showToast(STRINGS[language].status_codes.ec5_119);
					return false;
				}
				// If we have entries to upload, upload
				if (state.totalEntriesUnsynced > 0) {
					rootStore.attemptedUploadOrErrorFix = true;
					state.isUploading = true;
					await _showModalProgressTransfer(labels.uploading_entries, state.totalEntriesUnsynced);

					uploadDataService.execute(state.totalEntriesUnsynced).then(
						async function (errors) {
							// Check the state of the data/media left to upload
							await _checkData();
							// Finished!
							//dismiss the upload modal
							modalController.dismiss();
							state.isUploading = false;
							state.errors = errors;

							// If we have any errors
							if (state.errors || state.totalEntriesWithErrors > 0) {
								notificationService.showAlert(STRINGS[language].status_codes.ec5_125);
							} else if (state.totalEntriesIncomplete > 0) {
								// If we have any incomplete entries
								notificationService.showAlert(STRINGS[language].status_codes.ec5_139);
							} else {
								// If all entries were successfully uploaded
								notificationService.showToast(STRINGS[language].status_codes.ec5_120);
							}
						},
						async function (error) {
							console.log('Show stopping error hit');
							_handleGeneralError(error);
						}
					);
				}
			},
			async uploadMedia(type) {
				const mediaCount = state[type + 's'].length;
				let header = labels.uploading_entries;
				//no internet connection -> bail out
				const hasInternetConnection = await utilsService.hasInternetConnection();
				if (!hasInternetConnection) {
					notificationService.showAlert(STRINGS[language].labels.connect_to_internet_to_upload);
					return false;
				}
				//no media files to upload -> bail out
				if (mediaCount === 0) {
					notificationService.showToast(STRINGS[language].status_codes.ec5_119);
					return false;
				}

				//set header for progress modal
				switch (type) {
					case PARAMETERS.QUESTION_TYPES.AUDIO:
						header = labels.uploading_audios;
						break;
					case PARAMETERS.QUESTION_TYPES.VIDEO:
						header = labels.uploading_videos;
						break;
					default:
						// Default to 'photo' type
						header = labels.uploading_photos;
				}
				await _showModalProgressTransfer(header, mediaCount);
				state.isUploading = true;

				uploadMediaService.execute(state[type + 's'], mediaCount, 0).then(
					async function (errors) {
						console.log('We have media errors:', JSON.stringify(errors));
						// Check the state of the data/media left to upload
						await _checkData();
						// Finished!
						//dismiss the upload modal
						modalController.dismiss();
						state.isUploading = false;
						state.errors = errors;

						if (state.errors) {
							//some errors occurred
							notificationService.showAlert(STRINGS[language].status_codes.ec5_125);
						} else {
							// If all media files were successfully uploaded
							notificationService.showToast(STRINGS[language].status_codes.ec5_120);
						}
					},
					(error) => {
						_handleGeneralError(error);
					}
				);
			},
			goBack() {
				//refresh entries page only when an upload was attempted
				if (rootStore.attemptedUploadOrErrorFix) {
					rootStore.attemptedUploadOrErrorFix = false;
					rootStore.routeParams = rootStore.routeParamsEntries;

					router.replace({
						name: PARAMETERS.ROUTES.ENTRIES,
						params: {
							refreshEntries: true,
							timestamp: Date.now()
						}
					});
				} else {
					//go back
					router.replace({
						name: rootStore.nextRoute,
						params: { ...rootStore.routeParams }
					});
				}
			},
			goToEntriesErrors() {
				//let's set a flag to refresh entries when user get back,
				//just in case some entry got deleted or edited
				rootStore.attemptedUploadOrErrorFix = true;
				router.replace({
					name: PARAMETERS.ROUTES.ENTRIES_ERRORS,
					params: {
						refreshEntriesErrors: true,
						timestamp: Date.now()
					}
				});
			}
		};

		const computedScope = {
			projectName: utilsService.getProjectNameMarkup(),
			areAllEntrieUploaded: computed(() => {
				return (
					state.totalEntriesIncomplete === 0 &&
					state.totalEntries > 0 &&
					!state.canUploadData &&
					!state.errors &&
					state.photos.length === 0 &&
					state.videos.length === 0 &&
					state.audios.length === 0 &&
					!state.isUploading
				);
			})
		};

		_checkData();

		//back with back button (Android)
		useBackButton(10, () => {
			console.log(window.history);
			if (!state.isUploading) {
				methods.goBack();
			}
		});

		return {
			labels,
			PARAMETERS,
			...methods,
			...computedScope,
			state,
			//icons
			videocam,
			chevronBackOutline,
			checkmark,
			images,
			musicalNotes,
			alertCircle,
			documentText
		};
	}
};
</script>

<style lang="scss" scoped>
</style>