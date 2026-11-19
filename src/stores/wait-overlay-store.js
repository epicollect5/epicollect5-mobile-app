import { defineStore } from 'pinia';

//Shared state for the media upload wait overlay (WaitOverlay.vue): a Dropzone
//instance is REPLACED when its uploaded file lands (the answer changes, and so
//does the component :key), so the overlay state cannot live in the component:
//an app-level store hands it over to the remounted instance seamlessly
export const useWaitOverlayStore = defineStore('WaitOverlayStore', {
    state: () => {
        return {
            //true while an upload is in flight or the uploaded file preview has
            //not loaded yet: the overlay blocks the whole screen
            isUploading: false,
            //preview key of the uploaded file (see Dropzone.vue): the remounted
            //instance that loads this preview owns the dismissal
            pendingKey: null
        };
    },
    getters: {},

    actions: {
        show() {
            this.isUploading = true;
            this.pendingKey = null;
        },
        setPendingKey(key) {
            this.pendingKey = key;
        },
        dismiss() {
            this.isUploading = false;
            this.pendingKey = null;
        }
    }
});
