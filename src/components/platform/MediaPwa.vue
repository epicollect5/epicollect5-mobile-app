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
			<dropzone
				:filestate="state.pwaFileState"
				:filename="state.answer.answer"
				:key="state.answer.answer"
				:type="state.inputDetails.type"
				:inputRef="state.inputDetails.ref"
				:uuid="entryUuid"
				:fileError="state.fileError"
				@file-loaded="onFileLoadedPWA"
				@file-dropped="onFileDroppedPWA"
				@file-error="onFileErrorPWA"
				@photo-clicked="openViewerPWA"
			></dropzone>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { defineAsyncComponent } from 'vue';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { computed } from '@vue/reactivity';
//swiper (inside ModalPhoto) is heavy: the modal chunk loads on first open
const ModalPhoto = defineAsyncComponent(() => import('@/components/modals/ModalPhoto.vue'));
import { modalController } from '@ionic/vue';
import Dropzone from '@/components/Dropzone';
import QuestionLabelAction from '@/components/QuestionLabelAction';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';

//PWA media card shared by photo, audio and video inputs. The input type is
//already in the question state (the Dropzone reads it from the same place),
//so the only per-type difference here is the photo viewer: photo-clicked is
//only emitted by an image preview
export default {
	components: {
		Dropzone,
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
		const state = props.parentState;
		const media = rootStore.entriesAddScope.entryService.entry.media;
		const mediaFile = media[props.entryUuid][state.inputDetails.ref];

		//ensure the PWA file fields exist (the wrapper only seeds the base slot)
		if (!Object.prototype.hasOwnProperty.call(mediaFile, 'filenamePWA')) {
			mediaFile.filenamePWA = {};
			mediaFile.filenamePWA.cached = '';
			mediaFile.filenamePWA.stored = '';
		}

		//show cached or stored file if any: cached wins over stored
		if (mediaFile.filenamePWA.cached !== '') {
			state.answer.answer = mediaFile.filenamePWA.cached;
			state.pwaFileState = PARAMETERS.PWA_FILE_STATE.CACHED;
		} else if (mediaFile.filenamePWA.stored !== '') {
			state.answer.answer = mediaFile.filenamePWA.stored;
			state.pwaFileState = PARAMETERS.PWA_FILE_STATE.STORED;
		}

		const computedScope = {
			isFileAvailable: computed(() => {
				return mediaFile.filenamePWA.cached !== '' || mediaFile.filenamePWA.stored !== '';
			})
		};

		const methods = {
			async openPopover(e) {
				if (mediaFile.filenamePWA.cached === '' && mediaFile.filenamePWA.stored === '') {
					return false;
				}
				try {
					await popoverMediaHandler({
						media,
						entryUuid: props.entryUuid,
						state,
						e,
						mediaType: state.inputDetails.type
					});
				} catch (error) {
					console.error('popoverMediaHandler failed', error);
				}
			},
			//file uploaded to server or stored file loaded
			onFileLoadedPWA(filename) {
				state.answer.answer = filename;
			},
			onFileDroppedPWA(filename) {
				//if a file is dropped, we have a cached file to show
				//(cached takes priority on stored, if any)
				mediaFile.filenamePWA.cached = filename;
				state.pwaFileState = PARAMETERS.PWA_FILE_STATE.CACHED;
				state.answer.answer = filename;
			},
			onFileErrorPWA(error) {
				state.fileError = error;
			},
			//open viewer to see image with zoom capabilities
			async openViewerPWA(fileURL) {
				try {
					const componentProps = {
						imageSource: fileURL,
						fileSource: fileURL,
						isPWA: true
					};
					const modal = await modalController.create({
						component: ModalPhoto,
						cssClass: 'modal-photo',
						componentProps
					});
					return await modal.present();
				} catch (error) {
					console.error('openViewerPWA failed', error);
				}
			}
		};

		return {
			state,
			...computedScope,
			...methods
		};
	}
};
</script>

<style src="@/theme/components/platform/MediaPwa.scss" lang="scss" scoped></style>
