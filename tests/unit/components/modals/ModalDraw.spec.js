import fs from 'fs';
import path from 'path';
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import ModalDraw from '@/components/modals/ModalDraw.vue';
import ModalPenSettings from '@/components/modals/ModalPenSettings.vue';
import {modalController} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';

// instances created by the component, captured so tests can drive the pad
const {padInstances} = vi.hoisted(() => ({padInstances: []}));
// modal dismissal resolvers registered by the component for the pen settings
// modal; tests resolve them with the dismiss payload, like the real controller
const {modalDismissResolvers} = vi.hoisted(() => ({modalDismissResolvers: []}));

vi.mock('signature_pad', () => {
    class MockSignaturePad {
        constructor(el, options) {
            this.el = el;
            this.options = options;
            this.penColor = options.penColor;
            this.minWidth = options.minWidth;
            this.maxWidth = options.maxWidth;
            this.listeners = {};
            //live stroke data returned by toData(), like signature_pad v5
            this._data = [];
            this.addEventListener = vi.fn((name, cb) => {
                this.listeners[name] = cb;
            });
            this.off = vi.fn();
            this.clear = vi.fn();
            this.fromData = vi.fn();
            this.toData = vi.fn(() => this._data);
            padInstances.push(this);
        }
    }
    return {default: MockSignaturePad};
});

vi.mock('@/services/notification-service', () => ({
    notificationService: {
        confirmSingle: vi.fn(() => Promise.resolve(true))
    }
}));

vi.mock('@ionic/vue', () => ({
    modalController: {
        dismiss: vi.fn(() => Promise.resolve()),
        create: vi.fn(() => {
            const modal = {
                present: vi.fn(() => Promise.resolve()),
                onDidDismiss: vi.fn(() => {
                    return new Promise((resolve) => {
                        modalDismissResolvers.push(resolve);
                    });
                })
            };
            return Promise.resolve(modal);
        })
    }
}));

//fire onload synchronously, as a data-URL image already in memory would;
//sources containing 'FAIL' fire onerror instead (load-failure tests)
class FakeImage {
    set src(value) {
        this._src = value;
        if (value.includes('FAIL')) {
            if (this.onerror) {
                this.onerror(new Error('load failed'));
            }
            return;
        }
        if (this.onload) {
            this.onload();
        }
    }
    get src() {
        return this._src;
    }
}

const RECT = (width, height) => ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({})
});

let ctx2d;

beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    padInstances.length = 0;
    modalDismissResolvers.length = 0;
    ctx2d = {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: '',
        toDataURL: vi.fn(() => 'data:image/jpeg;base64,AAAA')
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx2d);
    vi.stubGlobal('Image', FakeImage);
    //make onMounted's requestAnimationFrame wait resolve immediately
    vi.stubGlobal('requestAnimationFrame', (cb) => {
        cb(0);
        return 1;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    padInstances.length = 0;
});

async function mountDraw(props = {}) {
    const wrapper = mount(ModalDraw, {
        props: {
            existingDataURL: '',
            ...props
        }
    });
    await flushPromises();
    return wrapper;
}

const readModalDrawScss = () => fs.readFileSync(
    path.resolve(__dirname, '../../../../src/theme/components/modals/ModalDraw.scss'),
    'utf8'
);

//wait past the 100ms debounced layout apply
const waitLayout = () => new Promise((resolve) => setTimeout(resolve, 110));

describe('ModalDraw component', () => {

    it('defers a layout change that arrives mid-stroke until endStroke', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        const canvasEl = wrapper.find('canvas').element;

        //initial layout: 400x300 grid
        const rectSpy = vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(RECT(400, 300));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(400);
        expect(canvasEl.height).toBe(300);
        pad.clear.mockClear();

        //stroke in progress, holding a real drawing
        pad._data = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad.listeners.beginStroke();

        //rotation lands while the stroke is active
        rectSpy.mockReturnValue(RECT(300, 225));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();

        //nothing was applied mid-stroke: resizing/clearing there would lock
        //signature_pad (its _drawingStroke stays true) and kill the stroke
        expect(canvasEl.width).toBe(400);
        expect(canvasEl.height).toBe(300);
        expect(pad.clear).not.toHaveBeenCalled();

        //undo/clear are also ignored while a stroke is active
        wrapper.vm.undo();
        wrapper.vm.clearAll();
        expect(canvasEl.width).toBe(400);

        //the deferred layout apply happens once the stroke ends, restoring
        //the strokes recorded so far
        pad.listeners.endStroke();
        expect(canvasEl.width).toBe(300);
        expect(canvasEl.height).toBe(225);
        expect(pad.clear).toHaveBeenCalled();
        expect(pad.fromData).toHaveBeenCalledWith(pad._data, {clear: false});
    });

    it('does not bring the cleared background photo back on a later layout change', async () => {
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});
        const pad = padInstances[0];
        const canvasEl = wrapper.find('canvas').element;

        //the existing photo was loaded and drawn on mount
        expect(ctx2d.drawImage).toHaveBeenCalled();

        //initial layout
        const rectSpy = vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(RECT(400, 300));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(400);

        //rotation while the photo is still shown re-draws it on the canvas
        rectSpy.mockReturnValue(RECT(300, 225));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(300);
        expect(canvasEl.height).toBe(225);
        expect(ctx2d.drawImage).toHaveBeenCalled();

        //user clears the drawing; a rotation must NOT bring the photo back
        wrapper.vm.clearAll();
        ctx2d.drawImage.mockClear();

        rectSpy.mockReturnValue(RECT(760, 360));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();

        expect(canvasEl.width).toBe(760);
        expect(canvasEl.height).toBe(360);
        expect(ctx2d.drawImage).not.toHaveBeenCalled();
    });

    it('keeps a 4:3 canvas in landscape via a container-query capped width', async () => {
        const wrapper = await mountDraw();
        const canvasEl = wrapper.find('canvas').element;
        const wrapEl = wrapper.find('.modal-draw__canvas-wrap').element;

        //the canvas lives inside the wrap that acts as its size container
        expect(canvasEl.classList.contains('modal-draw__canvas')).toBe(true);
        expect(wrapEl.contains(canvasEl)).toBe(true);

        //the landscape fix: the canvas width is capped by the wrap height
        //(100cqh * 4/3) so a wide, short wrap cannot stretch it past 4:3,
        //with width:100% as the fallback for browsers without container units
        const scss = readModalDrawScss();
        expect(scss).toContain('container-type: size');
        expect(scss).toContain('aspect-ratio: 4 / 3');
        expect(scss).toContain('min(100%, calc(100cqh * 4 / 3))');
        expect(scss).toContain('max-height: 100%');

        //the color input's wrapper button shows no tap feedback
        expect(scss).toContain('--ripple-color: transparent');
        expect(scss).toContain('--background-activated-opacity: 0');

        //the color dot button shows the current pen color
        expect(scss).toContain('modal-draw__color-dot');
    });

    it('opens the pen settings modal from both footer buttons and applies its save', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        const thicknessButton = wrapper.find('.modal-draw__thickness-button');
        const colorButton = wrapper.find('.modal-draw__color-button');

        //no native color input anymore: the dot is a plain span bound to the
        //current pen color
        expect(wrapper.find('input[type="color"]').exists()).toBe(false);
        const dot = wrapper.find('.modal-draw__color-dot');
        expect(dot.exists()).toBe(true);
        expect(dot.element.style.backgroundColor).toBe('black');

        //the thickness button sits before the color swatch, showing its value
        //as its label (no text label elsewhere)
        expect(thicknessButton.element.compareDocumentPosition(
            colorButton.element
        ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(thicknessButton.text()).toBe('1x');

        //either button opens the same unified modal carrying both settings
        await colorButton.trigger('click');
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledWith(expect.objectContaining({
            component: ModalPenSettings,
            cssClass: 'modal-pen-settings',
            showBackdrop: true,
            backdropDismiss: false,
            componentProps: {currentColor: 'black', thickness: 1}
        }));

        //dismissing without a choice (cancel) keeps both current values
        modalDismissResolvers[0]({data: null});
        await flushPromises();
        expect(wrapper.vm.state.currentColor).toBe('black');
        expect(wrapper.vm.state.thickness).toBe(1);
        expect(pad.penColor).toBe('black');
        expect(pad.minWidth).toBe(1.5);

        //dismissing with the picked values applies color and thickness (7x)
        await thicknessButton.trigger('click');
        await flushPromises();
        expect(modalController.create).toHaveBeenCalledTimes(2);
        modalDismissResolvers[1]({data: {color: '#ff0000', thickness: 7}});
        await flushPromises();
        expect(wrapper.vm.state.currentColor).toBe('#ff0000');
        expect(pad.penColor).toBe('#ff0000');
        expect(thicknessButton.text()).toBe('7x');
        expect(pad.minWidth).toBe(10.5);
        expect(pad.maxWidth).toBe(10.5);
    });

    it('defers a thickness change that arrives mid-stroke until endStroke', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];

        pad.listeners.beginStroke();
        wrapper.vm.setThickness(10);
        //not applied while the stroke is active: it would make the remaining
        //segments of the in-flight stroke a different thickness
        expect(pad.minWidth).toBe(1.5);
        expect(pad.maxWidth).toBe(1.5);

        pad.listeners.endStroke();
        expect(pad.minWidth).toBe(15);
        expect(pad.maxWidth).toBe(15);
    });

    it('pushes a deep copy of each finished stroke into the history', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        const stroke = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad._data = stroke;

        pad.listeners.beginStroke();
        pad.listeners.endStroke();

        expect(wrapper.vm.state.history).toHaveLength(1);
        expect(wrapper.vm.state.history[0]).toEqual(stroke);
        //toData() returns the pad's live array; the recorded stroke must be a
        //deep copy so later strokes cannot rewrite history
        expect(wrapper.vm.state.history[0][0].points[0]).not.toBe(stroke[0].points[0]);

        //a second stroke lands behind the first
        pad._data = [{color: '#000000', points: [{x: 2, y: 2}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        expect(wrapper.vm.state.history).toHaveLength(2);
    });

    it('save() exports a 1024x768 JPEG of the drawing and dismisses with it', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        //a finished stroke so there is something to export; jsdom's canvas
        //toDataURL is inert, so the export result is stubbed on the prototype
        pad._data = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockReturnValue('data:image/jpeg;base64,EXPORTED');

        wrapper.vm.save();
        await flushPromises();

        //the export canvas is white-filled 1024x768 and the visible drawing
        //is stretched over it, then rasterized as a 50% JPEG
        expect(ctx2d.fillRect).toHaveBeenCalledWith(0, 0, 1024, 768);
        const canvasEl = wrapper.find('canvas').element;
        expect(ctx2d.drawImage).toHaveBeenCalledWith(canvasEl, 0, 0, 1024, 768);
        expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.5);
        expect(modalController.dismiss).toHaveBeenCalledWith({dataURL: 'data:image/jpeg;base64,EXPORTED'});
    });

    it('cancel() dismisses at once when there is nothing to discard', async () => {
        const wrapper = await mountDraw();

        wrapper.vm.cancel();
        await flushPromises();

        expect(notificationService.confirmSingle).not.toHaveBeenCalled();
        expect(modalController.dismiss).toHaveBeenCalled();
    });

    it('cancel() asks for confirmation once there is content and honors the answer', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        //content: one finished stroke
        pad._data = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        expect(wrapper.vm.state.history).toHaveLength(1);

        //declining the confirmation keeps the modal open
        notificationService.confirmSingle.mockResolvedValueOnce(false);
        await wrapper.vm.cancel();
        await flushPromises();
        expect(notificationService.confirmSingle).toHaveBeenCalledWith('Discard drawing?', 'Cancel');
        expect(modalController.dismiss).not.toHaveBeenCalled();

        //accepting it dismisses
        notificationService.confirmSingle.mockResolvedValueOnce(true);
        await wrapper.vm.cancel();
        await flushPromises();
        expect(modalController.dismiss).toHaveBeenCalled();
    });

    it('keeps the pad usable when the background photo fails to load', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,FAIL'});
        const pad = padInstances[0];

        //the failure is reported but does not kill the pad
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to load existing drawing for editing',
            expect.any(Error)
        );
        pad._data = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        expect(wrapper.vm.state.history).toHaveLength(1);

        //the missing image must not be drawn on later layout changes
        ctx2d.drawImage.mockClear();
        wrapper.vm.clearAll();
        expect(wrapper.vm.state.history).toHaveLength(0);
    });
});