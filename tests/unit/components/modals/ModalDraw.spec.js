import fs from 'fs';
import path from 'path';
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {mount} from '@vue/test-utils';
import flushPromises from 'flush-promises';
import {setActivePinia, createPinia} from 'pinia';
import ModalDraw from '@/components/modals/ModalDraw.vue';

// instances created by the component, captured so tests can drive the pad
const {padInstances} = vi.hoisted(() => ({padInstances: []}));

vi.mock('signature_pad', () => {
    class MockSignaturePad {
        constructor(el, options) {
            this.el = el;
            this.options = options;
            this.penColor = options.penColor;
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
        dismiss: vi.fn(() => Promise.resolve())
    }
}));

//fire onload synchronously, as a data-URL image already in memory would
class FakeImage {
    set src(value) {
        this._src = value;
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
        const scss = fs.readFileSync(
            path.resolve(__dirname, '../../../../src/theme/components/modals/ModalDraw.scss'),
            'utf8'
        );
        expect(scss).toContain('container-type: size');
        expect(scss).toContain('aspect-ratio: 4 / 3');
        expect(scss).toContain('min(100%, calc(100cqh * 4 / 3))');
        expect(scss).toContain('max-height: 100%');
    });
});
