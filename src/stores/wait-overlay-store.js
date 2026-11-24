import { defineStore } from 'pinia';

//Shared state for the full screen wait overlay (WaitOverlay.vue). The overlay
//is painted whenever isBlocking is true, and EntriesAdd's prev()/next() and the
//hardware back handler ignore navigation while it is set. Two callers share it:
//- a Dropzone upload, whose state cannot live in the component (the instance is
//  REPLACED when the uploaded file lands, so the store hands it over to the
//  remounted one)
//- a LocationPwa geocode, which keeps its question mounted and dismisses it
//  itself once the answer is written
export const useWaitOverlayStore = defineStore('WaitOverlayStore', {
    state: () => {
        return {
            //true while a blocking operation is in flight or, for an upload, the
            //uploaded file preview has not loaded yet: the overlay covers the
            //whole screen
            isBlocking: false,
            //dimming of the overlay for the operation in flight, so a short call
            //(a geocode) can use a lighter veil than an upload
            overlayOpacity: null,
            //preview key of the uploaded file (see Dropzone.vue): the remounted
            //instance that loads this preview owns the dismissal
            pendingKey: null
        };
    },
    getters: {},

    actions: {
        //opacity is optional: leave it out for the default veil
        show(opacity = null) {
            this.isBlocking = true;
            this.overlayOpacity = opacity;
            this.pendingKey = null;
        },
        setPendingKey(key) {
            this.pendingKey = key;
        },
        dismiss() {
            this.isBlocking = false;
            this.overlayOpacity = null;
            this.pendingKey = null;
        }
    }
});
