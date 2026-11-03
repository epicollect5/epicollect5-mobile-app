import { describe, it, expect, beforeEach, vi } from 'vitest';
import flushPromises from 'flush-promises';
import { modalController, menuController } from '@ionic/vue';
import { webService } from '@/services/web-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';
import { showModalLogin } from '@/use/auth/show-modal-login';

const store = vi.hoisted(() => ({
    language: 'en',
    user: { name: '', email: '', action: '' },
    afterUserIsLoggedIn: { callback: null, params: null }
}));

vi.mock('@/components/modals/ModalLogin.vue', () => ({ default: {} }));

vi.mock('@/stores/root-store', () => ({
    useRootStore: () => store
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/services/web-service', () => ({
    webService: { getLoginMethods: vi.fn() }
}));

vi.mock('@/services/modals/modals-handler-service', () => ({
    modalsHandlerService: { login: null }
}));

vi.mock('@ionic/vue', () => ({
    modalController: { create: vi.fn(), dismiss: vi.fn() },
    menuController: { close: vi.fn() }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { login: 'Login' },
            status_codes: { ec5_142: 'Cannot get the login methods' }
        }
    }
}));

describe('showModalLogin()', () => {
    const loginMethods = { data: { data: { login: { methods: ['google'] } } } };
    const parkedAction = { callback: vi.fn(), params: ['project', 'router'] };
    let modal;
    let dismissLogin;

    beforeEach(() => {
        vi.clearAllMocks();
        modalsHandlerService.login = null;
        store.user = { name: '', email: '', action: '' };
        store.afterUserIsLoggedIn = { callback: null, params: null };

        const dismissed = new Promise((resolve) => {
            dismissLogin = resolve;
        });
        modal = {
            present: vi.fn().mockResolvedValue(),
            dismiss: vi.fn().mockResolvedValue(),
            onDidDismiss: vi.fn().mockReturnValue(dismissed)
        };
        modalController.create.mockResolvedValue(modal);
        webService.getLoginMethods.mockResolvedValue(loginMethods);
    });

    it('keeps the loader up until the login modal exists', async () => {
        showModalLogin();
        await flushPromises();

        expect(modalController.create).toHaveBeenCalled();
        expect(modal.present).toHaveBeenCalled();
        //the loader used to be released before the modal was created: the app was
        //navigable in that window and the modal landed on the new page
        expect(notificationService.hideProgressDialog).toHaveBeenCalledWith(0);
        expect(notificationService.hideProgressDialog.mock.invocationCallOrder[0])
            .toBeGreaterThan(modalController.create.mock.invocationCallOrder[0]);
        expect(menuController.close).toHaveBeenCalled();
    });

    it('drops the parked post-login action when the user closes the login modal', async () => {
        store.afterUserIsLoggedIn = {...parkedAction};

        showModalLogin();
        await flushPromises();

        dismissLogin({ data: undefined, role: 'modal' });
        await flushPromises();

        //no session was established, so nothing may run on a later login
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });

    it('keeps the parked post-login action when the login completed', async () => {
        store.afterUserIsLoggedIn = {...parkedAction};

        showModalLogin();
        await flushPromises();

        //onAuthSuccess stores the user before dismissing the modal
        store.user = { name: 'zeferino', email: 'user@epicollect.net', action: 'Logout' };
        dismissLogin({ data: undefined, role: 'backdrop' });
        await flushPromises();

        expect(store.afterUserIsLoggedIn.callback).toBe(parkedAction.callback);
        expect(store.afterUserIsLoggedIn.params).toEqual(parkedAction.params);
    });

    it('reports a bad login methods response without opening the modal', async () => {
        store.afterUserIsLoggedIn = {...parkedAction};
        webService.getLoginMethods.mockResolvedValue({ data: { data: {} } });

        showModalLogin();
        await flushPromises();

        expect(modalController.create).not.toHaveBeenCalled();
        expect(notificationService.showAlert).toHaveBeenCalledWith('Cannot get the login methods');
        expect(notificationService.hideProgressDialog).toHaveBeenCalledWith();
        expect(modal.present).not.toHaveBeenCalled();
        //no modal was ever opened, so nothing can consume the parked action
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });

    it('reports a failed login methods request without opening the modal', async () => {
        store.afterUserIsLoggedIn = {...parkedAction};
        const error = { data: { errors: [{ code: 'ec5_999' }] } };
        webService.getLoginMethods.mockRejectedValue(error);

        showModalLogin();
        await flushPromises();

        expect(modalController.create).not.toHaveBeenCalled();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(error);
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });
});
