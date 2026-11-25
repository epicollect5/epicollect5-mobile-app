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
						class="question-action-button"
						color="secondary"
						expand="block"
						:disabled="isVideoCaptureActive"
						@click="shoot()"
					>
						<ion-icon
							slot="start"
							:icon="videocam"
						></ion-icon>
						{{ labels.shoot }}
					</ion-button>
				</template>
			</grid-question-narrow>

			<!-- Video Preview -->
			<grid-question-narrow>
				<template #content>
					<video
						v-show="state.fileSource !== ''"
						class="question-video-player"
						:src="state.fileSource"
						controls
					>
					</video>
				</template>
			</grid-question-narrow>
		</ion-card-content>
	</ion-card>
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import { videocam } from 'ionicons/icons';
import { computed } from '@vue/reactivity';
import { Capacitor } from '@capacitor/core';
import { videoShoot } from '@/use/questions/video-shoot';
import { notificationService } from '@/services/notification-service';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import GridQuestionNarrow from '@/components/GridQuestionNarrow';
import QuestionLabelAction from '@/components/QuestionLabelAction';

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
		let source = '';

		const projectRef = rootStore.entriesAddScope.entryService.entry.projectRef;
		const media = rootStore.entriesAddScope.entryService.entry.media;
		const mediaFile = media[props.entryUuid][state.inputDetails.ref];

		//show cached or stored video if any, Cached video will win over stored one
		if (mediaFile.cached !== '') {
			filename = mediaFile.cached;
			source = tempDir + filename;
			state.fileSource = Capacitor.convertFileSrc(source);
		} else {
			if (mediaFile.stored !== '') {
				filename = mediaFile.stored;
				source = persistentDir + PARAMETERS.VIDEO_DIR + projectRef + '/' + filename;
				state.fileSource = Capacitor.convertFileSrc(source);
			}
		}

		state.answer.answer = filename;

		const computedScope = {
			isFileAvailable: computed(() => {
				return mediaFile.cached !== '' || mediaFile.stored !== '';
			}),
			isVideoCaptureActive: computed(() => {
				return rootStore.isVideoCaptureActive;
			})
		};

		const methods = {
			async openPopover(e) {
				if (mediaFile.cached === '' && mediaFile.stored === '') {
					return false;
				}
				popoverMediaHandler({
					media,
					entryUuid: props.entryUuid,
					state,
					e,
					mediaType: PARAMETERS.QUESTION_TYPES.VIDEO
				});
			},
			async shoot() {
				if (rootStore.device.platform !== PARAMETERS.WEB) {
					try {
						await videoShoot({ media, entryUuid: props.entryUuid, state, filename });
					} catch (error) {
						//videoShoot rethrows modal presentation failures after unguarding
						//the back handler: surface them so a failed open is never silent
						console.log('videoShoot failed: ' + error);
						await notificationService.showAlert(error.message || labels.unknown_error);
					}
				}
			}
		};

		return {
			labels,
			state,
			...computedScope,
			...methods,
			//icons
			videocam
		};
	}
};
</script>

<style src="@/theme/components/platform/VideoNative.scss" lang="scss" scoped></style>
