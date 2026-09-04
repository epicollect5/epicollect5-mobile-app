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
//sources containing 'FAIL' fire onerror instead (load-failure tests).
//the natural size is 640x480 (4:3) unless a test overrides it
class FakeImage {
    constructor() {
        this.width = 640;
        this.height = 480;
    }
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
        //the strokes recorded so far, scaled to the new grid: the stroke
        //point (1,1) on the old 400x300 grid replays at (0.75, 0.75) on the
        //300x225 grid (proportional, not a stale absolute offset)
        pad.listeners.endStroke();
        expect(canvasEl.width).toBe(300);
        expect(canvasEl.height).toBe(225);
        expect(pad.clear).toHaveBeenCalled();
        expect(pad.fromData).toHaveBeenCalledWith(
            [{color: '#000000', points: [{x: 0.75, y: 0.75}]}],
            {clear: false}
        );
    });

    it('replays strokes proportionally after a rotation instead of at stale offsets', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        const canvasEl = wrapper.find('canvas').element;

        //landscape grid
        const rectSpy = vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(RECT(400, 300));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(400);

        //a stroke through the center of the landscape canvas
        pad._data = [{color: '#000000', points: [{x: 200, y: 150}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();

        //rotate to portrait: the replay scales with the grid (300x225)
        ctx2d.drawImage.mockClear();
        rectSpy.mockReturnValue(RECT(300, 225));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();

        expect(canvasEl.width).toBe(300);
        expect(pad.fromData).toHaveBeenCalledWith(
            [{color: '#000000', points: [{x: 150, y: 112.5}]}],
            {clear: false}
        );
    });

    it('fits a portrait background photo inside the canvas keeping its aspect ratio', async () => {
        //portrait 480x640 photo on a 400x300 (4:3) canvas: it must be drawn
        //centered and scaled to fit (225x300 with bars left/right), not
        //stretched to fill 400x300
        class PortraitImage extends FakeImage {
            constructor() {
                super();
                this.width = 480;
                this.height = 640;
            }
        }
        vi.stubGlobal('Image', PortraitImage);
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});
        const canvasEl = wrapper.find('canvas').element;

        const rectSpy = vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(RECT(400, 300));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(400);
        expect(canvasEl.height).toBe(300);

        ctx2d.drawImage.mockClear();
        //rotate: it is re-drawn fitted on the canvas, not stretched
        rectSpy.mockReturnValue(RECT(300, 225));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();

        const call = ctx2d.drawImage.mock.calls[0];
        expect(call.slice(1)).toEqual([65.625, 0, 168.75, 225]);
    });

    it('clear performs a bulk undo and keeps the background photo', async () => {
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});
        const pad = padInstances[0];
        const canvasEl = wrapper.find('canvas').element;

        //the existing photo was loaded and drawn on mount
        expect(ctx2d.drawImage).toHaveBeenCalled();

        //a stroke on top of the photo (history: photo base + stroke)
        pad._data = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        expect(wrapper.vm.state.history).toHaveLength(2);

        //Clear erases every stroke at once but redraws the photo immediately
        ctx2d.drawImage.mockClear();
        wrapper.vm.clearAll();
        expect(wrapper.vm.state.history).toHaveLength(0);
        expect(ctx2d.drawImage).toHaveBeenCalled();

        //the photo is not gone: a later layout change re-draws it
        const rectSpy = vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(RECT(400, 300));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(400);

        ctx2d.drawImage.mockClear();
        rectSpy.mockReturnValue(RECT(300, 225));
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(300);
        expect(ctx2d.drawImage).toHaveBeenCalled();
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

    it('pushes a deep copy of each finished stroke into the history, normalized', async () => {
        const wrapper = await mountDraw();
        const pad = padInstances[0];
        const stroke = [{color: '#000000', points: [{x: 1, y: 1}]}];
        pad._data = stroke;
        const canvasEl = wrapper.find('canvas').element;
        //no layout change was forced: jsdom's default grid is 300x150
        const grid = {width: canvasEl.width, height: canvasEl.height};

        pad.listeners.beginStroke();
        pad.listeners.endStroke();

        expect(wrapper.vm.state.history).toHaveLength(1);
        //points are stored relative to the grid (0..1), deep-copied
        expect(wrapper.vm.state.history[0]).toEqual([{
            color: '#000000',
            points: [{x: 1 / grid.width, y: 1 / grid.height}]
        }]);
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

        //no photo: a flat white 1024x768 canvas, strokes replayed only (no
        //rasterized copy of the low-res visible canvas)
        expect(ctx2d.fillRect).toHaveBeenCalledWith(0, 0, 1024, 768);
        expect(ctx2d.drawImage).not.toHaveBeenCalled();
        //the stroke (1,1) on jsdom's 300x150 grid replays at output scale
        const exportPad = padInstances[1];
        expect(exportPad.fromData).toHaveBeenCalledWith(
            [{color: '#000000', points: [{x: (1 / 300) * 1024, y: (1 / 150) * 768}]}],
            {clear: false}
        );
        expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.5);
        expect(modalController.dismiss).toHaveBeenCalledWith({dataURL: 'data:image/jpeg;base64,EXPORTED'});
    });

    it('save() keeps a portrait photo at its own aspect ratio without bars', async () => {
        class PortraitImage extends FakeImage {
            constructor() {
                super();
                this.width = 480;
                this.height = 640;
            }
        }
        vi.stubGlobal('Image', PortraitImage);
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});
        const pad = padInstances[0];
        //stroke from the photo's left edge (93.75, 150) down to its right
        //edge (206.25, 75): on the 300x150 grid the 480x640 photo is
        //contain-fitted to 112.5x150 centered (x0 = 93.75)
        pad._data = [{
            color: '#000000',
            points: [{x: 93.75, y: 150}, {x: 206.25, y: 75}]
        }];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockReturnValue('data:image/jpeg;base64,EXPORTED');

        wrapper.vm.save();
        await flushPromises();

        //the output is the photo's own aspect (768x1024), not the pad's 4:3
        expect(ctx2d.fillRect).toHaveBeenCalledWith(0, 0, 768, 1024);
        //the photo is drawn full-bleed from the original source: no bars
        expect(ctx2d.drawImage).toHaveBeenCalledWith(
            expect.objectContaining({width: 480, height: 640}),
            0,
            0,
            768,
            1024
        );
        //strokes are re-framed onto the photo's rect: the photo's left edge
        //replays at output x = 0 and its right edge at x = 768 - full-bleed,
        //so a line across the image comes out covering the whole image
        const exportPad = padInstances[1];
        expect(exportPad.fromData).toHaveBeenCalledWith(
            [{color: '#000000', points: [{x: 0, y: 1024}, {x: 768, y: 512}]}],
            {clear: false}
        );
        //regression: the photo must be painted BEFORE the stroke replay - the
        //export pad's constructor clears the canvas and would wipe it
        expect(ctx2d.drawImage.mock.invocationCallOrder.at(-1))
            .toBeLessThan(exportPad.fromData.mock.invocationCallOrder[0]);
        expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.5);
        expect(modalController.dismiss).toHaveBeenCalledWith({dataURL: 'data:image/jpeg;base64,EXPORTED'});
    });

    it('save() crops stroke portions that ended on the letterbox bars at the photo edges', async () => {
        class PortraitImage extends FakeImage {
            constructor() {
                super();
                this.width = 480;
                this.height = 640;
            }
        }
        vi.stubGlobal('Image', PortraitImage);
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});
        const pad = padInstances[0];
        //a stroke running across the FULL 300px-wide pad: it starts and ends
        //inside the white letterbox bars (photo spans 93.75..206.25)
        pad._data = [{
            color: '#000000',
            points: [{x: 10, y: 75}, {x: 290, y: 75}]
        }];
        pad.listeners.beginStroke();
        pad.listeners.endStroke();
        const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockReturnValue('data:image/jpeg;base64,EXPORTED');

        wrapper.vm.save();
        await flushPromises();

        //the bar portions re-frame OUTSIDE the 768-wide output canvas (x < 0
        //and x > 768) and clip away; the remaining line runs edge to edge
        //over the photo
        const exportPad = padInstances[1];
        const expectedK = 768 / 112.5;
        expect(exportPad.fromData).toHaveBeenCalledWith(
            [{
                color: '#000000',
                points: [
                    {x: (10 - 93.75) * expectedK, y: 75 * expectedK},
                    {x: (290 - 93.75) * expectedK, y: 75 * expectedK}
                ]
            }],
            {clear: false}
        );
        const points = exportPad.fromData.mock.calls[0][0][0].points;
        expect(points[0].x).toBeLessThan(0);
        expect(points[1].x).toBeGreaterThan(768);
        expect(points[0].y).toBeCloseTo(512);
        expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.5);
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

    it('does not dismiss on mount when the background photo loads', async () => {
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});

        //success path unchanged: background painted, base history pushed,
        //modal stays open for editing
        expect(ctx2d.drawImage).toHaveBeenCalled();
        expect(wrapper.vm.state.history).toHaveLength(1);
        expect(modalController.dismiss).not.toHaveBeenCalled();
    });

    it('dismisses without a payload when the background photo fails to load', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const addSpy = vi.spyOn(window, 'addEventListener');
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,FAIL'});

        //the failure is reported...
        expect(warnSpy).toHaveBeenCalledWith(
            'Failed to load existing drawing for editing',
            expect.any(Error)
        );
        //...and the modal closes with no dataURL, so the caller cannot save
        //a blank canvas over the original photo
        expect(modalController.dismiss).toHaveBeenCalledTimes(1);
        expect(modalController.dismiss).toHaveBeenCalledWith();

        //no background was painted and no base history was pushed
        expect(ctx2d.drawImage).not.toHaveBeenCalled();
        expect(wrapper.vm.state.history).toHaveLength(0);

        //the early return skipped the post-load wiring: layout changes are
        //ignored (no resize listener registered)
        expect(addSpy).not.toHaveBeenCalledWith('resize', expect.any(Function));
        const canvasEl = wrapper.find('canvas').element;
        window.dispatchEvent(new Event('resize'));
        await waitLayout();
        expect(canvasEl.width).toBe(300);
        expect(canvasEl.height).toBe(150);
        expect(ctx2d.drawImage).not.toHaveBeenCalled();
    });

    it('ignores save() while the background photo is still loading', async () => {
        //images that only load when the test fires them
        const pendingLoads = [];
        class DeferredImage extends FakeImage {
            set src(value) {
                this._src = value;
                pendingLoads.push(() => {
                    if (this.onload) {
                        this.onload();
                    }
                });
            }
            get src() {
                return this._src;
            }
        }
        vi.stubGlobal('Image', DeferredImage);
        const wrapper = await mountDraw({existingDataURL: 'data:image/png;base64,AAAA'});

        //photo pending: Save is disabled and a tap cannot smuggle out a
        //blank canvas over the original photo
        expect(wrapper.vm.state.isLoading).toBe(true);
        wrapper.vm.save();
        await flushPromises();
        expect(modalController.dismiss).not.toHaveBeenCalled();

        //photo arrives: the pad unlocks and Save exports the photo, not white
        pendingLoads.forEach((fire) => fire());
        await flushPromises();
        expect(wrapper.vm.state.isLoading).toBe(false);
        expect(ctx2d.drawImage).toHaveBeenCalled();

        const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
            .mockReturnValue('data:image/jpeg;base64,EXPORTED');
        wrapper.vm.save();
        await flushPromises();
        //640x480 photo: full-bleed 1024x768 output from the source image
        expect(ctx2d.drawImage).toHaveBeenCalledWith(
            expect.objectContaining({width: 640, height: 480}),
            0,
            0,
            1024,
            768
        );
        expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.5);
        expect(modalController.dismiss).toHaveBeenCalledWith({dataURL: 'data:image/jpeg;base64,EXPORTED'});
    });
});