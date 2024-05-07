<template>
	<ion-content>
		<ion-list class="ion-no-padding ion-no-margin">
			<ion-item
				v-if="!isPWA"
				lines="full"
				@click="share()"
			>
				<ion-icon
					slot="start"
					:icon="shareSocial"
				></ion-icon>
				<ion-label>{{ labels.share }}</ion-label>
			</ion-item>
			<ion-item
				lines="full"
				@click="remove()"
			>
				<ion-icon
					slot="start"
					:icon="trash"
					color="danger"
				></ion-icon>
				<ion-label color="danger">{{ labels.delete }}</ion-label>
			</ion-item>
		</ion-list>
	</ion-content>
</template>

<script>
import { popoverController } from '@ionic/vue';
import { trash, shareSocial } from 'ionicons/icons';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { Share } from '@capacitor/share';
import { computed } from '@vue/reactivity';
import { projectModel } from '@/models/project-model';
import { notificationService } from '@/services/notification-service';
import { deleteFileService } from '@/services/filesystem/delete-file-service';
import { webService } from '@/services/web-service';

export default {
	props: {
		entryUuid: {
			type: String,
			required: true
		},
		projectRef: {
			type: String,
			required: true
		},
		inputRef: {
			type: String,
			required: true
		},
		media: {
			type: Object,
			required: true
		},
		mediaFolder: {
			type: String,
			required: true
		},
		mediaType: {
			type: String,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		//const { entryUuid, inputRef, projectRef, mediaFolder } = readonly(props);
		const tempDir = rootStore.tempDir;
		const persistentDir = rootStore.persistentDir;

		function getFileURI() {
			let fileURI = '';
			const { entryUuid, inputRef, projectRef, mediaFolder } = readonly(props);
			const filenameCached = readonly(props.media[entryUuid][inputRef].cached);
			const filenameStored = readonly(props.media[entryUuid][inputRef].stored);

			//share cached media if any (and this wins over a stored media file)
			if (filenameCached !== '') {
				fileURI = tempDir + filenameCached;
			} else {
				if (filenameStored !== '') {
					//share stored file
					fileURI = persistentDir + mediaFolder + projectRef + '/' + filenameStored;
				}
			}

			return fileURI;
		}

		function getFilenames() {
			const { entryUuid, inputRef } = readonly(props);
			const filenameCached = readonly(props.media[entryUuid][inputRef].cached);
			const filenameStored = readonly(props.media[entryUuid][inputRef].stored);

			const filenameCachedPWA = readonly(
				props.media[entryUuid][inputRef].filenamePWA?.cached || ''
			);
			const filenameStoredPWA = readonly(
				props.media[entryUuid][inputRef].filenamePWA?.stored || ''
			);

			return {
				filenameCached,
				filenameStored,
				filenameCachedPWA,
				filenameStoredPWA
			};
		}

		const methods = {
			async share() {
				try {
					await Share.share({
						title: '',
						text: '',
						//this works in ios 14
						url: 'file://' + getFileURI(),
						dialogTitle: ''
					});
					popoverController.dismiss();
				}
				catch (error) {
					console.log('User cancelled shared action');
				}
			},
			async removePWA() {
				//we only delete the temp files directly (cached)
				//if stored, we delete the filename reference, and the file is deleted
				//from the server when the entry is saved
				//todo: check if stored files are deleted
				await notificationService.showProgressDialog(labels.wait);

				const projectSlug = projectModel.getSlug();
				const filenames = getFilenames();
				const { entryUuid } = readonly(props);

				if (filenames.filenameCachedPWA !== '') {
					//delete temp file from server
					try {
						await webService.deleteTempMediaFile(
							projectSlug,
							entryUuid,
							props.mediaType,
							filenames.filenameCachedPWA
						);
						notificationService.showToast(labels.file_deleted);
						popoverController.dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
					} catch (error) {
						notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
						popoverController.dismiss(null);
						console.log(error);
					} finally {
						notificationService.hideProgressDialog();
					}
				} else {
					if (filenames.filenameStoredPWA !== '') {
						//keep track of stored files deleted
						rootStore.queueRemoteFilesToDeletePWA.push({
							type: props.mediaType,
							filename: filenames.filenameStoredPWA
						});

						notificationService.showToast(labels.file_deleted);
						popoverController.dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
						notificationService.hideProgressDialog();
					} else {
						notificationService.hideProgressDialog();
						return false;
					}
				}
			},
			async removeNative() {
				await notificationService.showProgressDialog(labels.wait);
				const { inputRef, projectRef, mediaFolder } = readonly(props);
				const filenames = getFilenames();
				let fileURI = getFileURI();

				if (filenames.filenameCached !== '') {
					//delete file immediately as it is not saved yet
					// imp:on iOS, cordova needs the 'file://' protocol if it is not there
					if (rootStore.device.platform === PARAMETERS.IOS) {
						if (!fileURI.startsWith('file://')) {
							fileURI = 'file://' + fileURI;
						}
					}

					deleteFileService.removeFile(fileURI).then(
						() => {
							notificationService.hideProgressDialog();
							popoverController.dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
						},
						(error) => {
							notificationService.hideProgressDialog();
							popoverController.dismiss();
							notificationService.showAlert(error.code, labels.error);
						}
					);
				} else {
					//we have a stored file
					if (filenames.filenameStored !== '') {
						//put file in the queue and delete on save

						let filePath = persistentDir + mediaFolder;
						if (rootStore.device.platform === PARAMETERS.IOS) {
							if (!filePath.startsWith('file://')) {
								filePath = 'file://' + filePath;
							}
						}

						console.log('queue file -> ', filenames.filenameStored);
						rootStore.queueFilesToDelete.push({
							inputRef,
							filenameStored: filenames.filenameStored,
							file_path: filePath,
							project_ref: projectRef,
							file_name: filenames.filenameStored
						});
						//The actual deletion is done after the user save the entry
						//just remove from the UI the reference
						notificationService.hideProgressDialog();
						popoverController.dismiss(PARAMETERS.ACTIONS.FILE_QUEUED);
					} else {
						notificationService.hideProgressDialog();
						return false;
					}
				}
			},
			async remove() {
				//ask user for confirmation
				const confirmed = await notificationService.confirmSingle(
					labels.are_you_sure,
					labels.delete
				);

				if (confirmed) {
					if (rootStore.isPWA) {
						methods.removePWA();
					} else {
						methods.removeNative();
					}
				} else {
					popoverController.dismiss();
				}
			}
		};

		const computedScope = {
			isPWA: computed(() => {
				return rootStore.isPWA;
			})
		};

		return {
			labels,
			...methods,
			...computedScope,
			//icons
			trash,
			shareSocial
		};
	}
};
</script>

<style
	lang="scss"
	scoped
></style>