import { describe, beforeEach, it, expect, vi } from 'vitest';
import { popoverMediaHandler } from '@/use/questions/popover-media-handler';
import { PARAMETERS } from '@/config';
import { popoverController } from '@ionic/vue';
import { projectModel } from '@/models/project-model';
import { useRootStore } from '@/stores/root-store';

vi.mock('@/config', () => ({
    PARAMETERS: {
        QUESTION_TYPES: { AUDIO: 'audio', PHOTO: 'photo', VIDEO: 'video' },
        AUDIO_DIR: 'audio',
        PHOTO_DIR: 'photos',
        VIDEO_DIR: 'video',
        ACTIONS: { FILE_DELETED: 'FILE_DELETED', FILE_QUEUED: 'FILE_QUEUED', DRAW: 'DRAW' }
    }
}));

vi.mock('@ionic/vue', () => ({
    popoverController: { create: vi.fn() }
}));

vi.mock('@/models/project-model', () => ({
    projectModel: { getProjectRef: vi.fn().mockReturnValue('proj1') }
}));

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn()
}));

vi.mock('@/components/popovers/PopoverQuestionMedia', () => ({ default: {} }));

function makeDismissable (data) {
    let _resolve;
    const promise = new Promise((resolve) => { _resolve = resolve; });
    return {
        onDidDismiss: () => promise,
        present: vi.fn().mockResolvedValue(),
        _dismiss: (val) => _resolve({ data: val })
    };
}

function makeArgs (overrides = {}) {
    const entryUuid = 'entry1';
    const ref = 'q1';
    const media = { [entryUuid]: { [ref]: { cached: 'a.jpg', stored: '', filenamePWA: { cached: '', stored: '' } } } };
    const state = {
        answer: { answer: 'a.jpg' },
        inputDetails: { ref },
        imageSource: 'img',
        fileSource: 'src',
        filename: 'a.jpg'
    };
    return {
        media,
        entryUuid,
        state,
        e: new Event('click'),
        mediaType: PARAMETERS.QUESTION_TYPES.PHOTO,
        ...overrides
    };
}

describe('popoverMediaHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useRootStore.mockReturnValue({ isPWA: false });
    });

    it('presents the popover and returns a promise that resolves on dismiss', async () => {
        const popover = makeDismissable(null);
        popoverController.create.mockResolvedValue(popover);

        const result = popoverMediaHandler(makeArgs());

        //present is called after create resolves
        await new Promise((r) => setTimeout(r, 0));
        expect(popover.present).toHaveBeenCalled();

        //dismiss resolves the returned promise
        popover._dismiss(null);
        await expect(result).resolves.toBeUndefined();
    });

    it('propagates onAction rejection to the caller', async () => {
        const error = new Error('draw failed');
        const onAction = vi.fn().mockRejectedValue(error);
        const popover = makeDismissable(PARAMETERS.ACTIONS.DRAW);
        popoverController.create.mockResolvedValue(popover);

        const result = popoverMediaHandler(makeArgs({ onAction }));

        popover._dismiss(PARAMETERS.ACTIONS.DRAW);
        await expect(result).rejects.toThrow('draw failed');
    });

    it('awaits a synchronous onAction and still resolves', async () => {
        const onAction = vi.fn().mockReturnValue(undefined);
        const popover = makeDismissable(PARAMETERS.ACTIONS.DRAW);
        popoverController.create.mockResolvedValue(popover);

        const result = popoverMediaHandler(makeArgs({ onAction }));

        popover._dismiss(PARAMETERS.ACTIONS.DRAW);
        await expect(result).resolves.toBeUndefined();
        expect(onAction).toHaveBeenCalledWith(PARAMETERS.ACTIONS.DRAW);
    });

    it('clears state on FILE_DELETED action', async () => {
        const popover = makeDismissable(PARAMETERS.ACTIONS.FILE_DELETED);
        popoverController.create.mockResolvedValue(popover);

        const args = makeArgs();
        const result = popoverMediaHandler(args);

        popover._dismiss(PARAMETERS.ACTIONS.FILE_DELETED);
        await result;

        expect(args.state.filename).toBe('');
        expect(args.state.fileSource).toBe('');
        expect(args.state.imageSource).toBe('');
        expect(args.state.answer.answer).toBe('');
        expect(args.media.entry1.q1.cached).toBe('');
        expect(args.media.entry1.q1.stored).toBe('');
    });

    it('clears state on FILE_QUEUED action but preserves answer', async () => {
        const popover = makeDismissable(PARAMETERS.ACTIONS.FILE_QUEUED);
        popoverController.create.mockResolvedValue(popover);

        const args = makeArgs();
        const result = popoverMediaHandler(args);

        popover._dismiss(PARAMETERS.ACTIONS.FILE_QUEUED);
        await result;

        expect(args.state.filename).toBe('');
        expect(args.state.fileSource).toBe('');
        expect(args.state.answer.answer).toBe('a.jpg');
    });
});
