import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import flushPromises from 'flush-promises';
import Settings from '@/pages/Settings.vue';
import { PARAMETERS } from '@/config';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { notificationService } from '@/services/notification-service';

const rootStoreMock = vi.hoisted(() => ({
    language: 'en',
    serverUrl: 'https://five.epicollect.net',
    selectedTextSize: '0',
    collectErrors: true,
    inAppCamera: false,
    inAppCameraVideo: false,
    device: { platform: 'android' },
    app: { name: 'Epicollect5', version: '1.0.0' },
    easterEgg: false,
    nextRoute: 'projects',
    routeParams: {}
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: () => rootStoreMock
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: vi.fn() })
}));

vi.mock('@ionic/vue', () => ({
    useBackButton: vi.fn()
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: { insertSetting: vi.fn() }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn().mockResolvedValue(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn(),
        showToast: vi.fn()
    }
}));

vi.mock('@/services/utilities/rollbar-service', () => ({
    rollbarService: { configure: vi.fn() }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                unknown_error: 'Unknown error',
                error: 'Error'
            },
            status_codes: { ec5_123: 'Settings saved' }
        }
    }
}));

function mountSettings() {
    return shallowMount(Settings, {
        global: {
            stubs: {
                'base-layout': { template: '<div><slot name="content" /></div>' },
                'ion-button': true,
                'ion-buttons': true,
                'ion-card': true,
                'ion-card-content': true,
                'ion-card-header': true,
                'ion-card-title': true,
                'ion-icon': true,
                'ion-item': true,
                'ion-label': true,
                'ion-menu-button': true,
                'ion-range': true,
                'ion-toggle': true,
                'ion-toolbar': true
            }
        }
    });
}

describe('Settings page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rootStoreMock.language = 'en';
        rootStoreMock.serverUrl = 'https://five.epicollect.net';
        rootStoreMock.selectedTextSize = '0';
        rootStoreMock.collectErrors = true;
        rootStoreMock.inAppCamera = false;
        rootStoreMock.inAppCameraVideo = false;
        databaseInsertService.insertSetting.mockResolvedValue();
    });

    it('awaits every preference write before reporting success', async () => {
        const wrapper = mountSettings();

        await wrapper.vm.saveSettings();
        await flushPromises();

        const expectedKeys = Object.values(PARAMETERS.SETTINGS_KEYS);
        expect(databaseInsertService.insertSetting).toHaveBeenCalledTimes(expectedKeys.length);
        for (const key of expectedKeys) {
            expect(databaseInsertService.insertSetting).toHaveBeenCalledWith(key, expect.anything());
        }
        //the progress dialog hides only after the last write settles
        const lastInsertOrder = Math.max(...databaseInsertService.insertSetting.mock.invocationCallOrder);
        expect(notificationService.hideProgressDialog.mock.invocationCallOrder[0]).toBeGreaterThan(lastInsertOrder);
        expect(notificationService.showToast).toHaveBeenCalled();
        expect(notificationService.showAlert).not.toHaveBeenCalled();
        //camera flags reach the shared store only via the successful save
        expect(rootStoreMock.inAppCamera).toBe(false);
        expect(rootStoreMock.inAppCameraVideo).toBe(false);
    });

    it('reports an error when a camera preference write fails', async () => {
        databaseInsertService.insertSetting.mockImplementation((key) => {
            if (key === PARAMETERS.SETTINGS_KEYS.IN_APP_CAMERA) {
                return Promise.reject(new Error('db locked'));
            }
            return Promise.resolve();
        });
        const wrapper = mountSettings();
        wrapper.vm.state.inAppCamera = true;

        await wrapper.vm.saveSettings();
        await flushPromises();

        expect(notificationService.showAlert).toHaveBeenCalled();
        expect(notificationService.showToast).not.toHaveBeenCalled();
        //the failed write never reaches the shared store
        expect(rootStoreMock.inAppCamera).toBe(false);
    });

    it('keeps camera toggles local until the save succeeds', async () => {
        const wrapper = mountSettings();

        wrapper.vm.updateInAppCamera({ detail: { checked: true } });
        wrapper.vm.updateInAppCameraVideo({ detail: { checked: true } });

        expect(wrapper.vm.state.inAppCamera).toBe(true);
        expect(wrapper.vm.state.inAppCameraVideo).toBe(true);
        expect(rootStoreMock.inAppCamera).toBe(false);
        expect(rootStoreMock.inAppCameraVideo).toBe(false);

        await wrapper.vm.saveSettings();
        await flushPromises();

        expect(rootStoreMock.inAppCamera).toBe(true);
        expect(rootStoreMock.inAppCameraVideo).toBe(true);
    });

    it('points the Learn more action at the published embedded-camera docs', async () => {
        expect(PARAMETERS.IN_APP_CAMERA_DOCS_URL).toBe(
            'https://docs.epicollect.net/mobile-application/mobile-application#embedded-camera'
        );
    });
});
