import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import ListItemProjects from '@/components/ListItemProjects.vue';
import { PARAMETERS } from '@/config';

const DATA_URI = 'data:image/webp;base64,UklGRtIAAABXRUJQVlA4IMYAAAAQBgCdASpAAEAAPtFiqk8oJaQiKhmYAQAaCUAaJwMhgE0Egcz7SLgL81LexQmy7gWzXQxWPSd8w6AA';

let wrapper = null;

beforeEach(() => {
    setActivePinia(createPinia());
});

afterEach(() => {
    if (wrapper) {
        wrapper.unmount();
        wrapper = null;
    }
});

function mountComponent(projects, page) {
    return shallowMount(ListItemProjects, {
        props: { projects, page }
    });
}

describe('ListItemProjects.vue getProjectLogo() — search page (add-project)', () => {

    it('returns the locked placeholder for private projects, regardless of project.logo', () => {
        wrapper = mountComponent(
            [{ ref: 'p1', name: 'Private', access: 'private', logo: null }],
            'add-project'
        );

        expect(wrapper.vm.getProjectLogo({ access: 'private', logo: null }))
            .toBe(PARAMETERS.PROJECT_LOGO_PRIVATE);
        expect(wrapper.vm.getProjectLogo({ access: 'private', logo: DATA_URI }))
            .toBe(PARAMETERS.PROJECT_LOGO_PRIVATE);
    });

    it('returns the embedded base64 data URI for public projects', () => {
        wrapper = mountComponent(
            [{ ref: 'p1', name: 'Public', access: 'public', logo: DATA_URI }],
            'add-project'
        );

        expect(wrapper.vm.getProjectLogo({ access: 'public', logo: DATA_URI }))
            .toBe(DATA_URI);
    });

    it('falls back to the placeholder when public project has no logo (defensive)', () => {
        wrapper = mountComponent(
            [{ ref: 'p1', name: 'Public', access: 'public', logo: null }],
            'add-project'
        );

        expect(wrapper.vm.getProjectLogo({ access: 'public', logo: null }))
            .toBe(PARAMETERS.PROJECT_LOGO_PLACEHOLDER);
    });

    it('falls back to the placeholder when public project.logo is an empty string', () => {
        wrapper = mountComponent([], 'add-project');

        expect(wrapper.vm.getProjectLogo({ access: 'public', logo: '' }))
            .toBe(PARAMETERS.PROJECT_LOGO_PLACEHOLDER);
    });

    it('falls back to the placeholder when public project has no logo property at all', () => {
        wrapper = mountComponent([], 'add-project');

        expect(wrapper.vm.getProjectLogo({ access: 'public' }))
            .toBe(PARAMETERS.PROJECT_LOGO_PLACEHOLDER);
    });
});

describe('ListItemProjects.vue getProjectLogo() — local list page (projects)', () => {

    it('returns project.logo (local file path) unchanged, regardless of access', () => {
        wrapper = mountComponent(
            [{ ref: 'p1', name: 'Local', logo: 'file:///persistent/logos/p1/mobile-logo.jpg' }],
            'projects'
        );

        const localPath = 'file:///persistent/logos/p1/mobile-logo.jpg';
        expect(wrapper.vm.getProjectLogo({ access: 'public', logo: localPath })).toBe(localPath);
        expect(wrapper.vm.getProjectLogo({ access: 'private', logo: localPath })).toBe(localPath);
    });
});

describe('ListItemProjects.vue template', () => {

    it('binds the resolved logo to <img :src> for each project (search page)', () => {
        const projects = [
            { ref: 'p1', name: 'Public', access: 'public', logo: DATA_URI },
            { ref: 'p2', name: 'Private', access: 'private', logo: null }
        ];
        wrapper = mountComponent(projects, 'add-project');

        const imgs = wrapper.findAll('img');
        expect(imgs).toHaveLength(2);
        expect(imgs[0].attributes('src')).toBe(DATA_URI);
        expect(imgs[1].attributes('src')).toBe(PARAMETERS.PROJECT_LOGO_PRIVATE);
    });

    it('emits project-selected with the clicked project', async () => {
        const projects = [{ ref: 'p1', name: 'X', access: 'public', logo: DATA_URI }];
        wrapper = mountComponent(projects, 'add-project');

        await wrapper.find('ion-item').trigger('click');

        expect(wrapper.emitted('project-selected')).toBeTruthy();
        expect(wrapper.emitted('project-selected')[0][0]).toEqual(projects[0]);
    });
});
