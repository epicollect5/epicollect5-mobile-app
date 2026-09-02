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
          {{ _thicknessLabel() }}
        </ion-button>
        <ion-button
            class="modal-draw__color-button"
            :aria-label="labels.draw"
        >
          <span
              class="modal-draw__color-dot"
              :style="{backgroundColor: state.currentColor}"
          ></span>
        </ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
</template>

<script>
import {onMounted, onBeforeUnmount, ref, reactive, nextTick} from 'vue';
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
    //the pre-existing drawing is shown until the user clears it; once
    //cleared it must not re-appear on later layout changes (rotation)
    let showExistingImage = true;
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
      //deep-copy the stroke data: toData() returns signature_pad's live
      //array, which later strokes mutate
      state.history.push(
          signaturePad.toData().map((group) => ({
            ...group,
            points: group.points.map((point) => ({...point}))
          }))
      );
    }

    function _loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });
    }

    //Redraw the existing image (if any) plus the recorded strokes on top of
    //a freshly cleared canvas. The grid has just been resized, which wiped
    //the canvas, so this restores whatever the user had drawn.
    //Never run mid-stroke: signature_pad's clear() leaves _drawingStroke
    //true, which permanently blocks any further stroke on the pad.
    function _redrawContent() {
      if (!signaturePad || isDrawing) {
        return;
      }
      const data = signaturePad.toData();
      const canvasEl = canvas.value;
      signaturePad.clear();
      if (existingImage && showExistingImage) {
        canvasEl.getContext('2d').drawImage(
            existingImage,
            0,
            0,
            canvasEl.width,
            canvasEl.height
        );
      }
      if (data.length > 0) {
        signaturePad.fromData(data, {clear: false});
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

    //no text label: the thickness button itself shows the selected value
    function _thicknessLabel() {
      return state.thickness + 'x';
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

    function _redrawFromHistory() {
      const canvasEl = canvas.value;
      signaturePad.clear();
      if (existingImage && showExistingImage) {
        canvasEl.getContext('2d').drawImage(
            existingImage,
            0,
            0,
            canvasEl.width,
            canvasEl.height
        );
      }
      const last = state.history[state.history.length - 1];
      if (last && last.length > 0) {
        signaturePad.fromData(last, {clear: false});
      }
    }

    function undo() {
      if (!signaturePad || isDrawing || state.history.length === 0) {
        return;
      }
      state.history.pop();
      _redrawFromHistory();
    }

    function clearAll() {
      if (!signaturePad || isDrawing) {
        return;
      }
      signaturePad.clear();
      state.history = [];
      //a cleared drawing is gone for good: it must not come back on the
      //next layout change (e.g. rotation)
      showExistingImage = false;
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

    //Rasterize the current canvas content onto a fresh 1024x768 canvas.
    //The drawing canvas is sized to the viewport; this gives a fixed output size.
    function _exportDataURL() {
      const out = document.createElement('canvas');
      out.width = OUTPUT_WIDTH;
      out.height = OUTPUT_HEIGHT;
      const ctx = out.getContext('2d');
      ctx.fillStyle = 'rgb(255,255,255)';
      ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

      const visible = canvas.value;
      if (visible) {
        ctx.drawImage(visible, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
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
          canvasEl.getContext('2d').drawImage(
              existingImage,
              0,
              0,
              canvasEl.width,
              canvasEl.height
          );
          _pushHistory();
        } catch (error) {
          console.warn('Failed to load existing drawing for editing', error);
          existingImage = null;
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

    return {
      labels,
      state,
      canvas,
      setColor,
      setThickness,
      openPenSettings,
      _thicknessLabel,
      undo,
      clearAll,
      cancel,
      save,
      //icons
      closeOutline,
      checkmarkOutline,
      arrowUndoOutline,
      trashOutline
    };
  }
};
</script>

<style src="@/theme/components/modals/ModalDraw.scss" lang="scss"></style>
