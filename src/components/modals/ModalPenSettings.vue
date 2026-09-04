<template>
  <!--secondary, not primary: this modal stacks over the draw modal's
      identical-header, so the color swap signals the stack depth-->
  <ion-header class="ion-no-border">
    <ion-toolbar color="secondary">
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
    <div class="modal-pen-settings__content ion-padding">
      <div class="modal-pen-settings__preview ion-margin-bottom">
        <span
            class="modal-pen-settings__preview-swatch"
            :style="previewSwatchStyle"
        ></span>
        <span class="modal-pen-settings__preview-value">{{ previewHexUpper }}</span>
        <span class="modal-pen-settings__preview-thickness">
          <ion-icon :icon="pencil"></ion-icon>
          {{ state.thickness }}x
        </span>
      </div>
      <div class="modal-pen-settings__grid">
        <button
            v-for="color in palette"
            :key="color"
            type="button"
            class="modal-pen-settings__swatch"
            :class="{'modal-pen-settings__swatch--selected': color === state.pickedColor}"
            :style="{backgroundColor: color}"
            :aria-label="color"
            @click="selectColor(color)"
        ></button>
      </div>
      <div class="modal-pen-settings__thickness">
        <ion-range
            class="modal-pen-settings__range"
            :min="1"
            :max="10"
            :step="1"
            :snaps="true"
            :ticks="true"
            :pin="true"
            :pin-formatter="_pinFormatter"
            :value="state.thickness"
            @ionInput="setThickness($event.detail.value)"
        >
          <!--scale labels; the selected value is marked by the active ticks
              and the drag pin-->
          <div
              slot="start"
              class="modal-pen-settings__scale-label"
          >1x</div>
          <div
              slot="end"
              class="modal-pen-settings__scale-label"
          >10x</div>
        </ion-range>
      </div>
    </div>
  </ion-content>
</template>

<script>
import {reactive, computed} from 'vue';
import {modalController} from '@ionic/vue';
import {closeOutline, checkmarkOutline, pencil} from 'ionicons/icons';
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings.js';

//CSS color names the rest of the app may pass in (the draw pad defaults to
//'black'); normalize them so they match a palette entry
const NAMED_COLORS = {
  black: '#000000',
  white: '#ffffff'
};

//the Google Docs "advanced text" swatch set (vue-swatches text-advanced
//preset): 8 rows x 10 columns covering the greys, the primary hues, and the
//light/mid/dark shades of each family
const PALETTE = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
];

export default {
  props: {
    currentColor: {
      type: String,
      default: '#000000'
    },
    thickness: {
      type: Number,
      default: 1
    }
  },
  setup(props) {
    const rootStore = useRootStore();
    const labels = STRINGS[rootStore.language].labels;

    const state = reactive({
      pickedColor: NAMED_COLORS[(props.currentColor || '').toLowerCase()] || props.currentColor,
      thickness: props.thickness
    });

    //no text label: the pin appends the x unit while dragging
    function _pinFormatter(value) {
      return Math.round(value) + 'x';
    }

    function setThickness(value) {
      state.thickness = value;
    }

    function selectColor(color) {
      state.pickedColor = color;
    }

    function cancel() {
      modalController.dismiss();
    }

    //Save applies both pen settings together; Cancel keeps the previous ones
    function save() {
      modalController.dismiss({
        color: state.pickedColor,
        thickness: state.thickness
      });
    }

    const computedScope = {
      previewSwatchStyle: computed(() => ({backgroundColor: state.pickedColor})),
      previewHexUpper: computed(() => state.pickedColor.toUpperCase())
    };

    return {
      labels,
      state,
      palette: PALETTE,
      _pinFormatter,
      setThickness,
      selectColor,
      cancel,
      save,
      //icons
      closeOutline,
      checkmarkOutline,
      pencil,
      ...computedScope
    };
  }
};
</script>

<style src="@/theme/components/modals/ModalPenSettings.scss" lang="scss"></style>