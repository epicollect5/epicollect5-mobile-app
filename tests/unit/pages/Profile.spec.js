import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import Profile from '@/pages/Profile.vue';
import { PARAMETERS } from '@/config';
import { useBackButton } from '@ionic/vue';

const rootStoreMock = vi.hoisted(() => ({
    language: 'en',
    nextRoute: 'projects',
    routeParams: {},
    user: { name: 'Test', email: 'test@example.com' }
}));

const routerReplace = vi.hoisted(() => vi.fn());

vi.mock('@/stores/root-store', () => ({
    useRootStore: () => rootStoreMock
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: routerReplace })
}));

vi.mock('@ionic/vue', () => ({
    useBackButton: vi.fn(),
    modalController: { create: vi.fn() }
}));

vi.mock('@/config/strings', () => ({
    STRINGS: {
        en: {
            labels: {
                back: 'Back',
                profile: 'Profile',
                name: 'Name',
                email: 'Email',
                danger: 'Danger',
                delete_account: 'Delete account'
            }
        }
    }
}));

function mountProfile() {
    return shallowMount(Profile, {
        global: {
            stubs: {
                'base-layout': { template: '<div><slot name="content" /></div>' },
                'ion-button': true,
                'ion-buttons': true,
                'ion-card': true,
                'ion-card-content': true,
                'ion-card-header': true,
                'ion-card-title': true,
                'ion-icon': true,
                'ion-item': true,
                'ion-label': true,
                'ion-menu-button': true,
                'ion-toolbar': true
            }
        }
    });
}

describe('Profile page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        rootStoreMock.language = 'en';
        rootStoreMock.nextRoute = 'projects';
        rootStoreMock.routeParams = {};
    });

    it('navigates to the saved route when going back', () => {
        rootStoreMock.nextRoute = 'entries';
        rootStoreMock.routeParams = { projectRef: 'p1' };
        const wrapper = mountProfile();

        wrapper.vm.goBack();

        expect(routerReplace).toHaveBeenCalledWith({
            name: 'entries',
            params: { projectRef: 'p1' }
        });
    });

    it('falls back to the projects page when the saved route is missing', () => {
        rootStoreMock.nextRoute = null;
        const wrapper = mountProfile();

        wrapper.vm.goBack();

        expect(routerReplace).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
    });

    it('falls back to the projects page when the saved route is empty', () => {
        rootStoreMock.nextRoute = '';
        const wrapper = mountProfile();

        wrapper.vm.goBack();

        expect(routerReplace).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
    });

    it('wires the hardware back button to goBack', () => {
        mountProfile();

        expect(useBackButton).toHaveBeenCalled();
        const backHandler = useBackButton.mock.calls[0][1];

        rootStoreMock.nextRoute = null;
        backHandler();

        expect(routerReplace).toHaveBeenCalledWith({
            name: PARAMETERS.ROUTES.PROJECTS
        });
    });
});
