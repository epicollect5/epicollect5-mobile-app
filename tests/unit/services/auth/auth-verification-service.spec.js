import {describe, it, expect, vi, beforeEach} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import {authVerificationService} from '@/services/auth/auth-verification-service';
import {useRootStore} from '@/stores/root-store';
import {utilsService} from '@/services/utilities/utils-service';
import {webService} from '@/services/web-service';
import {notificationService} from '@/services/notification-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {errorsService} from '@/services/errors-service';

// Mock Services
vi.mock('@/services/utilities/utils-service');
vi.mock('@/services/web-service');
vi.mock('@/services/notification-service');
vi.mock('@/services/database/database-select-service');
vi.mock('@/services/errors-service');
// Mock Config
vi.mock('@/config/strings', () => ({
    STRINGS: {en: {status_codes: {ec5_118: 'No Internet'}, labels: {sign_in: 'Sign In'}}}
}));

describe('authVerificationService', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        // Setup default rootStore state
        const rootStore = useRootStore();
        rootStore.language = 'en';

        // Mock window.atob for Node environment
        if (typeof window.atob === 'undefined') {
            window.atob = (str) => Buffer.from(str, 'base64').toString('binary');
        }
    });

    describe('verifyUser', () => {
        const credentials = {email: 'test@example.com', password: 'password123'};

        it('shows alert and rejects if there is no internet connection', async () => {
            // 1. Setup the mock
            utilsService.hasInternetConnection.mockResolvedValue(false);

            // 2. Assert that the promise REJECTS with the error code
            // Use .rejects.toBe() for strings or .rejects.toThrow() for Error objects
            await expect(authVerificationService.verifyUser(credentials))
                .rejects.toBe('ec5_118');

            // 3. Verify the UI side effect happened
            expect(notificationService.showAlert).toHaveBeenCalled();
        });

        it('resolves on successful verification', async () => {
            utilsService.hasInternetConnection.mockResolvedValue(true);
            webService.verifyUserEmail.mockResolvedValue({status: 'success'});

            const result = await authVerificationService.verifyUser(credentials);

            expect(notificationService.showProgressDialog).toHaveBeenCalled();
            expect(result).toEqual({status: 'success'});
        });

        it('rejects with error code on failed verification', async () => {
            utilsService.hasInternetConnection.mockResolvedValue(true);
            const mockError = {response: {status: 401}};
            webService.verifyUserEmail.mockRejectedValue(mockError);
            errorsService.getWebErrorCode.mockReturnValue('EC5_101');

            await expect(authVerificationService.verifyUser(credentials)).rejects.toBe('EC5_101');

            expect(notificationService.hideProgressDialog).toHaveBeenCalled();
            expect(errorsService.getWebErrorCode).toHaveBeenCalledWith(mockError);
        });
    });

    describe('isJWTExpired', () => {
        // Helper to generate fake base64 payload
        const createJwt = (exp) => {
            const payload = btoa(JSON.stringify({exp})).replace(/=/g, '');
            return `header.${payload}.signature`;
        };

        it('returns true if no user is found', async () => {
            databaseSelectService.getUser.mockResolvedValue({rows: {length: 0}});
            const result = await authVerificationService.isJWTExpired();
            expect(result).toBe(true);
        });

        it('returns false for a valid, non-expired token', async () => {
            const farFuture = (Date.now() / 1000) + 1000;
            databaseSelectService.getUser.mockResolvedValue({
                rows: {
                    length: 1,
                    item: () => ({jwt: createJwt(farFuture)})
                }
            });
            const result = await authVerificationService.isJWTExpired();
            expect(result).toBe(false);
        });

        it('returns true if token is within the 10s buffer', async () => {
            const nearExpiry = (Date.now() / 1000) + 5; // Expiring in 5s
            databaseSelectService.getUser.mockResolvedValue({
                rows: {length: 1, item: () => ({jwt: createJwt(nearExpiry)})}
            });
            const result = await authVerificationService.isJWTExpired();
            expect(result).toBe(true);
        });

        it('returns true and logs error on catch block', async () => {
            databaseSelectService.getUser.mockRejectedValue(new Error('DB Error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
            });

            const result = await authVerificationService.isJWTExpired();

            expect(result).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith('JWT check failed', expect.any(Error));
        });
    });
});
