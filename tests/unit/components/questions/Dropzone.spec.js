import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import Dropzone from '@/components/Dropzone.vue';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model';
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
            stubs: { 'ion-spinner': true, 'ion-item': true, 'ion-label': true }
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

        expect(wrapper.find('ion-spinner').isVisible()).toBe(false);
        expect(img.isVisible()).toBe(true);
        expect(wrapper.emitted()).toHaveProperty('file-loaded');
    });

    it('shows error message when loadingError prop is passed', async () => {
        const errorMsg = 'Invalid file format';
        const wrapper = factory({ fileError: errorMsg });

        // Manually trigger the error state to simulate failure
        wrapper.vm.state.loadingError = true;
        await wrapper.vm.$nextTick();

        const label = wrapper.find('ion-label');
        expect(label.text()).toBe(errorMsg);
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

    it('uses /api/pwa/temp-media-debug for adding a remote photo (Debug)', () => {
        PARAMETERS.DEBUG = 1;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.CACHED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('https://api.epicollect.net');
        expect(url).toContain('/api/pwa/temp-media-debug/my-project'); // Prod Media Route
        expect(url).toContain('format=entry_original');
        expect(url).toContain('name=photo.jpg');
    });

    it('uses /api/pwa/media-debug for editing a remote photo (Debug)', () => {
        PARAMETERS.DEBUG = 1;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.PHOTO,
            filename: 'photo.jpg',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('https://api.epicollect.net');
        expect(url).toContain('/api/pwa/media-debug/my-project'); // Prod Media Route
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

    it('uses api/pwa/temp-media-debug when editing a local branch (Debug)', () => {
        PARAMETERS.DEBUG = 1;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_LOCAL;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: 'audio.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('/api/pwa/temp-media-debug/');
        expect(url).toContain('format=audio');
    });

    it('uses api/pwa/media-debug when editing a remote branch (Debug)', () => {
        PARAMETERS.DEBUG = 1;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        const wrapper = factory({
            type: PARAMETERS.QUESTION_TYPES.AUDIO,
            filename: 'audio.mp4',
            filestate: PARAMETERS.PWA_FILE_STATE.STORED
        });

        const url = wrapper.vm.state.filesource;
        expect(url).toContain('/api/pwa/media-debug/');
        expect(url).toContain('format=audio');
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

    it('correctly appends the timestamp for cache busting', () => {
        const wrapper = factory();
        const url = wrapper.vm.state.filesource;

        // Regex to check if timestamp param exists and has a value
        expect(url).toMatch(/&timestamp=\d+/);
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

    it.each(formatCases)(
        'uses correct format param for $label in Debug (CACHED)',
        ({ type, filename, expectedFormat }) => {
            PARAMETERS.DEBUG = 1;
            const wrapper = factory({
                type,
                filename,
                filestate: PARAMETERS.PWA_FILE_STATE.CACHED
            });
            const url = wrapper.vm.state.filesource;
            expect(url).toContain('/api/pwa/temp-media-debug/my-project');
            expect(url).toContain(`format=${expectedFormat}`);
            expect(url).toContain(`name=${filename}`);
        }
    );

    it.each(formatCases)(
        'uses correct format param for $label in Debug (STORED)',
        ({ type, filename, expectedFormat }) => {
            PARAMETERS.DEBUG = 1;
            rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
            const wrapper = factory({
                type,
                filename,
                filestate: PARAMETERS.PWA_FILE_STATE.STORED
            });
            const url = wrapper.vm.state.filesource;
            expect(url).toContain('/api/pwa/media-debug/my-project');
            expect(url).toContain(`format=${expectedFormat}`);
            expect(url).toContain(`name=${filename}`);
        }
    );
});

