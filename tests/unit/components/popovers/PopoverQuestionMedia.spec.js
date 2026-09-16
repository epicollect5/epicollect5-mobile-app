import {describe, it, expect, beforeEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import PopoverQuestionMedia from '@/components/popovers/PopoverQuestionMedia.vue';
import {popoverController} from '@ionic/vue';
import {PARAMETERS} from '@/config';

vi.mock('@ionic/vue', () => ({
    popoverController: {
        dismiss: vi.fn()
    }
}));

const ION_STUBS = {
    'ion-content': true,
    'ion-list': true,
    'ion-item': true,
    'ion-icon': true,
    'ion-label': true
};

function mountPopover(mediaType) {
    return mount(PopoverQuestionMedia, {
        props: {
            entryUuid: 'entry-uuid-1',
            projectRef: 'proj-ref',
            inputRef: 'test_ref',
            media: {'entry-uuid-1': {'test_ref': {cached: 'file.jpg', stored: ''}}},
            mediaFolder: PARAMETERS.PHOTO_DIR,
            mediaType
        },
        global: {
            stubs: ION_STUBS
        }
    });
}

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
});

describe('PopoverQuestionMedia component', () => {

    it('shows the Draw entry on top of share and delete for photos', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.PHOTO);
        await flushPromises();

        const items = wrapper.findAll('ion-item');
        expect(items).toHaveLength(3);
        //Draw is the first row, above share and delete
        expect(items[0].text().trim()).toBe('Draw Beta');
        expect(items[1].text().trim()).toBe('Share');
        expect(items[2].text().trim()).toBe('Delete');
    });

    it('hides the Draw entry for non-photo media', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.VIDEO);
        await flushPromises();

        const items = wrapper.findAll('ion-item');
        expect(items).toHaveLength(2);
        expect(items.map((item) => item.text().trim())).not.toContain('Draw');
    });

    it('dismisses with the DRAW action when the Draw entry is tapped', async () => {
        const wrapper = mountPopover(PARAMETERS.QUESTION_TYPES.PHOTO);
        await flushPromises();

        wrapper.findAll('ion-item')[0].trigger('click');
        await flushPromises();

        //the caller (QuestionPhoto) reacts to the DRAW action and opens the pad
        expect(popoverController.dismiss).toHaveBeenCalledWith(PARAMETERS.ACTIONS.DRAW);
    });
});
