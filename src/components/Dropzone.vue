<template>
	<div
		class="dropzone"
		:class="{'dropzone-active' : state.isDraggingOver}"
	>
		<div v-bind="getRootProps()">
			<input v-bind="getInputProps()" />
			<div>Drop {{state.type}} file or click here.</div>
			<p><strong>{{state.acceptedFormats}}</strong></p>
		</div>
	</div>
	<div
		v-if="state.filesource !== '' && !state.loadingError"
		class="dropzone-preview ion-text-center"
	>
		<div
			slot="start"
			class="question-photo-thumbnail animate__animated animate__fadeIn ion-margin-top"
		>
			<ion-spinner
				class="spinner ion-margin-top"
				v-show="!state.previewLoaded"
				name="crescent"
			></ion-spinner>
			<img
				v-if="state.type === PARAMETERS.QUESTION_TYPES.PHOTO"
				v-show="state.previewLoaded"
				class="animate__animated animate__fadeIn"
				:src="state.filesource"
				@load="onImageLoaded()"
				@error="onError"
			>
			<audio
				v-if="state.type === PARAMETERS.QUESTION_TYPES.AUDIO"
				v-show="state.previewLoaded"
				controls
				class="animate__animated animate__fadeIn full-width"
				:src="state.filesource"
				@loadeddata="onAudioLoaded()"
				@error="onError"
			></audio>
			<video
				v-if="state.type === PARAMETERS.QUESTION_TYPES.VIDEO"
				v-show="state.previewLoaded"
				controls
				class="pwa-video animate__animated animate__fadeIn full-width"
				:src="state.filesource"
				@loadeddata="onVideoLoaded()"
				@error="onError"
			></video>
		</div>
	</div>
	<div v-if="state.loadingError">
		<ion-item
			lines="none"
			class="ion-text-center"
		>
			<ion-label color="danger">{{labels.unknown_error}}</ion-label>
		</ion-item>
	</div>
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import * as services from '@/services';
import { reactive, computed, toRaw } from '@vue/reactivity';
import { useDropzone } from 'vue3-dropzone';
import { projectModel } from '@/models/project-model';

export default {
	props: {
		filename: {
			type: String,
			required: true
		},
		filestate: {
			type: String,
			required: true
		},
		inputRef: {
			type: String,
			required: true
		},
		type: {
			type: String,
			required: true
		},
		uuid: {
			type: String,
			required: true
		}
	},
	emits: ['file-dropped', 'file-loaded'],
	setup(props, context) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;
		const formRef = projectModel.getFirstFormRef();
		const projectSlug = projectModel.getSlug();
		let filename = toRaw(props.filename);

		const state = reactive({
			type: props.type,
			isDraggingOver: false,
			dropMessage: '',
			filesource: '',
			previewLoaded: false,
			loadingError: false,
			acceptedFormats: PARAMETERS.PWA_FILE_ACCEPTED_FORMATS[props.type.toUpperCase()]
		});

		state.filesource =
			props.filename === '' ? '' : getMediaURL(props.filename, props.type, props.filestate);
		filename = props.filename === '' ? '' : props.filename;
		console.log(state.filesource);

		const dropzoneOptions = {
			onDrop: async function (acceptFiles, rejectReasons) {
				console.log(acceptFiles);
				console.log(rejectReasons);
				if (acceptFiles.length === 0) {
					//state.hasDropError = true;
					const message = rejectReasons[0].errors[0].message;
					services.notificationService.showAlert(message, labels.error);
					state.isDraggingOver = false;
					return false;
				} else {
					await services.notificationService.showProgressDialog(labels.wait, labels.uploading);

					//upload file
					const file = acceptFiles[0];
					// Get file extension from dropped file
					let ext = acceptFiles[0].name.split('.').pop();
					// Use jpg for all images
					if (state.type === PARAMETERS.QUESTION_TYPES.PHOTO) {
						ext = 'jpg';
					}

					//todo: we need to get it from the query string for hierarchy forms

					//get existing filename or generate new one
					if (props.filename === '') {
						filename = services.utilsService.generateMediaFilename(props.uuid, state.type);
					} else {
						filename = props.filename;
					}
					const payload = new FormData();
					const uploadData = services.JSONTransformerService.makeJsonFileEntry({
						entry_uuid: props.uuid,
						form_ref: formRef,
						file_name: filename,
						file_type: props.type,
						input_ref: props.inputRef,
						structure_last_updated: projectModel.getLastUpdated(),
						created_at: new Date().toISOString(),
						platform: PARAMETERS.WEB,
						device_id: ''
					});

					// Add stringified upload data to api request
					payload.append('data', JSON.stringify(uploadData));
					// Add file to api request
					payload.append('file', file);

					services.webService
						.uploadFilePWA(projectSlug, payload)
						.then(
							(response) => {
								console.log(response);
								//show preview
								services.notificationService.showToast(labels.file_uploaded);
								console.log(filename);

								state.filesource = getMediaURL(filename, props.type);
								console.log(state.filesource);
							},
							(error) => {
								//todo: handle error
								console.log(error);
							}
						)
						.finally(() => {
							services.notificationService.hideProgressDialog();
							state.isDraggingOver = false;
							context.emit('file-dropped', filename);
						});
				}
			},
			onDragEnter: function () {
				state.isDraggingOver = true;
			},
			onDragLeave: function () {
				state.isDraggingOver = false;
			},
			multiple: false,
			accept: PARAMETERS.PWA_MIMETYPES[props.type.toUpperCase()],
			maxSize: PARAMETERS.PWA_UPLOAD_MAX_SIZE[props.type.toUpperCase()],
			maxFiles: 1
		};

		const { getRootProps, getInputProps } = useDropzone(dropzoneOptions);

		const methods = {
			onImageLoaded() {
				state.previewLoaded = true;
				context.emit('file-loaded', filename);
			},
			onError(error) {
				state.previewLoaded = true;
				state.loadingError = true;
				console.log(error);
				//context.emit('file-loaded', filename);
			},
			onAudioLoaded() {
				state.previewLoaded = true;
				context.emit('file-loaded', filename);
			},
			onVideoLoaded() {
				console.log(filename);
				state.previewLoaded = true;
				context.emit('file-loaded', filename);
			}
		};

		function getMediaURL(filename, type, filestate) {
			const timestamp = services.utilsService.generateTimestamp();
			const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
			const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
			let mediaURL = rootStore.serverUrl;
			if (PARAMETERS.DEBUG) {
				//use debug endpoint (no csrf)
				if (filestate === PARAMETERS.PWA_FILE_STATE.CACHED) {
					mediaURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA + projectSlug;
				} else {
					//todo: get stored file
					mediaURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.MEDIA + projectSlug;
				}
			} else {
				if (filestate === PARAMETERS.PWA_FILE_STATE.CACHED) {
					mediaURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA + projectSlug;
				} else {
					//todo: get stored file
					mediaURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.MEDIA + projectSlug;
				}
			}

			switch (type) {
				case PARAMETERS.QUESTION_TYPES.AUDIO:
					mediaURL += '?format=audio';
					break;
				case PARAMETERS.QUESTION_TYPES.PHOTO:
					mediaURL += '?format=entry_original';
					break;
				case PARAMETERS.QUESTION_TYPES.VIDEO:
					mediaURL += '?format=video';
					break;
				default:
				//
			}

			mediaURL += '&name=' + filename;
			mediaURL += '&type=' + type;
			mediaURL += '&timestamp=' + timestamp;

			return mediaURL;
		}

		return {
			getRootProps,
			getInputProps,
			labels,
			state,
			PARAMETERS,
			...methods
		};
	}
};
</script>

<style lang="scss" scoped>
</style>