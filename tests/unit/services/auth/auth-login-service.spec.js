import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notificationService } from '@/services/notification-service';
import { authLoginService } from '@/services/auth/auth-login-service';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showToast: vi.fn(),
        showAlert: vi.fn(),
        hideProgressDialog: vi.fn()
    }
}));

vi.mock('@/services/database/database-insert-service', () => ({
    databaseInsertService: { insertUser: vi.fn() }
}));

vi.mock('@/services/modals/modals-handler-service', () => ({
    modalsHandlerService: { dismissAll: vi.fn() }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { logout: 'Logout' },
            status_codes: { ec5_115: 'Logged in', ec5_103: 'Login failed' }
        }
    }
}));

function makeStore (parked = { callback: null, params: null }) {
    return { language: 'en', user: {}, afterUserIsLoggedIn: parked };
}

describe('authLoginService.runAfterLoginAction()', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('runs the parked action with its params and clears it', async () => {
        const callback = vi.fn().mockResolvedValue();
        const store = makeStore({ callback, params: ['project', 'router'] });

        await expect(authLoginService.runAfterLoginAction(store)).resolves.toBe(true);

        expect(callback).toHaveBeenCalledWith('project', 'router');
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
        expect(notificationService.hideProgressDialog).not.toHaveBeenCalled();
    });

    it('runs a callback parked without params', async () => {
        const callback = vi.fn().mockResolvedValue();
        const store = makeStore({ callback, params: null });

        await authLoginService.runAfterLoginAction(store);

        expect(callback).toHaveBeenCalledWith();
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });

    it('only releases the progress dialog when nothing is parked', async () => {
        const store = makeStore();

        await expect(authLoginService.runAfterLoginAction(store)).resolves.toBe(false);

        expect(notificationService.hideProgressDialog).toHaveBeenCalledTimes(1);
        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });

    it('clears the parked action even when the callback rejects', async () => {
        const callback = vi.fn().mockRejectedValue(new Error('add failed'));
        const store = makeStore({ callback, params: [] });

        await expect(authLoginService.runAfterLoginAction(store)).rejects.toThrow('add failed');

        expect(store.afterUserIsLoggedIn).toEqual({ callback: null, params: null });
    });
});
