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
</template>

<script>
import { STRINGS } from '@/config/strings.js';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';
import * as services from '@/services';
import { reactive, computed } from '@vue/reactivity';
import { useDropzone } from 'vue3-dropzone';
import { projectModel } from '@/models/project-model';
import axios from 'axios';

export default {
	props: {
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
	setup(props) {
		const rootStore = useRootStore();
		const language = rootStore.language;
		const labels = STRINGS[language].labels;

		const state = reactive({
			type: props.type,
			isDraggingOver: false,
			dropMessage: '',
			acceptedFormats: PARAMETERS.PWA_FILE_ACCEPTED_FORMATS[props.type.toUpperCase()]
		});

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
					await services.notificationService.showProgressDialog(labels.wait, labels.saving);

					//upload file
					const file = acceptFiles[0];
					// Get file extension from dropped file
					let ext = acceptFiles[0].name.split('.').pop();
					// Use jpg for all images
					if (state.type === PARAMETERS.QUESTION_TYPES.PHOTO) {
						ext = 'jpg';
					}

					// let answer = props.answer;
					// // If empty, create a new answer (file name)
					// if (props.answer === '') {
					// 	answer = generateMediaFilenameWeb(props.uuid, ext);
					// }
					//todo:
					//todo: we need to get it from the query string for hierarchy forms
					const formRef = projectModel.getFirstFormRef();
					const projectSlug = projectModel.getSlug();
					const answer = services.utilsService.generateMediaFilename(props.uuid, state.type);
					const payload = new FormData();
					const uploadData = services.JSONTransformerService.makeJsonFileEntry({
						entry_uuid: props.uuid,
						form_ref: formRef,
						file_name: answer,
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
							(filename) => {
								console.log(filename);
								//todo: show preview
							},
							(error) => {
								//todo: handle error
								console.log(error);
							}
						)
						.finally(() => {
							services.notificationService.hideProgressDialog();
							state.isDraggingOver = false;
						});

					//axios.post('/path/to/api', uploadData, {});

					//show file preview (img, audio, video tag)
					//todo:
				}
			},
			onDragEnter: function () {
				state.isDraggingOver = true;
			},
			onDragLeave: function () {
				state.isDraggingOver = false;
			},
			multiple: false,
			accept: PARAMETERS.PWA_MIMETYPES.PHOTO,
			maxSize: PARAMETERS.PWA_UPLOAD_MAX_SIZE.PHOTO,
			maxFiles: 1
		};

		const { getRootProps, getInputProps } = useDropzone(dropzoneOptions);

		return {
			getRootProps,
			getInputProps,
			labels,
			state
		};
	}
};
</script>

<style lang="scss" scoped>
</style>