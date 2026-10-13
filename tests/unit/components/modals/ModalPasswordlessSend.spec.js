import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import fs from 'fs';
import path from 'path';
import ModalPasswordlessSend from '@/components/modals/ModalPasswordlessSend.vue';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en'
    }))
}));

describe('ModalPasswordlessSend', () => {
    it('pins a readable dark-mode email field', () => {
        //transparent input over the dark card washes out text, placeholder
        //and caret: the stylesheet must pin a black field, grey border and
        //matching caret under body.theme-dark
        const scss = fs.readFileSync(path.resolve(__dirname, '../../../../src/theme/components/modals/ModalPasswordlessSend.scss'), 'utf8');

        expect(scss).toContain('body.theme-dark .modal-passwordless-send');
        expect(scss).toContain('--background: #000');
        expect(scss).toContain('caret-color: var(--app-text)');
    });

    it('renders the email input', () => {
        const wrapper = shallowMount(ModalPasswordlessSend);

        expect(wrapper.find('ion-input').exists()).toBe(true);
    });
});
