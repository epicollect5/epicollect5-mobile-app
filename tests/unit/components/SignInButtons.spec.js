import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import SignInWithGoogleButton from '@/components/SignInWithGoogleButton.vue';
import SignInWithAppleButton from '@/components/SignInWithAppleButton.vue';
import CardLoginDefault from '@/components/CardLoginDefault.vue';
import { useRootStore } from '@/stores/root-store';
import { authGoogleService } from '@/services/auth/auth-google-service';
import { authAppleService } from '@/services/auth/auth-apple-service';

vi.mock('@/services/auth/auth-google-service', () => ({
    authGoogleService: {
        authGoogleUser: vi.fn()
    }
}));

vi.mock('@/services/auth/auth-apple-service', () => ({
    authAppleService: {
        authAppleUser: vi.fn()
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        create: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/components/modals/ModalPasswordlessSend.vue', () => ({
    default: { name: 'ModalPasswordlessSend' }
}));

let wrapper = null;

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
});

afterEach(() => {
    if (wrapper) {
        wrapper.unmount();
        wrapper = null;
    }
});

describe('SignInWithGoogleButton.vue', () => {

    it('renders the official full-color Google G (never a monochrome icon)', () => {
        wrapper = mount(SignInWithGoogleButton, { props: { label: 'Sign in with Google' } });
        const svg = wrapper.find('.signin-google-btn-icon svg');
        expect(svg.exists()).toBe(true);
        const html = svg.html();
        expect(html).toContain('#EA4335');
        expect(html).toContain('#4285F4');
        expect(html).toContain('#FBBC05');
        expect(html).toContain('#34A853');
    });

    it('renders the localized label passed via props', () => {
        wrapper = mount(SignInWithGoogleButton, { props: { label: 'Mit Google anmelden' } });
        expect(wrapper.find('.signin-google-btn-contents').text()).toBe('Mit Google anmelden');
    });

    it('emits signin on click (no auth logic in the component)', async () => {
        wrapper = mount(SignInWithGoogleButton, { props: { label: 'Sign in with Google' } });
        await wrapper.find('button[type="button"]').trigger('click');
        expect(wrapper.emitted('signin')).toBeTruthy();
        expect(wrapper.emitted('signin')).toHaveLength(1);
    });
});

describe('SignInWithAppleButton.vue', () => {

    it('renders the official Apple logo artwork driven by the button color', () => {
        wrapper = mount(SignInWithAppleButton, { props: { label: 'Sign in with Apple' } });
        const logo = wrapper.find('.signin-apple-btn-icon svg');
        expect(logo.exists()).toBe(true);
        expect(logo.html()).toContain('currentColor');
        expect(logo.html()).toContain('M12.6902416,29.5');
    });

    it('renders the localized label passed via props', () => {
        wrapper = mount(SignInWithAppleButton, { props: { label: 'Mit Apple anmelden' } });
        expect(wrapper.find('.signin-apple-btn-contents').text()).toBe('Mit Apple anmelden');
    });

    it('emits signin on click (no auth logic in the component)', async () => {
        wrapper = mount(SignInWithAppleButton, { props: { label: 'Sign in with Apple' } });
        await wrapper.find('button[type="button"]').trigger('click');
        expect(wrapper.emitted('signin')).toBeTruthy();
        expect(wrapper.emitted('signin')).toHaveLength(1);
    });
});

describe('CardLoginDefault.vue sign-in buttons', () => {

    function mountCardLogin(authMethods) {
        const rootStore = useRootStore();
        rootStore.device = { platform: 'ios', osVersion: '17' };
        return mount(CardLoginDefault, {
            props: {
                authMethods,
                authIds: { google: { CLIENT_ID: 'test-client-id' } }
            }
        });
    }

    it('renders the Google button with the localized label', () => {
        wrapper = mountCardLogin(['google']);
        const button = wrapper.findComponent(SignInWithGoogleButton);
        expect(button.exists()).toBe(true);
        expect(button.props('label')).toBe('Sign in with Google');
        expect(button.find('.signin-google-btn-contents').text()).toBe('Sign in with Google');
    });

    it('delegates the Google signin event to the auth service', async () => {
        wrapper = mountCardLogin(['google']);
        wrapper.findComponent(SignInWithGoogleButton).vm.$emit('signin');
        await wrapper.vm.$nextTick();
        expect(authGoogleService.authGoogleUser).toHaveBeenCalledWith({
            google: { CLIENT_ID: 'test-client-id' }
        });
    });

    it('renders the Apple button with the localized label on iOS 13+', () => {
        wrapper = mountCardLogin(['apple']);
        const button = wrapper.findComponent(SignInWithAppleButton);
        expect(button.exists()).toBe(true);
        expect(button.props('label')).toBe('Sign in with Apple');
        expect(button.find('.signin-apple-btn-contents').text()).toBe('Sign in with Apple');
    });

    it('delegates the Apple signin event to the auth service', async () => {
        wrapper = mountCardLogin(['apple']);
        wrapper.findComponent(SignInWithAppleButton).vm.$emit('signin');
        await wrapper.vm.$nextTick();
        expect(authAppleService.authAppleUser).toHaveBeenCalledTimes(1);
    });

    it('renders no provider images anymore', () => {
        wrapper = mountCardLogin(['google', 'apple']);
        expect(wrapper.findAll('img')).toHaveLength(0);
    });
});
