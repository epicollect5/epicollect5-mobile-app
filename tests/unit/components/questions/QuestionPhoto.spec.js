import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import QuestionPhoto from '@/components/questions/QuestionPhoto.vue';
import ModalDraw from '@/components/modals/ModalDraw.vue';
import {useRootStore} from '@/stores/root-store';
import {modalController} from '@ionic/vue';
import {Capacitor} from '@capacitor/core';
import {utilsService} from '@/services/utilities/utils-service';
import {notificationService} from '@/services/notification-service';
import {saveBlobToTempDir} from '@/services/filesystem/save-blob-to-temp-service';
import {popoverMediaHandler} from '@/use/questions/popover-media-handler';
import {PARAMETERS} from '@/config';

//instances created by modalController.create, so tests can resolve the
//draw modal's dismissal like the real controller does
const {modalInstances} = vi.hoisted(() => ({modalInstances: []}));
const {modalDismissResolvers} = vi.hoisted(() => ({modalDismissResolvers: []}));

vi.mock('@/services/entry/question-common-service', () => {
    const questionCommonService = {
        //fill just the fields the draw flow reads; the real service pulls
        //from the project model, which does not exist in unit tests
        setUpInputParams: vi.fn((state) => {
            state.inputDetails = {
                ref: 'test_ref',
                type: 'photo',
                is_required: false,
                question: 'Take a picture',
                regex: null
            };
        })
    };
    return {questionCommonService};
});

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(() => Promise.resolve(true)),
        showAlert: vi.fn()
    }
}));

vi.mock('@/services/filesystem/save-blob-to-temp-service', () => ({
    saveBlobToTempDir: vi.fn(() => Promise.resolve())
}));

vi.mock('@/use/questions/photo-take', () => ({
    photoTake: vi.fn()
}));

vi.mock('@/use/questions/popover-media-handler', () => ({
    popoverMediaHandler: vi.fn(async () => {})
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        convertFileSrc: vi.fn((source) => source)
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        dismiss: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => {
            const modal = {
                present: vi.fn(() => Promise.resolve()),
                onDidDismiss: vi.fn(() => {
                    return new Promise((resolve) => {
                        modalDismissResolvers.push(resolve);
                    });
                })
            };
            modalInstances.push(modal);
            return Promise.resolve(modal);
        })
    }
}));

//ModalDraw is imported by QuestionPhoto; its padding library must be mocked
//in jsdom just like the ModalDraw spec does
vi.mock('signature_pad', () => {
    class MockSignaturePad {
        constructor() {
            this.listeners = {};
            this.addEventListener = vi.fn();
            this.off = vi.fn();
            this.clear = vi.fn();
            this.fromData = vi.fn();
            this.toData = vi.fn(() => []);
        }
    }
    return {default: MockSignaturePad};
});

const ION_STUBS = {
    'ion-card': true,
    'ion-card-header': true,
    'ion-card-title': true,
    'ion-card-content': true,
    'ion-grid': true,
    'ion-row': true,
    'ion-col': true,
    'ion-icon': true,
    'ion-button': true,
    QuestionLabelAction: true,
    Dropzone: true
};

const ENTRIES = {
    error: {},
    answers: {'test_ref': {answer: '', was_jumped: false}},
    confirmAnswer: {'test_ref': {}},
    questionParams: {isBranch: false}
};

function makeMedia() {
    return {
        entryService: {
            entry: {
                entryUuid: 'entry-uuid-1',
                projectRef: 'proj-ref',
                media: {}
            }
        },
        branchEntryService: {
            entry: {media: {}}
        }
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    modalInstances.length = 0;
    modalDismissResolvers.length = 0;
    const rootStore = useRootStore();
    rootStore.language = 'en';
    rootStore.device = {platform: 'android'};
    rootStore.tempDir = 'temp/';
    rootStore.persistentDir = 'persistent/';
    rootStore.entriesAddScope = makeMedia();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function factory(entriesAddState = ENTRIES) {
    const wrapper = mount(QuestionPhoto, {
        props: {
            inputRef: 'test_ref',
            type: 'photo',
            isGroupInput: false
        },
        global: {
            provide: {entriesAddState},
            stubs: ION_STUBS
        }
    });
    await flushPromises();
    return wrapper;
}

//the media bucket the component rides on for this entry/input
function mediaFile() {
    return useRootStore().entriesAddScope.entryService.entry.media['entry-uuid-1']['test_ref'];
}

describe('QuestionPhoto component', () => {

    it('opens the draw pad from the media popover Draw action', async () => {
        const wrapper = await factory();
        //the popover only opens when a file is present; Draw rides on it
        mediaFile().cached = 'photo.jpg';
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            blob: () => Promise.resolve(new Blob(['fake-jpeg'], {type: 'image/jpeg'}))
        })));

        await wrapper.vm.openPopover({});
        await flushPromises();

        //the popover handler gets the photo type and the action callback
        expect(popoverMediaHandler).toHaveBeenCalledWith(expect.objectContaining({
            mediaType: PARAMETERS.QUESTION_TYPES.PHOTO,
            onAction: expect.any(Function)
        }));
        const onAction = popoverMediaHandler.mock.calls[0][0].onAction;
        expect(modalController.create).not.toHaveBeenCalled();

        //its Draw entry dismisses with the DRAW action -> the pad opens;
        //the call chain includes an event-driven FileReader, so wait for it
        onAction(PARAMETERS.ACTIONS.DRAW);
        await vi.waitFor(() => {
            expect(modalController.create).toHaveBeenCalled();
        });
        expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
            component: ModalDraw,
            componentProps: {existingDataURL: expect.stringContaining('data:image/jpeg;base64')}
        }));
        expect(useRootStore().isDrawModalActive).toBe(true);
        vi.unstubAllGlobals();
    });

    it('does not open the draw pad on the web platform', async () => {
        useRootStore().device.platform = 'web';
        const wrapper = await factory();

        await wrapper.vm.openDrawPad();

        expect(modalController.create).not.toHaveBeenCalled();
        expect(useRootStore().isDrawModalActive).toBe(false);
    });

    it('loads a cached drawing into the draw modal', async () => {
        const wrapper = await factory();
        mediaFile().cached = 'drawing.jpg';
        //fetch resolves with a small JPEG blob, like the cached file
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            blob: () => Promise.resolve(new Blob(['fake-jpeg'], {type: 'image/jpeg'}))
        })));

        await wrapper.vm.openDrawPad();
        await flushPromises();

        expect(Capacitor.convertFileSrc).toHaveBeenCalledWith('temp/drawing.jpg');
        expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
            component: ModalDraw,
            cssClass: 'modal-draw',
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {
                existingDataURL: expect.stringContaining('data:image/jpeg;base64')
            }
        }));
        //the pad is guarded against the Android back button while open
        expect(useRootStore().isDrawModalActive).toBe(true);
        vi.unstubAllGlobals();
    });

    it('reuses the cached filename when the drawing is saved', async () => {
        const wrapper = await factory();
        mediaFile().cached = 'drawing.jpg';
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            blob: () => Promise.resolve(new Blob(['fake-jpeg'], {type: 'image/jpeg'}))
        })));
        await wrapper.vm.openDrawPad();
        await flushPromises();

        //draw modal dismissed with the rasterized drawing
        modalDismissResolvers[0]({data: {dataURL: 'data:image/jpeg;base64,AAAA'}});
        await flushPromises();

        //same filename as the cached one: download/upload refer to it
        expect(saveBlobToTempDir).toHaveBeenCalledWith({
            blob: expect.anything(),
            filename: 'drawing.jpg'
        });
        expect(mediaFile().cached).toBe('drawing.jpg');
        expect(wrapper.vm.state.answer.answer).toBe('drawing.jpg');
        //the thumbnail was reloaded from the temp copy
        expect(wrapper.vm.state.imageSource).toContain('temp/drawing.jpg');
        //the back-button guard is released with the modal
        expect(useRootStore().isDrawModalActive).toBe(false);
        vi.unstubAllGlobals();
    });

    it('generates a fresh filename when the drawing has no cached or stored file', async () => {
        vi.spyOn(utilsService, 'generateMediaFilename').mockReturnValue('new-drawing.jpg');
        const wrapper = await factory();
        await wrapper.vm.openDrawPad();
        await flushPromises();

        modalDismissResolvers[0]({data: {dataURL: 'data:image/jpeg;base64,AAAA'}});
        await flushPromises();

        expect(utilsService.generateMediaFilename).toHaveBeenCalledWith('entry-uuid-1', 'photo');
        expect(saveBlobToTempDir).toHaveBeenCalledWith({
            blob: expect.anything(),
            filename: 'new-drawing.jpg'
        });
        expect(mediaFile().cached).toBe('new-drawing.jpg');
        expect(wrapper.vm.state.answer.answer).toBe('new-drawing.jpg');
    });

    it('resets the question when saving the drawing fails', async () => {
        const wrapper = await factory();
        mediaFile().cached = 'drawing.jpg';
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
            blob: () => Promise.resolve(new Blob(['fake-jpeg'], {type: 'image/jpeg'}))
        })));
        await wrapper.vm.openDrawPad();
        await flushPromises();

        saveBlobToTempDir.mockRejectedValueOnce(new Error('disk full'));
        modalDismissResolvers[0]({data: {dataURL: 'data:image/jpeg;base64,AAAA'}});
        await flushPromises();

        //nothing sticks: the question reports no drawing and warns the user
        expect(mediaFile().cached).toBe('');
        expect(wrapper.vm.state.answer.answer).toBe('');
        expect(notificationService.showAlert).toHaveBeenCalledWith(
            'Unknown error',
            'Error'
        );
        vi.unstubAllGlobals();
    });

    it('ignores a dismissal without a drawing (cancel)', async () => {
        const wrapper = await factory();
        await wrapper.vm.openDrawPad();
        await flushPromises();

        modalDismissResolvers[0]({data: null});
        await flushPromises();

        expect(saveBlobToTempDir).not.toHaveBeenCalled();
        expect(mediaFile().cached).toBe('');
        expect(wrapper.vm.state.answer.answer).toBe('');
        expect(useRootStore().isDrawModalActive).toBe(false);
    });
});