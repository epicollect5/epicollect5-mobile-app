<template>
  <ion-header class="ion-no-border">
    <ion-toolbar>
      <ion-title
          class="ion-text-center"
          color="dark"
      >
        {{ header }}
      </ion-title>
    </ion-toolbar>
  </ion-header>
  <ion-content class="ion-text-center">
    <ion-spinner
        class="spinner-export"
        name="crescent">
    </ion-spinner>
    <div
        class="progress-export animate__animated animate__fadeIn"
    >
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
    </div>
  </ion-content>
</template>

<script>
import {computed} from 'vue';
import {useRootStore} from '@/stores/root-store';

export default {
  props: {
    header: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const rootStore = useRootStore();

    const computedScope = {
      progress: computed(() => {
        const progress = rootStore.progressExport;
        if (progress.total === 0) return 0;
        return progress.done / progress.total;
      }),
      percentageDisplay: computed(() => {
        const progress = rootStore.progressExport;
        if (progress.total === 0) return '0%';
        return Math.round((progress.done / progress.total) * 100) + '%';
      }),
      header: props.header
    };
    return {
      ...computedScope
    };
  }
};
</script>

<style lang="scss" scoped></style>
