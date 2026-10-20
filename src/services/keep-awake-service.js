import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';
import { useRootStore } from '@/stores/root-store';

//Hold the screen on for the duration of an upload or download when the user has
//opted in. Native only (no PWA wakeLock fallback): the goal is to stop the
//display sleeping so the app stays foregrounded and the WebView keeps running.
//Both halves are best-effort and never block or reject the transfer.
export const keepAwakeService = {

    async acquireTransferLock() {
        const rootStore = useRootStore();

        if (!rootStore.keepScreenOnDuringTransfer || !Capacitor.isNativePlatform()) {
            return;
        }

        try {
            await KeepAwake.keepAwake();
        } catch (error) {
            console.log('Failed to keep the screen awake: ' + error);
        }
    },

    async releaseTransferLock() {
        const rootStore = useRootStore();

        if (!rootStore.keepScreenOnDuringTransfer || !Capacitor.isNativePlatform()) {
            return;
        }

        try {
            await KeepAwake.allowSleep();
        } catch (error) {
            console.log('Failed to allow the screen to sleep: ' + error);
        }
    }
};
