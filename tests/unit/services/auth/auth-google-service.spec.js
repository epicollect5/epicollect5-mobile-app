import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import flushPromises from 'flush-promises';
import { authGoogleService } from '@/services/auth/auth-google-service';
import { useRootStore } from '@/stores/root-store';
import { utilsService } from '@/services/utilities/utils-service';
import { webService } from '@/services/web-service';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { modalsHandlerService } from '@/services/modals/modals-handler-service';
import { modalController } from '@ionic/vue';

vi.mock('@/services/utilities/utils-service', () => ({
    utilsService: {
        hasInternetConnection: vi.fn()
    }
}));

vi.mock('@/services/web-service', () => ({
    webService: {
        authGoogleUser: vi.fn(),
        getEmailConfirmationCode: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showAlert: vi.fn(),
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showToast: vi.fn()
    }
}));

vi.mock('@/services/auth/auth-login-service', () => ({
    authLoginService: {
        onAuthSuccess: vi.fn()
    }
}));

vi.mock('@/services/modals/modals-handler-service', () => ({
    modalsHandlerService: {
        confirmEmail: null,
        confirmPassword: null,
        dismissAll: vi.fn()
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            status_codes: {
                ec5_103: 'Unknown error',
                ec5_116: 'Something went wrong',
                ec5_118: 'No Internet'
            },
            labels: {
                sign_in: 'Sign In',
                error: 'Error'
            }
        }
    }
}));

describe('authGoogleService', () => {
    const authIds = { google: { CLIENT_ID: 'test-client-id' } };
    const googleResponse = {
        code: 'server-auth-code',
        email: 'test@example.com',
        family_name: 'Family',
        given_name: 'Given'
    };

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        const rootStore = useRootStore();
        rootStore.language = 'en';

        utilsService.hasInternetConnection.mockResolvedValue(true);
        notificationService.showProgressDialog.mockResolvedValue();
        notificationService.hideProgressDialog.mockResolvedValue();
        notificationService.showAlert.mockResolvedValue();
        modalsHandlerService.dismissAll.mockResolvedValue();
        webService.getEmailConfirmationCode.mockResolvedValue();

        vi.spyOn(authGoogleService, 'getGoogleCodeNatively').mockResolvedValue(googleResponse);
        vi.spyOn(errorsService, 'handleWebError').mockResolvedValue('Something went wrong');
    });

    async function runAuthFlow() {
        await authGoogleService.authGoogleUser(authIds);
        await flushPromises();
        await flushPromises();
        await flushPromises();
    }

    it('does not throw and calls handleWebError when the server error is undefined (network failure)', async () => {
        webService.authGoogleUser.mockRejectedValue(undefined);

        await expect(runAuthFlow()).resolves.toBeUndefined();
        expect(errorsService.handleWebError).toHaveBeenCalledWith(undefined);
        expect(modalsHandlerService.dismissAll).toHaveBeenCalled();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
    });

    it('does not throw for null, empty and status-only errors', async () => {
        const cases = [null, {}, { status: 0 }, { data: null }];
        for (const error of cases) {
            vi.clearAllMocks();
            utilsService.hasInternetConnection.mockResolvedValue(true);
            notificationService.showProgressDialog.mockResolvedValue();
            notificationService.hideProgressDialog.mockResolvedValue();
            modalsHandlerService.dismissAll.mockResolvedValue();
            vi.spyOn(errorsService, 'handleWebError').mockResolvedValue('Something went wrong');
            webService.authGoogleUser.mockRejectedValue(error);

            await expect(runAuthFlow()).resolves.toBeUndefined();
            expect(errorsService.handleWebError).toHaveBeenCalledWith(error);
        }
    });

    it('routes ec5_383 to the confirm-email modal', async () => {
        webService.authGoogleUser.mockRejectedValue({ data: { errors: [{ code: 'ec5_383' }] } });
        const modal = { present: vi.fn().mockResolvedValue(), onDidDismiss: vi.fn().mockReturnValue(Promise.resolve({ data: null })) };
        modalController.create.mockResolvedValue(modal);

        await runAuthFlow();
        await flushPromises();

        expect(modalController.create).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
    });

    it('routes ec5_390 to the confirm-password modal', async () => {
        webService.authGoogleUser.mockRejectedValue({ data: { errors: [{ code: 'ec5_390' }] } });
        const modal = { present: vi.fn().mockResolvedValue(), onDidDismiss: vi.fn().mockReturnValue(Promise.resolve({ data: null })) };
        modalController.create.mockResolvedValue(modal);

        await runAuthFlow();

        expect(modalController.create).toHaveBeenCalled();
        expect(errorsService.handleWebError).not.toHaveBeenCalled();
    });

    it('does not throw when native login rejects with undefined', async () => {
        authGoogleService.getGoogleCodeNatively.mockRejectedValue(undefined);

        await expect(runAuthFlow()).resolves.toBeUndefined();
        expect(notificationService.hideProgressDialog).toHaveBeenCalled();
        expect(notificationService.showAlert).not.toHaveBeenCalled();
    });
});
