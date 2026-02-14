import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRootStore } from '@/stores/root-store';
import { versioningService } from '@/services/utilities/versioning-service';
import { notificationService } from '@/services/notification-service';
import { logout } from '@/use/logout';
import { showModalLogin } from '@/use/show-modal-login';
import { updateLocalProject } from '@/use/update-local-project';
import { PARAMETERS } from '@/config';
import { errorsService } from '@/services/errors-service';

// Mocking the services using your preferred style
vi.mock('@/services/utilities/versioning-service', () => ({
    versioningService: {
        checkProjectVersion: vi.fn(),
        updateProject: vi.fn()
    }
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showProgressDialog: vi.fn(),
        hideProgressDialog: vi.fn(),
        showAlert: vi.fn(),
        showToast: vi.fn(),
        confirmSingle: vi.fn()
    }
}));

vi.mock('@/use/logout', () => ({ logout: vi.fn() }));
vi.mock('@/use/show-modal-login', () => ({ showModalLogin: vi.fn() }));
vi.mock('@/services/errors-service', () => ({
    errorsService: { handleWebError: vi.fn() }
}));

vi.mock('@/config', () => ({
    PARAMETERS: {
        AUTH_ERROR_CODES: ['ec5_70', 'ec5_71', 'ec5_77', 'ec5_78', 'ec5_50', 'ec5_51']
    }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: { wait: 'wait', updating_project: 'updating', loading_entries: 'loading' },
            status_codes: {
                ec5_70: 'Please log in',
                ec5_71: 'Permission denied',
                ec5_77: 'Private project',
                ec5_78: 'Access denied',
                ec5_50: 'JWT Error',
                ec5_51: 'JWT Invalid',
                other_error: 'Something went wrong'
            }
        }
    }
}));

describe('updateLocalProject()', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        // Setup default store state
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.continueProjectVersionUpdate = true;
    });

    it('returns false immediately if project is up to date', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(true);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(versioningService.checkProjectVersion).toHaveBeenCalled();
        expect(notificationService.confirmSingle).not.toHaveBeenCalled();
    });

    it('asks for confirmation and returns false if user cancels', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        notificationService.confirmSingle.mockResolvedValue(false);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(notificationService.confirmSingle).toHaveBeenCalled();
        expect(versioningService.updateProject).not.toHaveBeenCalled();
    });

    it('updates project and shows success alert when confirmed', async () => {
        // 1. Get the store instance
        const rootStore = useRootStore();

        // 2. Setup the "Outdated" state
        versioningService.checkProjectVersion.mockResolvedValue(false);

        // 3. IMPORTANT: This must be true to enter the 'if' block
        rootStore.continueProjectVersionUpdate = true;

        // 4. Setup the "User said Yes" state
        notificationService.confirmSingle.mockResolvedValue(true);

        // 5. Setup the "Update worked" state
        versioningService.updateProject.mockResolvedValue(true);

        const result = await updateLocalProject();

        // This should now be true
        expect(result).toBe(true);
        expect(notificationService.showAlert).toHaveBeenCalled();
    });

    it('handles Auth Errors by setting callback and calling logout', async () => {
        const rootStore = useRootStore();
        versioningService.checkProjectVersion.mockResolvedValue(false);
        notificationService.confirmSingle.mockResolvedValue(true);

        // Simulate an Auth Error based on your PARAMETERS.AUTH_ERROR_CODES
        const authError = {
            data: {
                errors: [{ code: 'ec5_70' }] // Assuming ec5_70 is an auth error
            }
        };
        versioningService.updateProject.mockRejectedValue(authError);

        const result = await updateLocalProject();

        expect(result).toBe(false);
        // Verify the callback was attached to the store
        expect(rootStore.afterUserIsLoggedIn.callback).toBeDefined();
        expect(typeof rootStore.afterUserIsLoggedIn.callback).toBe('function');

        expect(logout).toHaveBeenCalled();
        expect(showModalLogin).toHaveBeenCalled();
        expect(notificationService.showToast).toHaveBeenCalled();
    });

    // Test every code defined in PARAMETERS.AUTH_ERROR_CODES
    PARAMETERS.AUTH_ERROR_CODES.forEach((errorCode) => {
        it(`handles auth error code ${errorCode} correctly`, async () => {
            const rootStore = useRootStore();
            versioningService.checkProjectVersion.mockResolvedValue(false);
            notificationService.confirmSingle.mockResolvedValue(true);

            // Simulate the specific Auth Error response
            const authError = {
                data: {
                    errors: [{ code: errorCode }]
                }
            };
            versioningService.updateProject.mockRejectedValue(authError);

            const result = await updateLocalProject();

            expect(result).toBe(false);

            // 1. Check if callback is set
            expect(rootStore.afterUserIsLoggedIn.callback).toBeDefined();

            // 2. Check if notification toast was shown
            expect(notificationService.showToast).toHaveBeenCalled();

            // 3. Check if logout and login modal were triggered
            expect(logout).toHaveBeenCalled();
            expect(showModalLogin).toHaveBeenCalled();

            // 4. Ensure WebError service was NOT called for auth issues
            expect(errorsService.handleWebError).not.toHaveBeenCalled();
        });
    });

    it('returns false and logs error if checkProjectVersion fails', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        versioningService.checkProjectVersion.mockRejectedValue(new Error('Network Fail'));

        const result = await updateLocalProject();

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('handles non-auth errors using errorsService.handleWebError', async () => {
        versioningService.checkProjectVersion.mockResolvedValue(false);
        notificationService.confirmSingle.mockResolvedValue(true);

        const regularError = {
            data: {
                errors: [{ code: 'ec5_999' }] // Not in the auth list
            }
        };
        versioningService.updateProject.mockRejectedValue(regularError);

        const result = await updateLocalProject();

        expect(result).toBe(false);

        // Ensure standard error handler was used
        expect(errorsService.handleWebError).toHaveBeenCalledWith(regularError);

        // Ensure auth logic was skipped
        expect(logout).not.toHaveBeenCalled();
        expect(showModalLogin).not.toHaveBeenCalled();
    });
});


