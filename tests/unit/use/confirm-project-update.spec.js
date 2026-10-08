import { describe, it, expect, vi, beforeEach } from 'vitest';
import flushPromises from 'flush-promises';
import { setActivePinia, createPinia } from 'pinia';
import { alertController } from '@ionic/vue';
import { confirmProjectUpdate } from '@/use/project/confirm-project-update.js';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';

vi.mock('@ionic/vue', () => ({
    alertController: {
        create: vi.fn()
    }
}));

let alertOptions;

function mockAlertPresent() {
    alertController.create.mockImplementation(async (options) => {
        alertOptions = options;
        return {
            present: vi.fn().mockResolvedValue(),
            //keep the alert open: dismissal is driven per-test
            onDidDismiss: vi.fn().mockImplementation(() => new Promise(() => {}))
        };
    });
}

function openConfirm() {
    return confirmProjectUpdate();
}

describe('confirmProjectUpdate()', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        window.open = vi.fn();
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.device = { platform: 'android' };
    });

    it('shows the project-outdated prompt with Learn More, Cancel and Ok', async () => {
        mockAlertPresent();

        const pending = openConfirm();
        await flushPromises();
        const labels = STRINGS.en.labels;

        expect(alertOptions.header).toBe(labels.project_outdated);
        expect(alertOptions.message).toBe(labels.update_project);
        expect(alertOptions.buttons.map((button) => button.text)).toEqual([
            labels.learn_more,
            labels.cancel,
            labels.ok
        ]);
        expect(alertOptions.cssClass).toBe('alert-confirm-single-vertical-android');

        alertOptions.buttons[2].handler();
        await expect(pending).resolves.toBe(true);
    });

    it('opens the update docs without deciding the prompt', async () => {
        mockAlertPresent();

        const pending = openConfirm();
        await flushPromises();
        const learnMore = alertOptions.buttons[0];

        expect(learnMore.handler()).toBe(false);
        expect(window.open).toHaveBeenCalledWith(PARAMETERS.UPDATE_PROJECT_DOCS_URL, '_system', 'location=yes');

        //still pending: Learn More must not settle the confirm
        let settled = false;
        pending.then(() => {
            settled = true;
        });
        await flushPromises();
        expect(settled).toBe(false);

        //settle through cancel so the promise can finish
        alertOptions.buttons[1].handler();
        await expect(pending).resolves.toBe(false);
    });

    it('resolves false when the user cancels', async () => {
        mockAlertPresent();

        const pending = openConfirm();
        await flushPromises();
        alertOptions.buttons[1].handler();

        await expect(pending).resolves.toBe(false);
        expect(alertOptions.buttons[1].role).toBe('cancel');
    });

    it('settles as declined when the alert is dismissed without a button press', async () => {
        let dismissAlert;
        alertController.create.mockImplementation(async () => ({
            present: vi.fn().mockResolvedValue(),
            onDidDismiss: vi.fn().mockImplementation(() => new Promise((resolve) => {
                dismissAlert = resolve;
            }))
        }));

        const pending = openConfirm();
        await flushPromises();
        dismissAlert();

        await expect(pending).resolves.toBe(false);
    });

    it('settles as declined when the alert fails to present', async () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        alertController.create.mockRejectedValue(new Error('present failed'));

        await expect(confirmProjectUpdate()).resolves.toBe(false);

        logSpy.mockRestore();
    });
});
