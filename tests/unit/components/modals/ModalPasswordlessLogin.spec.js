import { describe, it, expect, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import fs from 'fs';
import path from 'path';
import ModalPasswordlessLogin from '@/components/modals/ModalPasswordlessLogin.vue';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({
        language: 'en'
    }))
}));

describe('ModalPasswordlessLogin', () => {
    it('pins a readable dark-mode code field', () => {
        //transparent input over the dark card washes out text, placeholder
        //and caret: the stylesheet must pin a black field, grey border and
        //matching caret under body.theme-dark
        const scss = fs.readFileSync(path.resolve(__dirname, '../../../../src/theme/components/modals/ModalPasswordlessLogin.scss'), 'utf8');

        expect(scss).toContain('body.theme-dark .modal-passwordless-login');
        expect(scss).toContain('--background: #000');
        expect(scss).toContain('caret-color: var(--app-text)');
        expect(scss).toContain('--highlight-color-focused: var(--app-text)');
        expect(scss).toContain('--padding-start: 12px');
    });

    it('renders the code input', () => {
        const wrapper = shallowMount(ModalPasswordlessLogin, {
            props: {
                email: 'test@example.com'
            }
        });

        expect(wrapper.find('ion-input').exists()).toBe(true);
    });
});
