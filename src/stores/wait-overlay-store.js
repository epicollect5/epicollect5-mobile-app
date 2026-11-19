import { defineStore } from 'pinia';

//Shared state for the media upload wait overlay (WaitOverlay.vue): the overlay
//outlives the Dropzone instance that started the upload (the answer changes when
//the file lands, so the component is replaced), so the flag lives at app level
//and is owned by the upload request, never by a preview load event: an audio or
//video element only loads once it is visible, so its loadeddata can never be the
//signal that releases the screen
export const useWaitOverlayStore = defineStore('WaitOverlayStore', {
    state: () => {
        return {
            //true while an upload request is in flight: the overlay blocks the
            //whole screen
            isUploading: false
        };
    },
    getters: {},

    actions: {
        show() {
            this.isUploading = true;
        },
        dismiss() {
            this.isUploading = false;
        }
    }
});
