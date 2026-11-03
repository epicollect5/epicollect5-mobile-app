import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { modalController } from '@ionic/vue';
import { authVerificationService } from '@/services/auth/auth-verification-service';
import { authLoginService } from '@/services/auth/auth-login-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';
import ModalConfirmEmail from '@/components/modals/ModalConfirmEmail.vue';

const store = vi.hoisted(() => ({
    language: 'en',
    user: { name: '', email: '', action: '' },
    afterUserIsLoggedIn: { callback: null, params: null }
}));

vi.mock('@/stores/root-store', () => ({ useRootStore: () => store }));
vi.mock('@/services/auth/auth-verification-service', () => ({
    authVerificationService: { verifyUser: vi.fn() }
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
            labels: { login: 'Login', logout: 'Logout' },
            status_codes: { ec5_115: 'Logged in', ec5_103: 'Login failed' }
        }
    }
}));

const ACCOUNT = { email: 'user@epicollect.net', provider: 'google', user: { given_name: 'Zeferino' } };

function mountModal () {
    return shallowMount(ModalConfirmEmail, { props: { account: ACCOUNT } });
}

describe('ModalConfirmEmail', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        modalController.dismiss = vi.fn().mockReturnValue(true);
        store.afterUserIsLoggedIn = { callback: vi.fn(), params: null };
        authVerificationService.verifyUser.mockResolvedValue({ data: { data: { jwt: 'jwt' } } });
        authLoginService.loginUser.mockResolvedValue();
        authLoginService.runAfterLoginAction.mockResolvedValue(true);
        modalsHandlerService.dismissAll.mockResolvedValue();
    });

    it('stores the user before dismissing the auth modals, then runs the parked action', async () => {
        const wrapper = mountModal();
        wrapper.vm.state.code = '123456';

        await wrapper.vm.performUserVerification();

        //the login modal underneath sees a session on dismissal only because the
        //user is stored first: that is what keeps the parked action alive
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
        //left parked for the login modal underneath, whose close handler drops it
        expect(store.afterUserIsLoggedIn.callback).toEqual(expect.any(Function));
    });
});
