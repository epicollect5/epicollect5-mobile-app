import { vi } from 'vitest';
import { notificationService } from '@/services/notification-service';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model';
import { useDBStore } from '@/stores/db-store';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { alertController } from '@ionic/vue';
import { STRINGS } from '@/config/strings';


const mocks = vi.hoisted(() => {
    return {
        presentMock: vi.fn().mockResolvedValue(true),
        checkPermissionsMock: vi.fn().mockResolvedValue({receive: 'granted'}),
        requestPermissionsMock: vi.fn(),
        createNotificationChannelMock: vi.fn().mockResolvedValue(),
        startForegroundServiceMock: vi.fn().mockResolvedValue(),
        stopForegroundServiceMock: vi.fn().mockResolvedValue(),
        nativeSettingsOpenMock: vi.fn(),
        selectSettingMock: vi.fn().mockResolvedValue({rows: {length: 0, item: () => ({})}}),
        insertSettingMock: vi.fn().mockResolvedValue()
    };
});

vi.mock('@capacitor/push-notifications', () => ({
    PushNotifications: {
        checkPermissions: mocks.checkPermissionsMock,
        requestPermissions: mocks.requestPermissionsMock
    }
}));

vi.mock('capacitor-native-settings', () => ({
    NativeSettings: {
        openAndroid: mocks.nativeSettingsOpenMock
    },
    AndroidSettings: {
        AppNotification: 'app_notification'
    }
}));

vi.mock('@/services/database/database-select-service', () => ({
    databaseSelectService: {
        selectSetting: mocks.selectSettingMock
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: {
        insertSetting: mocks.insertSettingMock
    }
}));

vi.mock('@capawesome-team/capacitor-android-foreground-service', () => ({
    ForegroundService: {
        createNotificationChannel: mocks.createNotificationChannelMock,
        startForegroundService: mocks.startForegroundServiceMock,
        stopForegroundService: mocks.stopForegroundServiceMock
    },
    Importance: {Low: 'low'}
}));

vi.mock('@ionic/vue', () => {
    const alertController = vi.fn();
    alertController.create = vi.fn().mockResolvedValue({
        present: mocks.presentMock
    });
    return { alertController };
});

describe('notificationService tests', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it('should call alertController with non-empty header and message', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = 'Test message';
        const header = 'Test header';

        await notificationService.showAlert(message, header);

        expect(alertController.create).toHaveBeenCalledWith({
            header: header,
            message: message,
            buttons: [STRINGS[language].labels.ok]
        });

        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should default header to error string if header is not provided', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = 'Test message';

        await notificationService.showAlert(message);

        expect(alertController.create).toHaveBeenCalledWith({
            header: '',
            message: message,
            buttons: [STRINGS[language].labels.ok]
        });
        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should convert message to string if it is not a string', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = { key: 'value' };
        const header = 'Test header';

        await notificationService.showAlert(message, header);

        expect(alertController.create).toHaveBeenCalledWith({
            header: header,
            message: JSON.stringify(message),
            buttons: [STRINGS[language].labels.ok]
        });
        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should convert message to string if null', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = null;
        const header = 'Test header';

        await notificationService.showAlert(message, header);

        expect(alertController.create).toHaveBeenCalledWith({
            header: header,
            message: JSON.stringify(message),
            buttons: [STRINGS[language].labels.ok]
        });
        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should create a confirm alert with dismiss and action buttons and call the action handler', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = 'Test confirmation message';
        const title = 'Test title';
        const actionHandler = vi.fn();

        const promise = notificationService.confirmChoice(message, title, [
            {text: 'Action', handler: actionHandler}
        ]);
        const createdButtons = [...alertController.create.mock.calls[0][0].buttons];

        expect(createdButtons).toEqual([
            {
                text: STRINGS[language].labels.dismiss,
                role: 'cancel',
                handler: expect.any(Function)
            },
            {
                text: 'Action',
                handler: expect.any(Function)
            }
        ]);

        createdButtons[1].handler();
        const result = await promise;
        expect(result).toBe(true);
        expect(actionHandler).toHaveBeenCalledTimes(1);
        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should resolve false and not call the action handler when dismissed', async () => {
        const message = 'Test confirmation message';
        const title = 'Test title';
        const actionHandler = vi.fn();

        const promise = notificationService.confirmChoice(message, title, [
            {text: 'Action', handler: actionHandler}
        ]);

        const dismissButton = alertController.create.mock.calls[0][0].buttons[0];
        dismissButton.handler();
        const resolved = await promise;

        expect(resolved).toBe(false);
        expect(actionHandler).not.toHaveBeenCalled();
    });

    it('should create a confirm alert with only the dismiss button if no action buttons are provided', async () => {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const message = 'Test confirmation message';
        const title = 'Test title';

        const promise = notificationService.confirmChoice(message, title);

        const dismissButton = alertController.create.mock.calls[0][0].buttons[0];
        dismissButton.handler();
        await promise;

        expect(alertController.create).toHaveBeenCalledWith({
            header: title,
            message: message,
            buttons: [
                {
                    text: STRINGS[language].labels.dismiss,
                    role: 'cancel',
                    handler: expect.any(Function)
                }
            ]
        });
        expect(mocks.presentMock).toHaveBeenCalled();
    });

    it('should propagate foreground service startup errors', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const error = new Error('foreground service failed');
        mocks.startForegroundServiceMock.mockRejectedValueOnce(error);

        await expect(notificationService.startForegroundService()).rejects.toBe(error);
    });

    it('should propagate notification channel creation errors', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const error = new Error('notification channel failed');
        mocks.createNotificationChannelMock.mockRejectedValueOnce(error);

        await expect(notificationService.startForegroundService()).rejects.toBe(error);
    });

    it('should propagate permission check errors', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        const error = new Error('permission check failed');
        mocks.checkPermissionsMock.mockRejectedValueOnce(error);

        await expect(notificationService.startForegroundService()).rejects.toBe(error);
    });

    it('should resolve after starting the foreground service', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;

        await expect(notificationService.startForegroundService()).resolves.toBe('granted');
    });

    it('should skip foreground service startup on non-Android platforms', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = 'ios';

        await expect(notificationService.startForegroundService()).resolves.toBeUndefined();
        expect(mocks.checkPermissionsMock).not.toHaveBeenCalled();
    });

    it('should stop the foreground service on Android', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;

        await expect(notificationService.stopForegroundService()).resolves.toBeUndefined();
        expect(mocks.stopForegroundServiceMock).toHaveBeenCalledTimes(1);
    });

    it('should skip foreground service shutdown on non-Android platforms', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = 'ios';

        await expect(notificationService.stopForegroundService()).resolves.toBeUndefined();
        expect(mocks.stopForegroundServiceMock).not.toHaveBeenCalled();
    });

    it('should request permissions when prompt and start the foreground service when granted', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValueOnce({receive: 'prompt'});
        mocks.checkPermissionsMock.mockResolvedValueOnce({receive: 'granted'});

        await expect(notificationService.startForegroundService()).resolves.toBe('granted');

        expect(mocks.requestPermissionsMock).toHaveBeenCalledTimes(1);
        expect(mocks.startForegroundServiceMock).toHaveBeenCalledTimes(1);
    });

    it('should show the denied warning once and dismiss the spinner when denied', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 0, item: () => ({})}});
        const hideProgressDialogSpy = vi.spyOn(notificationService, 'hideProgressDialog');

        const promise = notificationService.startForegroundService();
        //wait until the denied flow has dismissed the spinner and created the alert
        //(hideProgressDialog(0) resolves on a macrotask, so poll instead of a single tick)
        await vi.waitFor(() => {
            expect(hideProgressDialogSpy).toHaveBeenCalledWith(0);
            expect(alertController.create).toHaveBeenCalled();
        });

        expect(mocks.requestPermissionsMock).toHaveBeenCalledTimes(1);

        //tap the Dismiss button to resolve the alert
        const buttons = alertController.create.mock.calls[0][0].buttons;
        buttons[0].handler();
        const choice = await promise;

        expect(choice).toBe('dismiss');
        expect(mocks.startForegroundServiceMock).not.toHaveBeenCalled();
        expect(mocks.presentMock).toHaveBeenCalled();
        expect(mocks.insertSettingMock).toHaveBeenCalledWith('notifications_permissions_denied_warning_shown', '1');
    });

    it('should not show the denied warning again once it has already been shown', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 1, item: () => ({value: '1'})}});

        await expect(notificationService.startForegroundService()).resolves.toBe('dismiss');

        expect(mocks.startForegroundServiceMock).not.toHaveBeenCalled();
        expect(alertController.create).not.toHaveBeenCalled();
        expect(mocks.insertSettingMock).not.toHaveBeenCalled();
    });

    it('should propagate alertController.create errors from showNotificationPermissionAlert', async () => {
        const error = new Error('create failed');
        alertController.create.mockRejectedValueOnce(error);

        await expect(notificationService.showNotificationPermissionAlert(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DOCS_URL))
            .rejects.toBe(error);
    });

    it('should propagate alert.present errors from showNotificationPermissionAlert', async () => {
        const error = new Error('present failed');
        mocks.presentMock.mockRejectedValueOnce(error);

        await expect(notificationService.showNotificationPermissionAlert(PARAMETERS.NOTIFICATIONS_PERMISSIONS_DOCS_URL))
            .rejects.toBe(error);
    });

    it('should resolve startForegroundService with open_settings and skip capture when chosen', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 0, item: () => ({})}});

        const promise = notificationService.startForegroundService();
        await vi.waitFor(() => {
            expect(alertController.create).toHaveBeenCalled();
        });

        const buttons = alertController.create.mock.calls[0][0].buttons;
        buttons[2].handler(); // Open Settings

        await expect(promise).resolves.toBe('open_settings');
        //capture (Camera.getPhoto / scanner) is gated on fsChoice not being
        //'open_settings'/'learn_more'; confirming the foreground service was
        //never started proves the denied branch did not fall through
        expect(mocks.startForegroundServiceMock).not.toHaveBeenCalled();
        expect(mocks.nativeSettingsOpenMock).toHaveBeenCalled();
    });

    it('should resolve startForegroundService with learn_more and skip capture when chosen', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 0, item: () => ({})}});
        //jsdom does not implement window.open; stub it so the handler runs cleanly
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
        });

        const promise = notificationService.startForegroundService();
        await vi.waitFor(() => {
            expect(alertController.create).toHaveBeenCalled();
        });

        const buttons = alertController.create.mock.calls[0][0].buttons;
        buttons[1].handler(); // Learn More

        await expect(promise).resolves.toBe('learn_more');
        expect(mocks.startForegroundServiceMock).not.toHaveBeenCalled();
        expect(openSpy).toHaveBeenCalledWith(
            PARAMETERS.NOTIFICATIONS_PERMISSIONS_DOCS_URL,
            '_system',
            'location=yes'
        );

        openSpy.mockRestore();
    });

    it('should resolve startForegroundService with the chosen action when insertSetting rejects', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 0, item: () => ({})}});
        const error = new Error('insert failed');
        mocks.insertSettingMock.mockRejectedValueOnce(error);
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        });

        const promise = notificationService.startForegroundService();
        await vi.waitFor(() => {
            expect(alertController.create).toHaveBeenCalled();
        });

        const buttons = alertController.create.mock.calls[0][0].buttons;
        buttons[2].handler(); // Open Settings

        await expect(promise).resolves.toBe('open_settings');
        expect(mocks.insertSettingMock).toHaveBeenCalledWith('notifications_permissions_denied_warning_shown', '1');
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist notifications permissions warning'));

        consoleSpy.mockRestore();
    });

    it('should not propagate insertSetting rejection when the user picks learn_more', async () => {
        const rootStore = useRootStore();
        rootStore.device.platform = PARAMETERS.ANDROID;
        mocks.checkPermissionsMock.mockResolvedValue({receive: 'denied'});
        mocks.selectSettingMock.mockResolvedValue({rows: {length: 0, item: () => ({})}});
        mocks.insertSettingMock.mockRejectedValueOnce(new Error('insert failed'));
        vi.spyOn(console, 'log').mockImplementation(() => {
        });
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {
        });

        const promise = notificationService.startForegroundService();
        await vi.waitFor(() => {
            expect(alertController.create).toHaveBeenCalled();
        });

        const buttons = alertController.create.mock.calls[0][0].buttons;
        buttons[1].handler(); // Learn More

        await expect(promise).resolves.toBe('learn_more');

        openSpy.mockRestore();
    });
});
