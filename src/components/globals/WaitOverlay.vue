<template>
    <!--full screen block while a file uploads: dismissed when the media tag has
        loaded the file (never shown for cached files on navigation). No Teleport:
        as a direct child of ion-app it shares the stacking tree with Ionic's own
        overlays (ion-toast paints at z-index 60000+, above the overlay's 9999),
        and has no transformed ancestor to clip the fixed positioning-->
    <div
        class="wait-overlay"
        :class="{'wait-overlay--shown': waitOverlayStore.isUploading}"
    ></div>
</template>

<script>
import {useWaitOverlayStore} from '@/stores/wait-overlay-store.js';

export default {
    name: 'WaitOverlay',
    setup() {
        const waitOverlayStore = useWaitOverlayStore();

        return {
            waitOverlayStore
        };
    }
};
</script>

<style src="@/theme/components/pwa/WaitOverlay.scss" lang="scss" scoped></style>
