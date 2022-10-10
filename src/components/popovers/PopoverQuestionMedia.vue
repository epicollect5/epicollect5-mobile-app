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
				<ion-label>{{labels.share}}</ion-label>
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
				<ion-label color="danger">{{labels.delete}}</ion-label>
			</ion-item>
		</ion-list>
	</ion-content>
</template>

<script>
import { popoverController } from '@ionic/vue';
import * as icons from 'ionicons/icons';
import * as services from '@/services';
import { PARAMETERS } from '@/config';
import { readonly } from 'vue';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { Share } from '@capacitor/share';
import { computed } from '@vue/reactivity';
import { projectModel } from '@/models/project-model';
import axios from 'axios';

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
		const { entryUuid, inputRef, projectRef, mediaFolder } = readonly(props);
		const tempDir = rootStore.tempDir;
		const persistentDir = rootStore.persistentDir;

		let fileURI = '';
		const filenameCached = readonly(props.media[entryUuid][inputRef].cached);
		const filenameStored = readonly(props.media[entryUuid][inputRef].stored);
		const filenamePWA = readonly(props.media[entryUuid][inputRef].filenamePWA);
		//share cached audio if any (and this wins over a stored audio file)
		if (filenameCached !== '') {
			fileURI = tempDir + filenameCached;
		} else {
			if (filenameStored !== '') {
				//share stored file
				fileURI = persistentDir + mediaFolder + projectRef + '/' + filenameStored;
			}
		}

		const methods = {
			share() {
				Share.share({
					title: '',
					text: '',
					//this works in ios 14
					url: 'file://' + fileURI,
					dialogTitle: ''
				});
				popoverController.dismiss();
			},
			async removePWA() {
				await services.notificationService.showProgressDialog(labels.wait);

				const projectSlug = projectModel.getSlug();

				if (filenamePWA !== '') {
					//delete temp file from server
					try {
						await services.webService.deleteTempMediaFile(
							projectSlug,
							entryUuid,
							props.mediaType,
							filenamePWA
						);
						services.notificationService.showToast(labels.file_deleted);
						popoverController.dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
					} catch (error) {
						services.notificationService.showAlert(STRINGS[language].status_codes.ec5_103);
						popoverController.dismiss(null);
						console.log(error);
					} finally {
						services.notificationService.hideProgressDialog();
					}
				} else {
					services.notificationService.hideProgressDialog();
					return false;
				}
			},
			async removeNative() {
				await services.notificationService.showProgressDialog(labels.wait);

				if (filenameCached !== '') {
					//delete file immediately as it is not saved yet
					// imp:on iOS, cordova needs the 'file://' protocol if it is not there
					if (rootStore.device.platform === PARAMETERS.IOS) {
						if (!fileURI.startsWith('file://')) {
							fileURI = 'file://' + fileURI;
						}
					}

					services.deleteFileService.removeFile(fileURI).then(
						() => {
							services.notificationService.hideProgressDialog();
							popoverController.dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
						},
						(error) => {
							services.notificationService.hideProgressDialog();
							popoverController.dismiss();
							services.notificationService.showAlert(error.code, labels.error);
						}
					);
				} else {
					//we have a stored file
					if (filenameStored !== '') {
						//put file in the queue and delete on save

						let filePath = persistentDir + mediaFolder;
						if (rootStore.device.platform === PARAMETERS.IOS) {
							if (!filePath.startsWith('file://')) {
								filePath = 'file://' + filePath;
							}
						}

						console.log('queue file -> ', filenameStored);
						rootStore.queueFilesToDelete.push({
							inputRef,
							filenameStored,
							file_path: filePath,
							project_ref: projectRef,
							file_name: filenameStored
						});
						//The actual deletion is done after the user save the entry
						//just remove from the UI the reference
						services.notificationService.hideProgressDialog();
						popoverController.dismiss(PARAMETERS.ACTIONS.FILE_QUEUED);
					} else {
						services.notificationService.hideProgressDialog();
						return false;
					}
				}
			},
			async remove() {
				//ask user for confirmation
				const confirmed = await services.notificationService.confirmSingle(
					labels.are_you_sure,
					labels.delete
				);

				if (confirmed) {
					if (rootStore.device.platform === PARAMETERS.PWA) {
						methods.removePWA();
					} else {
						methods.removeNative();
					}
				}
			}
		};

		const computedScope = {
			isPWA: computed(() => {
				return rootStore.device.platform === PARAMETERS.PWA;
			})
		};

		return {
			labels,
			...icons,
			...methods,
			...computedScope
		};
	}
};
</script>

<style lang="scss" scoped>
</style>