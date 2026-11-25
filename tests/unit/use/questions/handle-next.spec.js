import { vi } from 'vitest';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { errorsService } from '@/services/errors-service';
import { initialSetup } from '@/use/questions/initial-setup';
import { handleNext } from '@/use/questions/handle-next';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showNativeLoader: vi.fn().mockResolvedValue(),
        hideNativeLoader: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/use/questions/initial-setup', () => ({
    initialSetup: vi.fn()
}));

vi.mock('@/services/errors-service', () => ({
    errorsService: {
        handleEntryErrors: vi.fn()
    }
}));

function setupState() {
    return {
        disableNext: false,
        disablePrevious: false,
        isFetching: false,
        existingAnswer: '',
        answers: {},
        confirmAnswer: {},
        inputDetails: { type: PARAMETERS.QUESTION_TYPES.TEXT },
        error: { errors: [] },
        questionParams: {
            type: PARAMETERS.QUESTION_TYPES.TEXT,
            currentInputRef: 'form1_q1',
            currentInputIndex: 0,
            isBranch: false
        }
    };
}

describe('handleNext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
    });

    it('clears the question first, then shows the loader before mounting', async () => {
        const order = [];
        notificationService.showNativeLoader.mockImplementation(() => {
            order.push('show');
            return Promise.resolve();
        });
        const state = setupState();
        //track when the current question is unmounted relative to the loader
        let typeValue = PARAMETERS.QUESTION_TYPES.TEXT;
        Object.defineProperty(state.questionParams, 'type', {
            get: () => typeValue,
            set: (value) => {
                typeValue = value;
                order.push(value === null ? 'unmount' : 'remount');
            }
        });
        const scope = {
            entryService: {
                validateAnswer: vi.fn().mockImplementation(() => {
                    order.push('validate');
                    return Promise.resolve();
                }),
                processJumpsNext: vi.fn().mockReturnValue({
                    next_input_ref: 'form1_q2',
                    next_input_index: 1
                }),
                wasJumpEdited: vi.fn().mockReturnValue(false)
            }
        };

        await handleNext(state, scope);

        //the content is cleared first, then the loader appears, then
        //validation runs before the next question mounts behind it
        expect(order).toEqual(['unmount', 'show', 'validate']);
        expect(state.isFetching).toBe(true);
        expect(notificationService.showNativeLoader).toHaveBeenCalledTimes(1);

        //the next question setup runs in the catch-up timeout
        await vi.waitFor(() => {
            expect(initialSetup).toHaveBeenCalledTimes(1);
        });
        expect(state.questionParams.currentInputRef).toBe('form1_q2');
        expect(state.questionParams.currentInputIndex).toBe(1);
    });

    it('requests the loader once on the validation error path', async () => {
        const state = setupState();
        const scope = {
            entryService: {
                validateAnswer: vi.fn().mockRejectedValue({error: {}, inputRefs: []}),
                wasJumpEdited: vi.fn().mockReturnValue(false)
            }
        };

        await handleNext(state, scope);
        await vi.waitFor(() => {
            expect(state.questionParams.type).toBe(PARAMETERS.QUESTION_TYPES.TEXT);
        });

        //the failed navigation still requested the loader exactly once;
        //the question remounts and question-mounted hides it
        expect(notificationService.showNativeLoader).toHaveBeenCalledTimes(1);
        expect(initialSetup).not.toHaveBeenCalled();
        expect(errorsService.handleEntryErrors).toHaveBeenCalledTimes(1);
        expect(state.disableNext).toBe(false);
        expect(state.disablePrevious).toBe(false);
    });
});
