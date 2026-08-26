import {describe, it, expect, vi, beforeEach} from 'vitest';
import {modalsHandlerService} from '@/services/modals/modals-handler-service';

const MODAL_KEYS = ['login', 'passwordlessSend', 'passwordlessLogin', 'confirmPassword', 'confirmEmail'];

function setModal(key, dismissImplementation) {
    modalsHandlerService[key] = {dismiss: vi.fn(dismissImplementation)};
    return modalsHandlerService.modals[key];
}

function mockTransactionLikeDismiss() {
    return {dismiss: vi.fn().mockResolvedValue(true)};
}

describe('modalsHandlerService', () => {
    beforeEach(() => {
        for (const key of MODAL_KEYS) {
            modalsHandlerService.modals[key] = null;
        }
        modalsHandlerService._presentationOrder = [];
    });

    describe('dismissAll', () => {
        it('dismisses each tracked modal exactly once', async () => {
            const modals = {};
            for (const key of MODAL_KEYS) {
                modals[key] = setModal(key, async () => true);
            }

            await modalsHandlerService.dismissAll();

            for (const key of MODAL_KEYS) {
                expect(modals[key].dismiss).toHaveBeenCalledTimes(1);
            }
        });

        it('dismisses stacked modals from the topmost (last presented) to the bottom one', async () => {
            const dismissed = [];
            //presented in the real order: login first, passwordless on top of it
            setModal('login', async () => dismissed.push('login'));
            setModal('passwordlessSend', async () => dismissed.push('passwordlessSend'));
            setModal('passwordlessLogin', async () => dismissed.push('passwordlessLogin'));

            await modalsHandlerService.dismissAll();

            expect(dismissed).toEqual(['passwordlessLogin', 'passwordlessSend', 'login']);
        });

        it('awaits each modal dismissal before dismissing the next one', async () => {
            let resolveFirstDismiss;
            const firstDismiss = new Promise((resolve) => {
                resolveFirstDismiss = resolve;
            });
            const passwordlessSendDismiss = vi.fn().mockResolvedValue(true);
            const loginDismiss = vi.fn().mockResolvedValue(true);

            setModal('login', async () => loginDismiss());
            setModal('passwordlessSend', async () => passwordlessSendDismiss());
            setModal('passwordlessLogin', async () => firstDismiss);

            const dismissPromise = modalsHandlerService.dismissAll();

            //the topmost modal dismiss is pending, the next one must not be started yet
            expect(modalsHandlerService.modals.passwordlessLogin.dismiss).toHaveBeenCalledTimes(1);
            expect(passwordlessSendDismiss).not.toHaveBeenCalled();
            expect(loginDismiss).not.toHaveBeenCalled();

            //once the topmost modal dismissal completes, the next one is dismissed
            resolveFirstDismiss(true);
            await dismissPromise;

            expect(passwordlessSendDismiss).toHaveBeenCalledTimes(1);
            expect(loginDismiss).toHaveBeenCalledTimes(1);
        });

        it('keeps dismissing the remaining modals when one dismissal fails', async () => {
            const loginDismiss = vi.fn().mockResolvedValue(true);
            const passwordlessSendDismiss = vi.fn().mockRejectedValue(new Error('already dismissed'));
            const passwordlessLoginDismiss = vi.fn().mockResolvedValue(true);

            setModal('login', async () => loginDismiss());
            setModal('passwordlessSend', async () => passwordlessSendDismiss());
            setModal('passwordlessLogin', async () => passwordlessLoginDismiss());

            await expect(modalsHandlerService.dismissAll()).resolves.toBeUndefined();

            expect(passwordlessSendDismiss).toHaveBeenCalledTimes(1);
            expect(loginDismiss).toHaveBeenCalledTimes(1);
        });

        it('does not clear a modal re-presented while awaiting the previous dismissal', async () => {
            let resolveFirstDismiss;
            const firstDismiss = new Promise((resolve) => {
                resolveFirstDismiss = resolve;
            });
            const firstModal = setModal('login', async () => firstDismiss);

            const dismissPromise = modalsHandlerService.dismissAll();

            //the login modal is re-presented while its previous dismissal is pending
            const secondModal = setModal('login', async () => true);
            expect(modalsHandlerService.modals.login).toBe(secondModal);

            resolveFirstDismiss(true);
            await dismissPromise;

            //the re-presented modal must be dismissed too, not orphaned by the stale clear
            expect(secondModal.dismiss).toHaveBeenCalledTimes(1);
            expect(firstModal.dismiss).toHaveBeenCalledTimes(1);
            expect(modalsHandlerService.modals.login).toBeNull();
        });

        it('clears all modal references and the presentation stack after dismissal', async () => {
            setModal('login', async () => true);
            setModal('passwordlessSend', async () => true);

            await modalsHandlerService.dismissAll();

            expect(modalsHandlerService.modals).toEqual({
                login: null,
                passwordlessSend: null,
                passwordlessLogin: null,
                confirmPassword: null,
                confirmEmail: null
            });
            expect(modalsHandlerService._presentationOrder).toEqual([]);
        });

        it('skips modal references that were never presented', async () => {
            const loginDismiss = vi.fn().mockResolvedValue(true);
            setModal('login', async () => loginDismiss());

            await modalsHandlerService.dismissAll();

            expect(loginDismiss).toHaveBeenCalledTimes(1);
        });
    });
});
