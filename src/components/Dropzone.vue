<!--suppress JSUnusedGlobalSymbols -->
<template>
  <div
      class="dropzone"
      :class="{'dropzone-active' : state.isDraggingOver}"
  >
    <div v-bind="getRootProps()">
      <input v-bind="getInputProps()"/>
      <div>Drop {{ state.type }} file or click here.</div>
      <p><strong>{{ state.acceptedFormats }}</strong></p>
    </div>
  </div>
  <div
      v-if="state.filesource !== '' && !state.loadingError"
      class="dropzone-preview ion-text-center"
  >
    <div
        slot="start"
        class="question-photo-thumbnail animate__animated animate__fadeIn ion-margin-top"
        :class="{'question-photo-thumbnail--third': state.type === PARAMETERS.QUESTION_TYPES.PHOTO}"
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
          @click="onClick"
          :alt="PARAMETERS.QUESTION_TYPES.PHOTO"
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
      <ion-label color="danger">{{ props.fileError }}</ion-label>
    </ion-item>
  </div>
  <!--the full screen upload overlay is WaitOverlay.vue, mounted once in
      App.vue: its state survives this component being replaced on upload-->
</template>

<script>
import {STRINGS} from '@/config/strings.js';
import {PARAMETERS} from '@/config';
import {useRootStore} from '@/stores/root-store';
import {useWaitOverlayStore} from '@/stores/wait-overlay-store';
import {reactive, toRaw} from 'vue';
import {useDropzone} from 'vue3-dropzone';
import {projectModel} from '@/models/project-model';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {webService} from '@/services/web-service';
import {JSONTransformerService} from '@/services/utilities/json-transformer-service';
import {errorsService} from '@/services/errors-service';

//cache busting version per filename, for temp-media only: a replacement upload
//overwrites the same name there, so only an actual upload may change the
//version. Stored media needs none: the server versions it (v=updated_at) and
//serves it immutable, so a client side buster there would only bypass that
//cache on every mount
const mediaPreviewVersions = new Map();

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
    fileError: {
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
  emits: ['file-dropped', 'file-loaded', 'file-error', 'photo-clicked'],
  setup(props, context) {
    const rootStore = useRootStore();
    const waitOverlayStore = useWaitOverlayStore();
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
        props.filename === '' ? '' : getMediaUrlPWA(props.filename, props.type, props.filestate);
    filename = props.filename === '' ? '' : props.filename;

    //audio and video previews are players, not images: they need no decode to be
    //usable, and a display:none media element is not fetched at all, so they are
    //rendered as soon as their url is known. A photo does have to decode, and
    //stays behind the spinner until its @load fires
    const rendersAsPlayer = state.type === PARAMETERS.QUESTION_TYPES.AUDIO
        || state.type === PARAMETERS.QUESTION_TYPES.VIDEO;
    if (rendersAsPlayer && state.filesource !== '') {
      state.previewLoaded = true;
    }

    const dropzoneOptions = {
      onDrop: async function (acceptFiles, rejectReasons) {
        console.log(acceptFiles);
        console.log(rejectReasons);
        if (acceptFiles.length === 0) {
          //state.hasDropError = true;
          const rejection = rejectReasons?.[0]?.errors?.[0];
          const message = utilsService.getDropzoneRejectionMessage(rejection, state.type, labels.unknown_error);
          await notificationService.showAlert(message, labels.error);
          state.isDraggingOver = false;
          return false;
        } else {
          //upload file
          const file = acceptFiles[0];

          //the overlay goes up BEFORE any await below: the entry navigation
          //guards check isUploading, so the question must stay mounted from
          //here until the upload lands or fails
          waitOverlayStore.show();

          //the warning toast mounts and presents while the overlay is already
          //covering the screen, above it (IonToast paints at z-index 60000+)
          await notificationService.showWarningToast(labels.uploading_file_wait);

          //todo: we need to get it from the query string for hierarchy forms

          //get an existing filename or generate a new one
          if (props.filename === '') {
            filename = utilsService.generateMediaFilename(props.uuid, state.type);
          } else {
            filename = props.filename;
          }
          const payload = new FormData();
          const uploadData = JSONTransformerService.makeJsonFileEntry({
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
          // Add a file to an api request
          payload.append('file', file);

          webService
              .uploadFilePWA(projectSlug, payload)
              .then(
                  (response) => {
                    console.log(response);

                    //the upload landed: release the screen now. The media tag
                    //cannot be the release signal: an audio or video element is
                    //only fetched once it is visible, so its loadeddata event may
                    //never fire at all (see rendersAsPlayer above)
                    releaseUploadUi();

                    //the upload replaced the bytes behind this filename (a
                    //replacement keeps the name): bump its preview version so
                    //every mount from now on bypasses the cached copy
                    mediaPreviewVersions.set(filename, Date.now());

                    //only refresh inline when no remount is coming: the answer
                    //(and the component :key) keeps the same filename, which also
                    //covers a stored attachment being replaced (its filestate
                    //flips from stored to cached, so no remount happens for it)
                    if (filename === props.filename) {
                        //a photo has to decode before it is shown, so it stays
                        //hidden behind the spinner until @load fires; a player is
                        //already visible and must not be hidden again
                        if (!rendersAsPlayer) {
                            state.previewLoaded = false;
                        }
                        state.filesource = getMediaUrlPWA(filename, props.type, PARAMETERS.PWA_FILE_STATE.CACHED);
                    }
                    state.loadingError = false;
                  },
                  async (error) => {
                    //todo: handle error
                    //the upload failed: release the screen and report it
                    releaseUploadUi();
                    const fileError = await errorsService.handleWebError(error);
                    context.emit('file-error', fileError);
                    console.log(error);
                  }
              )
              .finally(() => {
                context.emit('file-dropped', filename);
                setTimeout(() => {
                  state.isDraggingOver = false;
                }, PARAMETERS.DELAY_LONG);
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

    const {getRootProps, getInputProps} = useDropzone(dropzoneOptions);

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
      onClick() {
        context.emit('photo-clicked', state.filesource);
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

    //the upload UI (full screen overlay + top warning toast) belongs to the
    //upload request alone: it goes up when the file is dropped and comes down
    //when the request settles, for every media type
    function releaseUploadUi() {
      waitOverlayStore.dismiss();
      notificationService.dismissWarningToast();
    }

    function getMediaUrlPWA(filename, type, filestate) {
      const version = filestate === PARAMETERS.PWA_FILE_STATE.CACHED
          ? mediaPreviewVersions.get(filename)
          : undefined;
      const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
      const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
      let mediaUrl = rootStore.serverUrl;

      if (PARAMETERS.DEBUG) {
        //use debug endpoint (no csrf)
        if (filestate === PARAMETERS.PWA_FILE_STATE.CACHED) {
          mediaUrl += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA_DEBUG + projectSlug;
        } else {
          //if a branch and local, get the file from temp media
          if (rootStore.branchEditType === PARAMETERS.PWA_BRANCH_LOCAL) {
            mediaUrl += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA_DEBUG + projectSlug;
          } else {
            //if a branch but remote, the stored file is in media
            mediaUrl += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.MEDIA_DEBUG + projectSlug;
          }
        }
      } else {
        if (filestate === PARAMETERS.PWA_FILE_STATE.CACHED) {
          mediaUrl += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA + projectSlug;
        } else {
          //if a branch and local, get the file from temp media
          if (rootStore.branchEditType === PARAMETERS.PWA_BRANCH_LOCAL) {
            mediaUrl += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA + projectSlug;
          } else {
            mediaUrl += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.MEDIA + projectSlug;
          }
        }
      }

      switch (type) {
        case PARAMETERS.QUESTION_TYPES.AUDIO:
          mediaUrl += '?format=audio';
          break;
        case PARAMETERS.QUESTION_TYPES.PHOTO:
          mediaUrl += '?format=entry_original';
          break;
        case PARAMETERS.QUESTION_TYPES.VIDEO:
          mediaUrl += '?format=video';
          break;
        default:
          //
      }

      mediaUrl += '&name=' + filename;
      mediaUrl += '&type=' + type;
      if (version !== undefined) {
        mediaUrl += '&timestamp=' + version;
      }

      return mediaUrl;
    }

    return {
      getRootProps,
      getInputProps,
      labels,
      state,
      PARAMETERS,
      props,
      ...methods
    };
  }
};
</script>

<style src="@/theme/components/Dropzone.scss" lang="scss" scoped></style>
