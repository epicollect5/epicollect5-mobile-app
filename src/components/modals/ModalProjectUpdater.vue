<template>
  <ion-header class="ion-no-border">
    <ion-toolbar color="primary">
      <ion-title
          class="project-header ion-text-center"
          v-html="projectHeaderMarkup"
      ></ion-title>
    </ion-toolbar>
    <ion-toolbar
        color="dark"
        class="toolbar-title"
    >
      <ion-title
          class="ion-text-center ion-text-uppercase"
          color="light"
      >
        {{ header }}
      </ion-title>
    </ion-toolbar>
  </ion-header>
  <ion-content class="ion-text-center">
    <div
        class="updater-body"
        :class="{ 'updater-done': isDone }"
    >
    <div v-if="!isDone">
      <ion-spinner
          class="spinner-update"
          name="crescent">
      </ion-spinner>
      <div class="progress-update animate__animated animate__fadeIn">
        <ion-progress-bar
            color="primary"
            :value="progress"
        >
        </ion-progress-bar>
        <ion-item lines="none">
          <ion-label class="ion-text-center">
            <strong>{{ percentageDisplay }}</strong>
          </ion-label>
        </ion-item>
        <strong>
          <p>{{ statusDisplay }}</p>
        </strong>
      </div>
    </div>
    <div v-else>
      <ion-item lines="none">
        <ion-label
            class="ion-text-center"
            v-html="doneMessage"
        >
        </ion-label>
      </ion-item>
      <grid-question-narrow>
        <template #content>
          <ion-button
              class="question-action-button ion-text-nowrap"
              color="secondary"
              expand="block"
              @click="dismiss()"
          >
            <ion-icon
                slot="start"
                :icon="checkmark"
            ></ion-icon>
            {{ labels.ok }}
          </ion-button>
        </template>
      </grid-question-narrow>
    </div>
    </div>
  </ion-content>
</template>

<script>
import { reactive, computed } from '@vue/reactivity';
import { modalController } from '@ionic/vue';
import { checkmark } from 'ionicons/icons';
import { useRootStore } from '@/stores/root-store';
import { STRINGS } from '@/config/strings';
import { utilsService } from '@/services/utilities/utils-service';
import GridQuestionNarrow from '@/components/GridQuestionNarrow.vue';

const ModalProjectUpdater = {
  components: {GridQuestionNarrow},
  props: {
    header: {
      type: String,
      required: true
    }
  },
  setup() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const state = reactive({});
    const doneMessage = STRINGS[language].status_codes.ec5_137;
    const projectHeaderMarkup = utilsService.getProjectNameMarkup();
    const methods = {
      async dismiss() {
        if (rootStore.updateDone !== true) {
          return;
        }
        await modalController.dismiss();
      }
    };
    const computedScope = {
      isDone: computed(() => {
        return rootStore.updateDone === true;
      }),
      progress: computed(() => {
        const progress = rootStore.progressUpdate;
        if (progress.total === 0) {
          return 0;
        }
        return progress.done / progress.total;
      }),
      percentageDisplay: computed(() => {
        const progress = rootStore.progressUpdate;
        if (progress.total === 0) {
          return '0%';
        }
        return Math.round((progress.done / progress.total) * 100) + '%';
      }),
      statusDisplay: computed(() => {
        const progress = rootStore.progressUpdate;
        if (progress.total === 0) {
          return '';
        }
        return progress.done + ' / ' + progress.total;
      })
    };
    return {
      labels,
      state,
      doneMessage,
      projectHeaderMarkup,
      ...methods,
      ...computedScope,
      checkmark
    };
  }
};

export default ModalProjectUpdater;

export async function showUpdaterModal(header) {
  const rootStore = useRootStore();
  const modal = await modalController.create({
    cssClass: 'modal-project-updater',
    component: ModalProjectUpdater,
    showBackdrop: true,
    backdropDismiss: false,
    componentProps: {
      header
    }
  });
  rootStore.isProjectUpdateModalActive = true;
  await modal.present();
  return { modal };
}
</script>

<style src="@/theme/components/modals/ModalProjectUpdater.scss" lang="scss"></style>
