<template>
  <!-- Show a single, consistent icon when the project was imported from a file -->
  <ion-icon
      :icon="readerOutline"
      v-if="wasProjectImportedFromFile"
      class="entry-imported"
  ></ion-icon>


  <!-- Otherwise show the normal set of icons -->
  <template v-else>
    <ion-icon
        :icon="desktopOutline"
        v-if="entry.is_remote === 1"
        class="entry-not-synced"
    >
    </ion-icon>
    <ion-icon
        slot="start"
        :icon="cloudOutline"
        v-if="entry.synced === 0"
        class="entry-not-synced"
    ></ion-icon>

    <ion-icon
        :icon="cloudDone"
        v-if="entry.synced === 1 "
        class="entry-synced"
    >
    </ion-icon>
    <ion-icon
        :icon="cloud"
        v-if="entry.synced === -1 "
        class="entry-sync-error"
    ></ion-icon>

    <ion-icon
        :icon="removeCircle"
        class="entry-incomplete"
        v-if="entry.synced === 2 "
    ></ion-icon>

    <ion-icon
        :icon="cloudOutline"
        v-if="entry.synced === 3 "
        class="entry-not-synced"
    ></ion-icon>
    <ion-icon
        :icon="bug"
        class="entry-sync-error"
        v-if="entry.hasMediaError"
    ></ion-icon>
  </template>
</template>

<script>
import {bug, cloudOutline, removeCircle, cloud, cloudDone, desktopOutline, readerOutline} from 'ionicons/icons';

export default {
  props: {
    entry: {
      type: Object,
      required: true
    },
    wasProjectImportedFromFile: {
      type: Boolean,
      default: false
    }
  },
  setup() {
    return {
      //icons
      bug,
      cloudOutline,
      removeCircle,
      cloud,
      cloudDone,
      desktopOutline,
      readerOutline
    };
  }
};
</script>

<style lang="scss" scoped>
</style>
