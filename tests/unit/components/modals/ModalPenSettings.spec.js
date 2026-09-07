import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import ModalPenSettings from '@/components/modals/ModalPenSettings.vue';
import {modalController} from '@ionic/vue';

vi.mock('@ionic/vue', () => ({
    modalController: {
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function mountSettings(props = {}) {
    const wrapper = mount(ModalPenSettings, {
        props: {
            currentColor: '#00ff00',
            thickness: 1,
            ...props
        }
    });
    await flushPromises();
    return wrapper;
}

describe('ModalPenSettings component', () => {

    it('shows cancel|save, the swatch grid and the thickness range', async () => {
        const wrapper = await mountSettings();

        //header carries the usual cancel|save actions; it uses the
        //secondary color so it reads as a stack over the draw modal's
        //primary header
        const labelTexts = wrapper.findAll('ion-button').map((button) => button.text().trim());
        expect(labelTexts).toContain('Cancel');
        expect(labelTexts).toContain('Save');
        expect(wrapper.find('ion-toolbar').attributes('color')).toBe('secondary');

        //the checkerboard renders one button per palette color
        const swatches = wrapper.findAll('.modal-pen-settings__swatch');
        expect(swatches.length).toBe(80);
        //(jsdom serializes the inline background as rgb(), so the hex is
        //asserted via the aria-label)
        expect(swatches[0].attributes('aria-label')).toBe('#000000');
        expect(swatches[79].attributes('aria-label')).toBe('#4c1130');

        //the thickness range: 1x-10x in whole steps, ticks + snap, scale labels
        const range = wrapper.find('ion-range');
        expect(range.exists()).toBe(true);
        expect(range.attributes('min')).toBe('1');
        expect(range.attributes('max')).toBe('10');
        expect(range.attributes('step')).toBe('1');
        expect(range.attributes('snaps')).toBe('true');
        expect(range.attributes('ticks')).toBe('true');
        expect(range.attributes('pin')).toBe('true');
        expect(range.attributes('value')).toBe('1');
        expect(wrapper.find('.modal-pen-settings__scale-label').text()).toBe('1x');
        expect(wrapper.findAll('.modal-pen-settings__scale-label')[1].text()).toBe('10x');
        expect(wrapper.vm._pinFormatter(3)).toBe('3x');

        //the preview row shows the selected thickness next to the color,
        //prefixed by a pencil icon and right-aligned (no separator dot)
        const thicknessReadout = wrapper.find('.modal-pen-settings__preview-thickness');
        expect(thicknessReadout.text()).toBe('1x');
        expect(thicknessReadout.find('ion-icon').exists()).toBe(true);
        expect(wrapper.find('.modal-pen-settings__preview-separator').exists()).toBe(false);
    });

    it('carries the current values and Save commits color and thickness together', async () => {
        const wrapper = await mountSettings({currentColor: 'black', thickness: 3});

        //the color being edited shows in the preview; CSS names normalized
        expect(wrapper.vm.state.pickedColor).toBe('#000000');
        expect(wrapper.find('.modal-pen-settings__preview-value').text()).toBe('#000000');
        expect(wrapper.vm.state.thickness).toBe(3);

        //picking a swatch and sliding the range updates the local state
        wrapper.findAll('.modal-pen-settings__swatch')[11].trigger('click'); //#ff0000
        wrapper.vm.setThickness(7);
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.state.pickedColor).toBe('#ff0000');
        expect(wrapper.vm.state.thickness).toBe(7);
        //the preview row readout follows the slider live
        expect(wrapper.find('.modal-pen-settings__preview-thickness').text()).toBe('7x');

        //save commits both pen settings to the caller
        wrapper.vm.save();
        expect(modalController.dismiss).toHaveBeenCalledWith({color: '#ff0000', thickness: 7});
    });

    it('marks the picked swatch and cancel dismisses without a payload', async () => {
        const wrapper = await mountSettings({currentColor: '#ff9900'});

        //the current color's swatch is marked as selected
        const selected = wrapper.findAll('.modal-pen-settings__swatch--selected');
        expect(selected.length).toBe(1);
        expect(selected[0].attributes('aria-label')).toBe('#ff9900');

        //cancel dismisses without a payload: the caller keeps its settings
        wrapper.vm.cancel();
        expect(modalController.dismiss).toHaveBeenLastCalledWith();
    });
});