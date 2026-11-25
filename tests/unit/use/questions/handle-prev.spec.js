import { vi } from 'vitest';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { initialSetup } from '@/use/questions/initial-setup';
import { handlePrev } from '@/use/questions/handle-prev';

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        showNativeLoader: vi.fn().mockResolvedValue(),
        hideNativeLoader: vi.fn().mockResolvedValue()
    }
}));

vi.mock('@/use/questions/initial-setup', () => ({
    initialSetup: vi.fn()
}));

function setupState() {
    return {
        disableNext: false,
        disablePrevious: false,
        isFetching: false,
        questionParams: {
            type: PARAMETERS.QUESTION_TYPES.TEXT,
            currentInputRef: 'form1_q2',
            currentInputIndex: 1,
            isBranch: false
        }
    };
}

describe('handlePrev', () => {
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
                processJumpsPrevious: vi.fn().mockImplementation(() => {
                    order.push('jumps');
                    return {
                        previous_input_ref: 'form1_q1',
                        previous_input_index: 0
                    };
                })
            }
        };

        await handlePrev(state, scope);

        //the content is cleared first, then the loader appears, then the
        //previous question mounts behind it
        expect(order).toEqual(['unmount', 'show', 'jumps']);
        expect(state.isFetching).toBe(true);
        expect(notificationService.showNativeLoader).toHaveBeenCalledTimes(1);

        //the previous question setup runs in the catch-up timeout
        await vi.waitFor(() => {
            expect(initialSetup).toHaveBeenCalledTimes(1);
        });
        expect(state.questionParams.currentInputRef).toBe('form1_q1');
        expect(state.questionParams.currentInputIndex).toBe(0);
    });
});
