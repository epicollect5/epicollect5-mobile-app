<template>
	<ion-card
		class="question-card"
		:class="{ 'animate__animated animate__fadeIn': !isGroupInput }"
	>
		<ion-card-header class="question-label force-no-padding">
			<ion-card-title>
				<question-label-action
					:key="state.answer.answer"
					:disabled="!isFileAvailable"
					action="media"
					:questionText="state.question"
					:answer="state.answer.answer"
					@on-label-button-click="openPopover"
				></question-label-action>
			</ion-card-title>
		</ion-card-header>
		<ion-card-content
			class="ion-text-center"
			:class="{ 'ion-margin': isGroupInput }"
		>
			<grid-question-narrow>
				<template #content>
					<ion-button
						class="question-action-button ion-text-nowrap"
						color="secondary"
						expand="block"
						@click="takePicture('camera')"
					>
						<ion-icon
							slot="start"
							:icon="camera"
						></ion-icon>
						{{ labels.take }}
					</ion-button>
				</template>
			</grid-question-narrow>

			<grid-question-narrow>
				<template #content>
					<ion-button
						class="question-action-button ion-margin-top ion-text-nowrap"
						color="secondary"
						expand="block"
						@click="takePicture('gallery')"
					>
						<ion-icon
							slot="start"
							:icon="images"
						></ion-icon>
						{{ labels.pick }}
					</ion-button>
				</template>
			</grid-question-narrow>

			<!-- Photo thumbnail -->
			<div
				v-if="state.imageSource !== ''"
				class="question-photo-thumbnail animate__animated animate__fadeIn ion-margin-top"
			>
				<img
					:src="state.imageSource"
					@click="openViewer()"
					@load="onImageLoad()"
					:alt="state.question"/>
			</div>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import { modalController } from '@ionic/vue';
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { camera, images } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import { Capacitor } from '@capacitor/core';
//swiper (inside ModalPhoto) is heavy: the modal chunk loads on first open
const ModalPhoto = defineAsyncComponent(() => import('@/components/modals/ModalPhoto.vue'));
import ModalDraw from '@/components/modals/ModalDraw.vue';
import { photoTake } from '@/use/questions/photo-take';
import { saveBlobToTempDir } from '@/services/filesystem/save-blob-to-temp-service';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { rollbarService } from '@/services/utilities/rollbar-service';

export default {
	components: {
		GridQuestionNarrow,
		QuestionLabelAction
	},
	props: {
		parentState: {
			type: Object,
			required: true
		},
		entryUuid: {
			type: String,
			required: true
		},
		isGroupInput: {
			type: Boolean,
			required: true
		}
	},
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const state = props.parentState;

		const tempDir = rootStore.tempDir;
		const persistentDir = rootStore.persistentDir;
		let filename = '';
		const project_ref = rootStore.entriesAddScope.entryService.entry.projectRef;
		const media = rootStore.entriesAddScope.entryService.entry.media;
		const mediaFile = media[props.entryUuid][state.inputDetails.ref];

		//show cached or stored image if any, Cached image will win over stored one
		if (mediaFile.cached !== '') {
			filename = mediaFile.cached;
			_loadImageOnView(tempDir + filename);
		} else {
			if (mediaFile.stored !== '') {
				filename = mediaFile.stored;
				_loadImageOnView(persistentDir + PARAMETERS.PHOTO_DIR + project_ref + '/' + filename);
			}
		}

		state.answer.answer = filename;

		function _loadImageOnView(source) {
			const timestamp = utilsService.generateTimestamp();
			state.fileSource = source;
			//fix for WKWebView and Android 11+ as well
			source = Capacitor.convertFileSrc(source);
			//use a timestamp to refresh image
			state.imageSource = source + '?t=' + timestamp;
		}

		const computedScope = {
			isFileAvailable: computed(() => {
				return mediaFile.cached !== '' || mediaFile.stored !== '';
			})
		};

		const methods = {
			async openPopover(e) {
				//imp: a draw save is pending while the pad is already dismissed
				//(released only after the save settles): its completion would
				//overwrite whatever this popover changes or deletes
				if (rootStore.isDrawModalActive) {
					return false;
				}
				if (mediaFile.cached === '' && mediaFile.stored === '') {
					return false;
				}
				try {
					await popoverMediaHandler({
						media,
						entryUuid: props.entryUuid,
						state,
						e,
						mediaType: PARAMETERS.QUESTION_TYPES.PHOTO,
						//the media popover gains a Draw entry on top of share/delete;
						//it dismisses with the DRAW action and the pad opens from here
						onAction: (action) => {
							if (action === PARAMETERS.ACTIONS.DRAW) {
								return methods.openDrawPad();
							}
						}
					});
				} catch (error) {
					console.error('popoverMediaHandler failed', error);
				}
			},
			async openDrawPad() {
				if ([PARAMETERS.WEB, PARAMETERS.PWA].includes(rootStore.device.platform) || rootStore.isPWA) {
					return;
				}

				//imp: claim the workflow lock before the first await: two overlapping
				//opens would otherwise both pass the guard while the first image
				//fetch is pending, opening two pads that save over the same file.
				//Released on every failure path below and after the save settles
				//(see onDidDismiss finally); a second open sharing the .tmp/.bak
				//staging files with an in-flight save would lose a drawing or break
				//the iOS restore
				if (rootStore.isDrawModalActive) {
					return;
				}
				rootStore.isDrawModalActive = true;

				let existingDataURL = '';
				let imageLoadFailed = false;
				if (mediaFile.cached !== '') {
					try {
						const source = Capacitor.convertFileSrc(tempDir + mediaFile.cached);
						const response = await fetch(source);
						const blob = await response.blob();
						existingDataURL = await new Promise((resolve, reject) => {
							const reader = new FileReader();
							reader.onloadend = () => resolve(reader.result);
							reader.onerror = () => reject(reader.error);
							reader.readAsDataURL(blob);
						});
					} catch (error) {
						console.warn('Failed to load existing drawing for editing', error);
						rollbarService.critical(error);
						imageLoadFailed = true;
					}
				} else if (mediaFile.stored !== '') {
					try {
						const source = Capacitor.convertFileSrc(
							persistentDir + PARAMETERS.PHOTO_DIR + project_ref + '/' + mediaFile.stored
						);
						const response = await fetch(source);
						const blob = await response.blob();
						existingDataURL = await new Promise((resolve, reject) => {
							const reader = new FileReader();
							reader.onloadend = () => resolve(reader.result);
							reader.onerror = () => reject(reader.error);
							reader.readAsDataURL(blob);
						});
					} catch (error) {
						console.warn('Failed to load stored photo for drawing', error);
						rollbarService.critical(error);
						imageLoadFailed = true;
					}
				}

				//do not open a blank canvas: the user would unknowingly replace the
				//original photo with a drawing on white when saving
				if (imageLoadFailed) {
					rootStore.isDrawModalActive = false;
					return;
				}

				let drawModal;
				try {
					drawModal = await modalController.create({
						component: ModalDraw,
						cssClass: 'modal-draw',
						showBackdrop: true,
						backdropDismiss: false,
						componentProps: {existingDataURL}
					});
				} catch (error) {
					rootStore.isDrawModalActive = false;
					throw error;
				}

				//imp: onDidDismiss runs in the background; the single finally below
				//is the only place that releases the lock, so any throw between the
				//dataURL check and the save try/catch (e.g. generateMediaFilename) is
				//covered and reported, and the lock never gets stuck
				drawModal.onDidDismiss().then(async (response) => {
					try {
						if (!response || !response.data || !response.data.dataURL) {
							return;
						}
						const dataURL = response.data.dataURL;

						//shared pick-rules with photo-take: reuse cached on retake,
						//stored on edit, generate only for a brand-new file
						const newFilename = utilsService.resolvePhotoFilename(mediaFile, props.entryUuid);

						const prevCached = mediaFile.cached;
						const prevAnswer = state.answer.answer;

						try {
							const blob = utilsService.b64toBlob(dataURL, 'image/jpeg');
							await saveBlobToTempDir({blob, filename: newFilename});
							mediaFile.cached = newFilename;
							state.answer.answer = newFilename;
							_loadImageOnView(tempDir + newFilename);
						} catch (error) {
							console.error('Failed to save drawing to temp dir', error);
							rollbarService.critical(error);
							//imp: the service could not restore the original; its
							//bytes live at <newFilename>.bak. Point the answer at
							//that copy so the attachment remains available
							if (error && error.code === 'RECOVERABLE_BACKUP' && error.recoverableFilename) {
								mediaFile.cached = error.recoverableFilename;
								state.answer.answer = error.recoverableFilename;
								_loadImageOnView(tempDir + error.recoverableFilename);
							} else {
								mediaFile.cached = prevCached;
								state.answer.answer = prevAnswer;
							}
							await notificationService.showAlert(
								labels.unknown_error,
								labels.error
							);
						}
					} catch (error) {
						//imp: any throw outside the save try/catch (filename
						//generation, media writes, etc.) is caught here so it never
						//becomes an unhandled rejection and the lock still releases
						console.error('onDidDismiss handler failed', error);
						rollbarService.critical(error);
					} finally {
						//imp: release the workflow lock on every dismissal path, so
						//a reopen cannot share the .tmp/.bak files with this save
						rootStore.isDrawModalActive = false;
					}
				});

				try {
					return await drawModal.present();
				} catch (error) {
					rootStore.isDrawModalActive = false;
					rollbarService.critical(error);
					throw error;
				}
			},
			async takePicture(action) {
				//imp: same pending-save window as openPopover: a capture landing
				//in it would be overwritten by the draw save still settling
				if (rootStore.isDrawModalActive) {
					return;
				}
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					try {
						await photoTake({media, entryUuid: props.entryUuid, state, filename, action});
					} catch (error) {
						//photoTake rethrows modal presentation failures after unguarding
						//the back handler: surface them so a failed open is never silent
						console.log('photoTake failed: ' + error);
						await notificationService.showAlert(error.message || labels.unknown_error);
					}
				}
			},
			//open viewer to see image with zoom capabilities
			async openViewer() {
				try {
					const componentProps = {
						imageSource: state.imageSource,
						fileSource: state.fileSource,
						isPWA: false
					};

					const modal = await modalController.create({
						component: ModalPhoto,
						cssClass: 'modal-photo',
						componentProps
					});
					return await modal.present();
				} catch (error) {
					console.error('openViewer failed', error);
				}
			},
			onImageLoad() {
				notificationService.hideProgressDialog();
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			camera,
			images
		};
	}
};
</script>

<style src="@/theme/components/platform/PhotoNative.scss" lang="scss" scoped></style>
