<template>
    <!--full screen block shown while a blocking operation runs (a file upload, a
        location geocode): dismissed by the caller when the operation is visually
        done. Always painted while the store reports isBlocking; its veil opacity
        comes from the store so each caller can pick its own dimming. No Teleport:
        as a direct child of ion-app it shares the stacking tree with Ionic's own
        overlays (ion-toast paints at z-index 60000+, above the overlay's 9999),
        and has no transformed ancestor to clip the fixed positioning-->
    <div
        class="wait-overlay"
        :class="{'wait-overlay--shown': waitOverlayStore.isBlocking}"
        :style="{background: background}"
    ></div>
</template>

<script>
import {computed} from 'vue';
import {useWaitOverlayStore} from '@/stores/wait-overlay-store.js';

//default veil when a caller sets no opacity
const DEFAULT_OPACITY = 0.5;

export default {
    name: 'WaitOverlay',
    setup() {
        const waitOverlayStore = useWaitOverlayStore();
        //the veil is white at the caller's opacity: a light one for a quick
        //geocode, a heavier one for an upload
        const background = computed(() => {
            const opacity = waitOverlayStore.overlayOpacity ?? DEFAULT_OPACITY;
            return 'rgba(255, 255, 255, ' + opacity + ')';
        });

        return {
            waitOverlayStore,
            background
        };
    }
};
</script>

<style src="@/theme/components/globals/WaitOverlay.scss" lang="scss" scoped></style>
