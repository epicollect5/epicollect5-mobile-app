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
        presentMock: vi.fn().mockResolvedValue(true)
    };
});

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
});

