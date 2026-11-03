import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import fs from 'fs';
import path from 'path';
import { modalController } from '@ionic/vue';
import { authPasswordlessService } from '@/services/auth/auth-passwordless-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';
import ModalPasswordlessLogin from '@/components/modals/ModalPasswordlessLogin.vue';

const store = vi.hoisted(() => ({
    language: 'en',
    user: { name: '', email: '', action: '' },
    afterUserIsLoggedIn: { callback: null, params: null }
}));

vi.mock('@/stores/root-store', () => ({ useRootStore: () => store }));
vi.mock('@/services/auth/auth-passwordless-service', () => ({
    authPasswordlessService: { authPasswordlessUser: vi.fn() }
}));
vi.mock('@/services/auth/auth-login-service', () => ({
    authLoginService: { loginUser: vi.fn(), runAfterLoginAction: vi.fn() }
}));
vi.mock('@/services/modals/modals-handler-service', () => ({
    modalsHandlerService: { dismissAll: vi.fn() }
}));
vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showToast: vi.fn(),
        showAlert: vi.fn(),
        hideProgressDialog: vi.fn()
    }
}));
vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { login: 'Login' },
            status_codes: { ec5_115: 'Logged in' }
        }
    }
}));

function mountModal () {
    return shallowMount(ModalPasswordlessLogin, {
        props: {
            email: 'test@example.com'
        }
    });
}

describe('ModalPasswordlessLogin', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        modalController.dismiss = vi.fn().mockReturnValue(true);
        store.afterUserIsLoggedIn = { callback: vi.fn(), params: null };
        authPasswordlessService.authPasswordlessUser.mockResolvedValue({ data: { data: { jwt: 'jwt' } } });
        authLoginService.loginUser.mockResolvedValue();
        authLoginService.runAfterLoginAction.mockResolvedValue(true);
        modalsHandlerService.dismissAll.mockResolvedValue();
    });

    it('pins a readable dark-mode code field', () => {
        //transparent input over the dark card washes out text, placeholder
        //and caret: the stylesheet must pin a black field, grey border and
        //matching caret under body.theme-dark
        const scss = fs.readFileSync(path.resolve(__dirname, '../../../../src/theme/components/modals/ModalPasswordlessLogin.scss'), 'utf8');

        expect(scss).toContain('body.theme-dark .modal-passwordless-login');
        expect(scss).toContain('--background: #000');
        expect(scss).toContain('caret-color: var(--app-text)');
        expect(scss).toContain('--highlight-color-focused: var(--app-text)');
        expect(scss).toContain('--padding-start: 12px');
    });

    it('renders the code input', () => {
        const wrapper = mountModal();

        expect(wrapper.find('ion-input').exists()).toBe(true);
    });

    it('stores the user before dismissing the auth modals, then runs the parked action', async () => {
        const wrapper = mountModal();
        wrapper.vm.state.authPasswordlessCredentials.code = '123456';

        await wrapper.vm.performPasswordlessLogin();

        expect(authLoginService.loginUser).toHaveBeenCalled();
        expect(authLoginService.loginUser.mock.invocationCallOrder[0])
            .toBeLessThan(modalsHandlerService.dismissAll.mock.invocationCallOrder[0]);
        expect(modalsHandlerService.dismissAll.mock.invocationCallOrder[0])
            .toBeLessThan(authLoginService.runAfterLoginAction.mock.invocationCallOrder[0]);
        expect(authLoginService.runAfterLoginAction).toHaveBeenCalledWith(store);
    });

    it('does not consume the parked action when the modal is closed', () => {
        const wrapper = mountModal();

        wrapper.vm.dismiss();

        expect(modalController.dismiss).toHaveBeenCalled();
        expect(authLoginService.runAfterLoginAction).not.toHaveBeenCalled();
        expect(store.afterUserIsLoggedIn.callback).toEqual(expect.any(Function));
    });
});
