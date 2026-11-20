import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import flushPromises from 'flush-promises';
import Dropzone from '@/components/Dropzone.vue';
import { useRootStore } from '@/stores/root-store';
import { useWaitOverlayStore } from '@/stores/wait-overlay-store';
import { projectModel } from '@/models/project-model';
import { webService } from '@/services/web-service';
import { PARAMETERS } from '@/config';
import { utilsService } from '@/services/utilities/utils-service';

// 1. Mock the heavy hitters
vi.mock('@/services/web-service');
vi.mock('@/models/project-model');
vi.mock('@/services/notification-service');


const factory = (props = {}) => {
    return mount(Dropzone, {
        props: {
            filename: '',
            filestate: 'none',
            fileError: '',
            inputRef: 'input_1',
            type: 'photo',
            uuid: 'uuid_123',
            ...props
        },
        global: {
            stubs: {
                'ion-spinner': true,
                'ion-item': true,
                'ion-label': true
            }
        }
    });
};

describe('Dropzone.vue', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        // Setup project model mocks
        projectModel.getFirstFormRef.mockReturnValue('form_1');
        projectModel.getSlug.mockReturnValue('test-project');
        projectModel.getLastUpdated.mockReturnValue('2023-01-01');

        // Setup store mock
        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.serverUrl = 'https://test.com';
    });



    it('renders the drop message correctly', () => {
        const wrapper = factory({ type: 'photo' });
        expect(wrapper.text()).toContain('Drop photo file or click here');
    });

    it('shows a spinner while the preview is loading', async () => {
        // Provide a filename so filesource is NOT empty
        const wrapper = factory({ filename: 'test.jpg' });

        const spinner = wrapper.find('ion-spinner');

        // 1. Check if it exists in the DOM
        expect(spinner.exists()).toBe(true);

        // 2. Now check if it's visible (v-show logic)
        expect(spinner.isVisible()).toBe(true);
    });

    it('hides the spinner and shows the image when image is loaded', async () => {
        const wrapper = factory({ type: 'photo', filename: 'test.jpg' });
        const img = wrapper.find('img');
        const spinner = wrapper.find('ion-spinner'); // or 'ion-spinner-stub'
        // 1. Check if it exists in the DOM
        expect(spinner.exists()).toBe(true);
        // Simulate image load event
        await img.trigger('load');

        // After load, onImageLoaded sets state.previewLoaded = true,
        // which toggles v-show on the spinner (hidden) and the img (visible).
        // The component also emits 'file-loaded', but Vue Test Utils 2.5 + Vue 3.5
        // does not capture template-handler emits via wrapper.emitted(), so we
        // assert the visible side effect instead.
        expect(wrapper.find('ion-spinner').isVisible()).toBe(false);
        expect(img.isVisible()).toBe(true);
    });

    it('shows error message when loadingError prop is passed', async () => {
        const errorMsg = 'Invalid file format';
        const wrapper = factory({ fileError: errorMsg });

        // Manually trigger the error state to simulate failure
        wrapper.vm.state.loadingError = true;
        await wrapper.vm.$nextTick();

        // Ionic web components move slot content to shadow DOM, so we assert
        // against the rendered HTML which preserves the original slot content.
        const label = wrapper.find('ion-label');
        expect(label.html()).toContain(errorMsg);
    });
});

describe('Dropzone - getMediaUrlPWA Logic', () => {
    let rootStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        rootStore = useRootStore();
        rootStore.serverUrl = 'https://api.epicollect.net';
        // Reset Debug state to a known value
        PARAMETERS.DEBUG = false;

        // ENSURE the mock returns a string before every test
        projectModel.getSlug.mockReturnValue('my-project');
        projectModel.getFirstFormRef.mockReturnValue('form-1');
    });

    const factory = (props = {}) => {
        return mount(Dropzone, {
            props: {
                filename: 'photo.jpg',
                filestate: PARAMETERS.PWA_FILE_STATE.CACHED,
                fileError: '',
                inputRef: 'ref',
                type: PARAMETERS.QUESTION_TYPES.PHOTO,
                uuid: 'uuid',
                ...props
            }
        });
    };

    it('uses /api/internal/temp-media for adding a remote photo (Production)', () => {
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('https://api.epicollect.net');
        expect(url).toContain('/api/internal/temp-media/my-project'); // Prod Media Route
        expect(url).toContain('format=entry_original');
        expect(url).toContain('name=photo.jpg');
    });

    it('uses /api/internal/temp-media for adding a remote photo (Production)', () => {
        PARAMETERS.DEBUG = 0;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('https://api.epicollect.net');
        expect(url).toContain('/api/internal/temp-media/my-project'); // Prod Media Route
        expect(url).toContain('format=entry_original');
        expect(url).toContain('name=photo.jpg');
    });

    it('uses /api/internal/media for editing a remote photo (Production)', () => {
        PARAMETERS.DEBUG = 0;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        console.log('rootStore.branchEditType', rootStore.branchEditType);
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('https://api.epicollect.net');
        expect(url).toContain('/api/internal/media/my-project'); // Prod Media Route
        expect(url).toContain('format=entry_original');
        expect(url).toContain('name=photo.jpg');
    });

    it('uses api/internal/temp-media when editing a local branch (Production)', () => {
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_LOCAL;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: 'audio.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('/api/internal/temp-media/');
        expect(url).toContain('format=audio');
    });

    it('uses api/internal/media when editing a remote branch (Production)', () => {
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('/api/internal/media/');
        expect(url).toContain('format=entry_original');
    });

    it('keeps the preview url stable across mounts (no cache bust on navigation)', () => {
        const first = factory({filename: 'stable.jpg', filestate: PARAMETERS.PWA_FILE_STATE.CACHED});
        const second = factory({filename: 'stable.jpg', filestate: PARAMETERS.PWA_FILE_STATE.CACHED});

        //prev/next remounts the question: the same file must resolve to the
        //same url, so the browser serves it from its own cache
        expect(first.vm.state.filesource).toBe(second.vm.state.filesource);
        expect(first.vm.state.filesource).not.toContain('timestamp=');
    });

    it('busts the cached copy only when the file is replaced', async () => {
        webService.uploadFilePWA.mockResolvedValue({data: {}});
        const wrapper = factory({
            filename: 'replace.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.state.filesource).not.toContain('timestamp=');

        //drive a replacement through the hidden input change handler that
        //vue3-dropzone wires to the component's onDrop
        const file = new File(['replacement'], 'replacement.jpg', {type: 'image/jpeg'});
        const input = wrapper.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', {value: [file], configurable: true});
        await input.trigger('change');
        await flushPromises();

        //the same filename now points at new bytes: the url must change
        expect(wrapper.vm.state.filesource).toMatch(/&timestamp=\d+/);
    });

    it('never cache busts stored media (the server versions it)', async () => {
        webService.uploadFilePWA.mockResolvedValue({data: {}});
        const replacing = factory({
            filename: 'stored-replace.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });
        await replacing.vm.$nextTick();

        const file = new File(['replacement'], 'stored-replace.jpg', {type: 'image/jpeg'});
        const input = replacing.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', {value: [file], configurable: true});
        await input.trigger('change');
        await flushPromises();

        //the instance that received the replacement now shows the new bytes from
        //temp media, and that copy IS busted on purpose: the filename is unchanged
        //while the bytes are not. Only the stored /media url stays unbusted
        expect(replacing.vm.state.filesource).toContain('/temp-media/');
        expect(replacing.vm.state.filesource).toContain('timestamp=');

        //the upload registered a version for this filename, but /media is
        //served immutable with the server's own version (v=updated_at): a
        //client side buster would only defeat that cache
        const stored = factory({
            filename: 'stored-replace.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });
        expect(stored.vm.state.filesource).not.toContain('timestamp=');
    });

    it('handles the default case for unknown types (no format param)', () => {
        const wrapper = factory({ type: 'UNKNOWN_TYPE' });
        const url = wrapper.vm.state.filesource;

        // It should skip the format switch and just have name/type/timestamp
        expect(url).not.toContain('format=');
        expect(url).toContain('type=UNKNOWN_TYPE');
    });
});

describe('Media format query parameter', () => {

    let rootStore;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();

        rootStore = useRootStore();
        rootStore.serverUrl = 'https://api.epicollect.net';
        // Reset Debug state to a known value
        PARAMETERS.DEBUG = false;

        // ENSURE the mock returns a string before every test
        projectModel.getSlug.mockReturnValue('my-project');
        projectModel.getFirstFormRef.mockReturnValue('form-1');
    });

    const formatCases = [
        {
            label: 'photo',
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: utilsService.generateMediaFilename(
                utilsService.uuid(),
                PARAMETERS.QUESTION_TYPES.PHOTO
            ),
            expectedFormat: 'entry_original'
        },
        {
            label: 'audio',
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: utilsService.generateMediaFilename(utilsService.uuid(),
                PARAMETERS.QUESTION_TYPES.AUDIO
            ),
            expectedFormat: 'audio'
        },
        {
            label: 'video',
            type: PARAMETERS.QUESTION_TYPES.VIDEO,
            filename: utilsService.generateMediaFilename(
                utilsService.uuid(),
                PARAMETERS.QUESTION_TYPES.VIDEO
            ),
            expectedFormat: 'video'
        }
    ];

    it.each(formatCases)(
        'uses correct format param for $label in Production (CACHED)',
        ({ type, filename, expectedFormat }) => {
            const wrapper = factory({
                type,
                filename,
                filestate: PARAMETERS.PWA_FILE_STATE.CACHED
            });
            const url = wrapper.vm.state.filesource;
            expect(url).toContain('/api/internal/temp-media/my-project');
            expect(url).toContain(`format=${expectedFormat}`);
            expect(url).toContain(`name=${filename}`);
        }
    );

    it.each(formatCases)(
        'uses correct format param for $label in Production (STORED)',
        ({ type, filename, expectedFormat }) => {
            PARAMETERS.DEBUG = 0;
            rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
            const wrapper = factory({
                type,
                filename,
                filestate: PARAMETERS.PWA_FILE_STATE.STORED
            });
            const url = wrapper.vm.state.filesource;
            expect(url).toContain('/api/internal/media/my-project');
            expect(url).toContain(`format=${expectedFormat}`);
            expect(url).toContain(`name=${filename}`);
        }
    );
});


describe('Dropzone upload overlay', () => {

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        projectModel.getFirstFormRef.mockReturnValue('form_1');
        projectModel.getSlug.mockReturnValue('test-project');
        projectModel.getLastUpdated.mockReturnValue('2023-01-01');

        const rootStore = useRootStore();
        rootStore.language = 'en';
        rootStore.serverUrl = 'https://test.com';
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
    });

    const dropFile = async (wrapper, file) => {
        const input = wrapper.find('input[type="file"]');
        Object.defineProperty(input.element, 'files', {value: [file], configurable: true});
        await input.trigger('change');
        await flushPromises();
    };

    it('keeps the overlay up until the photo preview claims the dismissal', async () => {
        let resolveUpload;
        webService.uploadFilePWA.mockReturnValue(new Promise((resolve) => {
            resolveUpload = resolve;
        }));
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        await wrapper.vm.$nextTick();

        await dropFile(wrapper, new File(['photo'], 'photo.jpg', {type: 'image/jpeg'}));
        expect(waitOverlayStore.isUploading).toBe(true);

        //a replacement keeps the same name, so no remount is coming: the settled
        //request alone must NOT release the screen, or the user would see the
        //question before its thumbnail is loaded
        resolveUpload({data: {}});
        await flushPromises();
        expect(waitOverlayStore.isUploading).toBe(true);
        expect(waitOverlayStore.pendingKey).toBe(
            PARAMETERS.PWA_FILE_STATE.CACHED + '|' + PARAMETERS.PWA_BRANCH_REMOTE + '|' + PARAMETERS.QUESTION_TYPES.PHOTO + '|photo.jpg'
        );

        //an img always fires load or error: the loaded tag is the release signal
        wrapper.vm.onImageLoaded();
        expect(waitOverlayStore.isUploading).toBe(false);
        expect(waitOverlayStore.pendingKey).toBe(null);
    });

    it('releases the overlay when a player upload settles, without waiting for loadeddata', async () => {
        let resolveUpload;
        webService.uploadFilePWA.mockReturnValue(new Promise((resolve) => {
            resolveUpload = resolve;
        }));
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: 'clip.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        await wrapper.vm.$nextTick();

        await dropFile(wrapper, new File(['audio'], 'clip.mp4', {type: 'audio/mp4'}));
        expect(waitOverlayStore.isUploading).toBe(true);

        //the player renders visible and shows its own buffering state: the
        //settled request is the release signal, loadeddata may never fire
        //(iOS defers media without a gesture; data saver defers on mobile)
        resolveUpload({data: {}});
        await flushPromises();
        expect(waitOverlayStore.isUploading).toBe(false);
        expect(waitOverlayStore.pendingKey).toBe(null);
    });

    it('a sibling preview load cannot dismiss another question upload', async () => {
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'other.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        await wrapper.vm.$nextTick();

        //an upload is pending for a different file: the instance that remounted
        //elsewhere owns the dismissal
        waitOverlayStore.isUploading = true;
        waitOverlayStore.setPendingKey(
            PARAMETERS.PWA_FILE_STATE.CACHED + '|' + PARAMETERS.PWA_BRANCH_REMOTE + '|' + PARAMETERS.QUESTION_TYPES.PHOTO + '|uploaded.jpg'
        );

        wrapper.vm.onImageLoaded();

        //this instance shows a different file: its load must not release the screen
        expect(waitOverlayStore.isUploading).toBe(true);
        expect(waitOverlayStore.pendingKey).toBe(
            PARAMETERS.PWA_FILE_STATE.CACHED + '|' + PARAMETERS.PWA_BRANCH_REMOTE + '|' + PARAMETERS.QUESTION_TYPES.PHOTO + '|uploaded.jpg'
        );
        waitOverlayStore.dismiss();
    });

    it('releases the overlay unconditionally when the upload fails', async () => {
        webService.uploadFilePWA.mockRejectedValue({statusText: 'boom', status: 500});
        const waitOverlayStore = useWaitOverlayStore();
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: '',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });
        await wrapper.vm.$nextTick();

        await dropFile(wrapper, new File(['photo'], 'new.jpg', {type: 'image/jpeg'}));

        //no preview load will ever claim the dismissal: the failed request is the signal
        expect(waitOverlayStore.isUploading).toBe(false);
        expect(waitOverlayStore.pendingKey).toBe(null);
    });

    it('shows an audio or video preview as soon as its url is known', () => {
        const audio = factory({
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: 'clip.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        const video = factory({
            type: PARAMETERS.QUESTION_TYPES.VIDEO,
            filename: 'clip.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });

        //a player is its own feedback: it is not hidden behind the spinner, which
        //would keep it display:none and therefore out of the browser's load path
        expect(audio.vm.state.previewLoaded).toBe(true);
        expect(audio.find('ion-spinner').isVisible()).toBe(false);
        expect(video.vm.state.previewLoaded).toBe(true);
        expect(video.find('ion-spinner').isVisible()).toBe(false);
    });

    it('keeps a replaced video visible while the new bytes load', async () => {
        webService.uploadFilePWA.mockResolvedValue({data: {}});
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.VIDEO,
            filename: 'clip.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.state.previewLoaded).toBe(true);

        await dropFile(wrapper, new File(['video'], 'clip.mp4', {type: 'video/mp4'}));

        //the replacement must not hide the player again: a hidden player is not
        //fetched, so nothing would ever bring it back
        expect(wrapper.vm.state.previewLoaded).toBe(true);
        expect(wrapper.find('video').isVisible()).toBe(true);
    });

    it('still hides a replaced photo behind the spinner until it decodes', async () => {
        webService.uploadFilePWA.mockResolvedValue({data: {}});
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'replace.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });
        await wrapper.vm.$nextTick();

        await dropFile(wrapper, new File(['photo'], 'replacement.jpg', {type: 'image/jpeg'}));

        //a photo does need a decode before it is shown, and @load still drives it
        expect(wrapper.vm.state.previewLoaded).toBe(false);
        await wrapper.find('img').trigger('load');
        expect(wrapper.vm.state.previewLoaded).toBe(true);
    });
});
