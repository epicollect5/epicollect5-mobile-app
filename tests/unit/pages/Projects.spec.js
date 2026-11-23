import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useBackButton } from '@ionic/vue';
import { App } from '@capacitor/app';
import { useRootStore } from '@/stores/root-store';
import Projects from '@/pages/Projects.vue';
import { notificationService } from '@/services/notification-service';
import { fetchLocalProjects } from '@/use/project/fetch-local-projects';

vi.mock('vue-router', () => ({
    useRouter: () => ({replace: vi.fn()}),
    useRoute: () => ({params: {}})
}));

vi.mock('@ionic/vue', () => ({
    useBackButton: vi.fn(),
    onIonViewWillEnter: vi.fn(),
    onIonViewWillLeave: vi.fn()
}));

vi.mock('@capacitor/app', () => ({
    App: {
        exitApp: vi.fn()
    }
}));

vi.mock('@/use/project/fetch-local-projects', () => ({
    fetchLocalProjects: vi.fn()
}));

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(),
        hideProgressDialog: vi.fn()
    }
}));

describe('Projects - hardware back button', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        const rootStore = useRootStore();
        rootStore.language = 'en';
        fetchLocalProjects.mockResolvedValue([]);
    });

    const mountPage = () => {
        return mount(Projects, {
            global: {
                stubs: {
                    'base-layout': true,
                    ListItemProjects: true
                }
            }
        });
    };

    const getBackHandler = () => useBackButton.mock.calls[0][1];

    it('does not stack another exit prompt while one is open', async () => {
        const wrapper = mountPage();
        let closePrompt;
        notificationService.confirmSingle.mockReturnValue(
            new Promise((resolve) => {
                closePrompt = resolve;
            })
        );

        const pending = getBackHandler()();

        //the prompt is created with backdropDismiss: false, so it consumes
        //neither the backdrop tap nor the back press: without the latch every
        //press opened another exit prompt on top of the ones already waiting
        expect(notificationService.confirmSingle).toHaveBeenCalledTimes(1);
        expect(wrapper.vm.state.isExitPromptOpen).toBe(true);
        expect(await getBackHandler()()).toBe(false);
        expect(notificationService.confirmSingle).toHaveBeenCalledTimes(1);

        closePrompt(false);
        await pending;

        //a button is the only way to close the prompt, so the latch always clears
        expect(wrapper.vm.state.isExitPromptOpen).toBe(false);
        expect(App.exitApp).not.toHaveBeenCalled();
        wrapper.unmount();
    });

    it('exits the app once the exit prompt is confirmed', async () => {
        const wrapper = mountPage();
        notificationService.confirmSingle.mockResolvedValue(true);

        await getBackHandler()();

        expect(App.exitApp).toHaveBeenCalledTimes(1);
        expect(wrapper.vm.state.isExitPromptOpen).toBe(false);
        wrapper.unmount();
    });
});
