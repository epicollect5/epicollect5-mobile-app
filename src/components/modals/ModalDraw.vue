<template>
  <ion-header class="ion-no-border">
    <ion-toolbar color="primary">
      <ion-buttons slot="start">
        <ion-button @click="cancel()">
          <ion-icon
              slot="start"
              :icon="closeOutline"
          ></ion-icon>
          {{ labels.cancel }}
        </ion-button>
      </ion-buttons>
      <ion-buttons slot="end">
        <ion-button @click="save()">
          {{ labels.save }}
          <ion-icon
              slot="end"
              :icon="checkmarkOutline"
          ></ion-icon>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content>
    <div class="modal-draw__canvas-wrap">
      <canvas
          ref="canvas"
          class="modal-draw__canvas"
      ></canvas>
    </div>
  </ion-content>
  <ion-footer class="ion-no-border">
    <ion-toolbar color="primary">

      <ion-buttons slot="start">
        <ion-button
            fill="clear"
            :aria-label="labels.undo"
            @click="undo()"
        >
          <ion-icon
              slot="start"
              :icon="arrowUndoOutline"
          ></ion-icon>
          {{ labels.undo }}
        </ion-button>
        <ion-button
            fill="clear"
            :aria-label="labels.clear"
            @click="clearAll()"
        >
          <ion-icon
              slot="start"
              :icon="trashOutline"
          ></ion-icon>
          {{ labels.clear }}
        </ion-button>
      </ion-buttons>
        <ion-buttons
            slot="end"
            @click="openPenSettings()"
        >
        <ion-button class="modal-draw__thickness-button">
          {{ thicknessLabel }}
        </ion-button>
        <ion-button
            class="modal-draw__color-button"
            :aria-label="labels.draw"
        >
          <span
              class="modal-draw__color-dot"
              :style="colorDotStyle"
          ></span>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script>
import {onMounted, onBeforeUnmount, ref, reactive, nextTick, computed} from 'vue';
import {modalController} from '@ionic/vue';
import {closeOutline, checkmarkOutline, arrowUndoOutline, trashOutline} from 'ionicons/icons';
import SignaturePad from 'signature_pad';
import ModalPenSettings from '@/components/modals/ModalPenSettings.vue';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings.js';
import {notificationService} from '@/services/notification-service';

export default {
  props: {
    existingDataURL: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    const OUTPUT_WIDTH = 1024;
    const OUTPUT_HEIGHT = 768;
    //pen width for a 1x multiplier; the thickness slider scales this
    const BASE_PEN_WIDTH = 1.5;

    const canvas = ref(null);
    const state = reactive({
      currentColor: 'black',
      thickness: 1,
      history: []
    });
    let signaturePad = null;
    let existingImage = null;
    //the pre-existing photo stays as the canvas background: Clear erases
    //only the drawn strokes (bulk undo), never the photo itself
    const showExistingImage = true;
    let resizeObserver = null;
    //debounced canvas sizing state
    let applyTimer = null;
    let pendingBox = null;
    let lastAppliedBox = null;
    //true while a stroke is being drawn; layout changes are deferred then
    let isDrawing = false;
    let pendingApplyBox = null;
    //pen width change requested mid-stroke; applied at endStroke
    let pendingPenWidth = null;

    function _pushHistory() {
      //deep-copy the stroke data into normalized coordinates (0..1 relative
      //to the canvas grid at stroke time). signature_pad stores absolute
      //pixel offsets, which would land at stale positions once the grid is
      //resized (e.g. rotation): replaying normalized points against the
      //current grid scales every stroke proportionally instead. Stroke
      //widths normalize too (relative to the grid width), so they scale
      //with the grid as well
      const canvasEl = canvas.value;
      state.history.push(
          signaturePad.toData().map((group) => {
            const points = group.points.map((point) => ({
              ...point,
              x: point.x / canvasEl.width,
              y: point.y / canvasEl.height
            }));
            return {
              ...group,
              minWidth: group.minWidth !== undefined ? group.minWidth / canvasEl.width : group.minWidth,
              maxWidth: group.maxWidth !== undefined ? group.maxWidth / canvasEl.width : group.maxWidth,
              dotSize: group.dotSize !== undefined ? group.dotSize / canvasEl.width : group.dotSize,
              points
            };
          })
      );
    }

    //Map stored normalized points (and widths) back to a grid; defaults to
    //the visible canvas, or any other size (e.g. the export canvas)
    function _denormalizeData(groups, gridWidth, gridHeight) {
      const canvasEl = canvas.value;
      const width = gridWidth || canvasEl.width;
      const height = gridHeight || canvasEl.height;
      return groups.map((group) => ({
        ...group,
        minWidth: group.minWidth !== undefined ? group.minWidth * width : group.minWidth,
        maxWidth: group.maxWidth !== undefined ? group.maxWidth * width : group.maxWidth,
        dotSize: group.dotSize !== undefined ? group.dotSize * width : group.dotSize,
        points: group.points.map((point) => ({
          ...point,
          x: point.x * width,
          y: point.y * height
        }))
      }));
    }

    function _loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });
    }

    //Where the background photo sits on the pad grid: contain-fit, centered
    //(a portrait photo on a 4:3 canvas leaves white bars left and right).
    //Both the pad paint and the export re-frame strokes against this rect
    function _backgroundRect() {
      const canvasEl = canvas.value;
      if (!canvasEl || !existingImage) {
        return null;
      }
      const image = existingImage;
      const scale = Math.min(
          canvasEl.width / image.width,
          canvasEl.height / image.height
      );
      const w = image.width * scale;
      const h = image.height * scale;
      return {
        x0: (canvasEl.width - w) / 2,
        y0: (canvasEl.height - h) / 2,
        w,
        h
      };
    }

    //Draw the background photo fitted inside the canvas (contain)
    function _drawBackground() {
      if (!existingImage || !showExistingImage) {
        return;
      }
      const rect = _backgroundRect();
      if (!rect) {
        return;
      }
      canvas.value.getContext('2d').drawImage(
          existingImage,
          rect.x0,
          rect.y0,
          rect.w,
          rect.h
      );
    }

    //Redraw the background (if any) plus the recorded strokes on top of a
    //freshly cleared canvas. Used after a resize (the grid change wiped the
    //canvas) and after undo/clear. Strokes replay from the normalized
    //history so they scale with the current grid.
    //Never run mid-stroke: signature_pad's clear() leaves _drawingStroke
    //true, which permanently blocks any further stroke on the pad.
    function _redrawContent() {
      if (!signaturePad || isDrawing) {
        return;
      }
      const canvasEl = canvas.value;
      signaturePad.clear();
      _drawBackground();
      const last = state.history[state.history.length - 1];
      if (last && last.length > 0) {
        signaturePad.fromData(_denormalizeData(last), {clear: false});
      }
    }

    function _measureBox() {
      const canvasEl = canvas.value;
      if (!canvasEl) {
        return null;
      }
      const rect = canvasEl.getBoundingClientRect();
      return {
        width: Math.floor(rect.width),
        height: Math.floor(rect.height)
      };
    }

    //Match the canvas internal pixel grid to its CSS box in CSS pixels (no
    //DPR scaling; signature_pad v5 draws raw CSS pixels, so grid == box).
    //The CSS box is left alone - it must stay free to grow/shrink with the
    //layout. Pinning style.width/height to a transient rect is what locked
    //the canvas to 1x1 while the modal was still animating in.
    //While a stroke is active the apply is deferred: resizing the grid
    //clears the canvas, and calling clear() mid-stroke makes signature_pad
    //stop accepting any further strokes (its _drawingStroke stays true).
    function _applyLayout() {
      const box = _measureBox();
      if (!box || box.width <= 1 || box.height <= 1) {
        return;
      }
      if (isDrawing) {
        pendingApplyBox = box;
        return;
      }
      lastAppliedBox = box;
      const canvasEl = canvas.value;
      if (!canvasEl) {
        return;
      }
      const changed = canvasEl.width !== box.width || canvasEl.height !== box.height;
      if (!changed) {
        return;
      }
      canvasEl.width = box.width;
      canvasEl.height = box.height;
      _redrawContent();
    }

    //The modal enter animation reports tiny/partial rects while it settles,
    //so wait until a size has held for a moment before resizing the grid.
    //This both avoids locking the canvas to a mid-animation size and avoids
    //pointless clear/redraw churn on every intermediate layout frame.
    function _onLayoutChange() {
      if (!signaturePad) {
        return;
      }
      const box = _measureBox();
      if (!box || box.width <= 1 || box.height <= 1) {
        //layout not settled; wait for a real size
        return;
      }
      if (lastAppliedBox &&
          box.width === lastAppliedBox.width &&
          box.height === lastAppliedBox.height) {
        return;
      }
      if (pendingBox &&
          box.width === pendingBox.width &&
          box.height === pendingBox.height) {
        return;
      }
      pendingBox = box;
      if (applyTimer) {
        clearTimeout(applyTimer);
      }
      applyTimer = setTimeout(() => {
        applyTimer = null;
        pendingBox = null;
        _applyLayout();
      }, 100);
    }

    function setColor(color) {
      state.currentColor = color;
      if (signaturePad) {
        signaturePad.penColor = color;
      }
    }

    //The two footer buttons (thickness readout and color dot) both open the
    //pen settings modal: swatches + thickness range, committed together by
    //its cancel|save bar. A plain modal has no viewport-anchored popup to
    //misplace on rotation or in landscape.
    async function openPenSettings() {
      const modal = await modalController.create({
        component: ModalPenSettings,
        cssClass: 'modal-pen-settings',
        showBackdrop: true,
        backdropDismiss: false,
        componentProps: {
          currentColor: state.currentColor,
          thickness: state.thickness
        }
      });
      modal.onDidDismiss().then((response) => {
        if (!response || !response.data) {
          return;
        }
        if (response.data.color) {
          setColor(response.data.color);
        }
        if (response.data.thickness !== undefined && response.data.thickness !== null) {
          //deferred until endStroke if a stroke is in flight
          setThickness(response.data.thickness);
        }
      });
      return modal.present();
    }

    //1x (1.5) to 10x (15) in whole steps
    function setThickness(value) {
      state.thickness = value;
      if (!signaturePad) {
        return;
      }
      const width = BASE_PEN_WIDTH * value;
      if (isDrawing) {
        //never change the width mid-stroke: the remaining segments of the
        //in-flight stroke would render at a different thickness
        pendingPenWidth = width;
        return;
      }
      signaturePad.minWidth = width;
      signaturePad.maxWidth = width;
    }

    function undo() {
      if (!signaturePad || isDrawing || state.history.length === 0) {
        return;
      }
      state.history.pop();
      _redrawContent();
    }

    //"Clear" performs a bulk undo: it erases every drawn stroke at once but
    //keeps the background photo, so the original picture stays under the
    //(now stroke-free) canvas; the strokes are gone for good, and the photo
    //keeps re-drawing on later layout changes (rotation)
    function clearAll() {
      if (!signaturePad || isDrawing) {
        return;
      }
      state.history = [];
      _redrawContent();
    }

    function _hasContent() {
      if (state.history.length > 0) {
        return true;
      }
      if (showExistingImage && existingImage) {
        return true;
      }
      return false;
    }

    async function cancel() {
      if (_hasContent()) {
        const confirmed = await notificationService.confirmSingle(
            labels.discard_drawing,
            labels.cancel
        );
        if (!confirmed) {
          return;
        }
      }
      modalController.dismiss();
    }

    //Rasterize the drawing onto a fresh canvas. With a background photo the
    //output keeps the photo's own aspect ratio (max side 1024) and the photo
    //is drawn from the original source - no letterbox bars, no upscaling of
    //the pad's low-res copy. The strokes replay from the normalized history
    //(points and widths) at the output scale, using each stroke's own color.
    //Without a photo the output stays a flat 1024x768 white canvas.
    function _exportDataURL() {
      const hasPhoto = !!(existingImage && showExistingImage);
      let outW = OUTPUT_WIDTH;
      let outH = OUTPUT_HEIGHT;
      if (hasPhoto) {
        const ratio = existingImage.width / existingImage.height;
        if (ratio >= 1) {
          outH = Math.round(OUTPUT_WIDTH / ratio);
        } else {
          outW = Math.round(OUTPUT_WIDTH * ratio);
          outH = OUTPUT_WIDTH;
        }
      }

      const out = document.createElement('canvas');
      out.width = outW;
      out.height = outH;
      const ctx = out.getContext('2d');
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillRect(0, 0, outW, outH);

      const last = state.history[state.history.length - 1];
      let pad = null;
      if (last && last.length > 0) {
        //each stored group carries its own color and (normalized) widths, so
        //a plain pad replays the strokes faithfully on the export canvas.
        //imp: the pad must exist BEFORE the photo is painted underneath its
        //strokes: its constructor clears the canvas (fills it white), which
        //would wipe the photo
        pad = new SignaturePad(out, {
          backgroundColor: 'rgb(255,255,255)',
          velocityFilterWeight: 0,
          minDistance: 1
        });
      }

      if (hasPhoto) {
        ctx.drawImage(existingImage, 0, 0, outW, outH);
      }

      if (pad) {
        let data;
        //Without a photo the strokes replay on the same 4:3 shape they were
        //drawn on (existing behavior). With a photo the output canvas IS the
        //photo (full-bleed, photo aspect), while the strokes were drawn on
        //the 4:3 pad with the photo contain-fitted and letterboxed: re-frame
        //them from the pad grid onto the photo's rect (also scaled by the
        //output/photo ratio). Stroke portions that ended on the white bars
        //fall outside the output canvas and clip away - so a line drawn
        //across the whole pad (bars included) comes out running edge to edge
        //on the photo, matching what the user sees on the image itself
        if (hasPhoto) {
          const rect = _backgroundRect();
          const canvasEl = canvas.value;
          const k = outW / rect.w;
          data = last.map((group) => ({
            ...group,
            minWidth: group.minWidth !== undefined ? group.minWidth * canvasEl.width * k : group.minWidth,
            maxWidth: group.maxWidth !== undefined ? group.maxWidth * canvasEl.width * k : group.maxWidth,
            dotSize: group.dotSize !== undefined ? group.dotSize * canvasEl.width * k : group.dotSize,
            points: group.points.map((point) => ({
              ...point,
              x: (point.x * canvasEl.width - rect.x0) * k,
              y: (point.y * canvasEl.height - rect.y0) * k
            }))
          }));
        } else {
          data = _denormalizeData(last, outW, outH);
        }
        pad.fromData(data, {clear: false});
      }
      return out.toDataURL('image/jpeg', 0.5);
    }

    function save() {
      if (!signaturePad) {
        modalController.dismiss();
        return;
      }
      const dataURL = _exportDataURL();
      modalController.dismiss({dataURL});
    }

    onMounted(async () => {
      const canvasEl = canvas.value;
      if (!canvasEl) {
        return;
      }

      //wait for initial layout before creating the pad
      await nextTick();
      await new Promise((resolve) => requestAnimationFrame(resolve));

      signaturePad = new SignaturePad(canvasEl, {
        backgroundColor: 'rgb(255,255,255)',
        penColor: state.currentColor,
        //ballpen: uniform width, no velocity-based thinning
        minWidth: BASE_PEN_WIDTH * state.thickness,
        maxWidth: BASE_PEN_WIDTH * state.thickness,
        velocityFilterWeight: 0,
        minDistance: 1
      });

      signaturePad.addEventListener('beginStroke', () => {
        isDrawing = true;
      });
      signaturePad.addEventListener('endStroke', () => {
        _pushHistory();
        isDrawing = false;
        //a pen width change arrived mid-stroke; apply it now that the
        //stroke is finished
        if (pendingPenWidth) {
          signaturePad.minWidth = pendingPenWidth;
          signaturePad.maxWidth = pendingPenWidth;
          pendingPenWidth = null;
        }
        //a layout change arrived mid-stroke; apply it now that the
        //stroke is finished
        if (pendingApplyBox) {
          const box = pendingApplyBox;
          pendingApplyBox = null;
          lastAppliedBox = box;
          const canvasEl = canvas.value;
          const changed = canvasEl.width !== box.width || canvasEl.height !== box.height;
          if (changed) {
            canvasEl.width = box.width;
            canvasEl.height = box.height;
            _redrawContent();
          }
        }
      });

      if (props.existingDataURL && props.existingDataURL !== '') {
        try {
          existingImage = await _loadImage(props.existingDataURL);
          _drawBackground();
          _pushHistory();
        } catch (error) {
          console.warn('Failed to load existing drawing for editing', error);
          //imp: dismiss to prevent saving a blank canvas over the original photo
          modalController.dismiss();
          return;
        }
      }

      //watch for layout changes (modal animation, rotation, font load)
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(_onLayoutChange);
        resizeObserver.observe(canvasEl);
      }
      window.addEventListener('resize', _onLayoutChange);

      //initial sizing (also the fallback when ResizeObserver is unavailable)
      _onLayoutChange();
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', _onLayoutChange);
      if (applyTimer) {
        clearTimeout(applyTimer);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (signaturePad) {
        signaturePad.off();
      }
    });

    const computedScope = {
      //no text label: the thickness button itself shows the selected value
      thicknessLabel: computed(() => state.thickness + 'x'),
      colorDotStyle: computed(() => ({backgroundColor: state.currentColor}))
    };

    return {
      labels,
      state,
      canvas,
      setColor,
      setThickness,
      openPenSettings,
      undo,
      clearAll,
      cancel,
      save,
      //icons
      closeOutline,
      checkmarkOutline,
      arrowUndoOutline,
      trashOutline,
      ...computedScope
    };
  }
};
</script>

<style src="@/theme/components/modals/ModalDraw.scss" lang="scss"></style>
