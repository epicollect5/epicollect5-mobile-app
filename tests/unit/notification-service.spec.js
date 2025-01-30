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
});

