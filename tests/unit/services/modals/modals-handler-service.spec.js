import {describe, it, expect, vi, beforeEach} from 'vitest';
import {modalsHandlerService} from '@/services/modals/modals-handler-service';

const EMPTY_MODALS = {
    login: null,
    passwordlessSend: null,
    passwordlessLogin: null,
    confirmPassword: null,
    confirmEmail: null
};

describe('modalsHandlerService', () => {
    beforeEach(() => {
        modalsHandlerService.modals = {...EMPTY_MODALS};
    });

    describe('dismissAll', () => {
        it('dismisses each tracked modal exactly once', async () => {
            const modals = {};
            for (const key of Object.keys(EMPTY_MODALS)) {
                modals[key] = {dismiss: vi.fn().mockResolvedValue(true)};
            }
            modalsHandlerService.modals = modals;

            await modalsHandlerService.dismissAll();

            for (const key of Object.keys(EMPTY_MODALS)) {
                expect(modals[key].dismiss).toHaveBeenCalledTimes(1);
            }
        });

        it('dismisses stacked modals from the topmost to the bottom one', async () => {
            const dismissed = [];
            modalsHandlerService.modals = {
                login: {dismiss: vi.fn().mockImplementation(async () => dismissed.push('login'))},
                passwordlessSend: {dismiss: vi.fn().mockImplementation(async () => dismissed.push('passwordlessSend'))},
                passwordlessLogin: {dismiss: vi.fn().mockImplementation(async () => dismissed.push('passwordlessLogin'))},
                confirmPassword: null,
                confirmEmail: null
            };

            await modalsHandlerService.dismissAll();

            expect(dismissed).toEqual(['passwordlessLogin', 'passwordlessSend', 'login']);
        });

        it('awaits each modal dismissal before dismissing the next one', async () => {
            let resolveFirstDismiss;
            const firstDismiss = new Promise((resolve) => {
                resolveFirstDismiss = resolve;
            });
            const passwordlessSendDismiss = vi.fn().mockResolvedValue(true);

            modalsHandlerService.modals = {
                login: {dismiss: vi.fn().mockResolvedValue(true)},
                passwordlessSend: {dismiss: passwordlessSendDismiss},
                passwordlessLogin: {dismiss: vi.fn().mockImplementation(() => firstDismiss)},
                confirmPassword: null,
                confirmEmail: null
            };

            const dismissPromise = modalsHandlerService.dismissAll();

            //the topmost modal dismiss is pending, the next one must not be started yet
            expect(modalsHandlerService.modals.passwordlessLogin.dismiss).toHaveBeenCalledTimes(1);
            expect(passwordlessSendDismiss).not.toHaveBeenCalled();

            //once the topmost modal dismissal completes, the next one is dismissed
            resolveFirstDismiss(true);
            await dismissPromise;

            expect(passwordlessSendDismiss).toHaveBeenCalledTimes(1);
            expect(modalsHandlerService.modals.login.dismiss).toHaveBeenCalledTimes(1);
        });

        it('skips modal references that are not set', async () => {
            const loginDismiss = vi.fn().mockResolvedValue(true);
            modalsHandlerService.modals = {
                ...EMPTY_MODALS,
                login: {dismiss: loginDismiss}
            };

            await modalsHandlerService.dismissAll();

            expect(loginDismiss).toHaveBeenCalledTimes(1);
        });
    });
});
