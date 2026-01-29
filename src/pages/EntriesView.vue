<template>
  <base-layout :title="state.projectName">

    <template #actions-start>
      <ion-menu-button></ion-menu-button>
    </template>

    <template #actions-end>
      <ion-button disabled>
        <ion-icon slot="icon-only">
        </ion-icon>
      </ion-button>
    </template>

    <template #subheader>
      <ion-toolbar
          color="dark"
          mode="md"
      >
        <ion-buttons slot="start">
          <ion-button @click="goBack()">
            <ion-icon
                slot="start"
                :icon="chevronBackOutline"
            >
            </ion-icon>
            {{ labels.back }}
          </ion-button>
        </ion-buttons>

        <ion-buttons slot="end">
          <ion-button @click="cloneEntry()">
            <ion-icon
                slot="start"
                :icon="copyOutline"
            >
            </ion-icon>
            {{ labels.clone }}
          </ion-button>
          <ion-button @click="deleteEntry()">
            <ion-icon
                slot="start"
                :icon="trash"
            >
            </ion-icon>
            {{ labels.delete }}
          </ion-button>
        </ion-buttons>

      </ion-toolbar>

    </template>

    <template #content>
      <ion-spinner
          v-if="state.isFetching"
          class="loader"
          name="crescent"
      ></ion-spinner>

      <div v-else>

        <!-- Errors banner ----------------------------------------->
        <div v-if="state.errors?.errors?.length > 0">
          <item-divider-error
              v-for="(error, index) in state.errors.errors"
              :key="index"
              :message="statusCodes[error.code] || error.title"
          ></item-divider-error>
        </div>
        <!-- ----------------------------------------------------- -->

        <!-- Incomplete entry banner--------------------------------->
        <div v-if="state.synced === 2">
          <ion-item
              class="item-warning animate__animated animate__fadeIn"
              lines="full"
              mode="md"
          >
            <ion-icon
                slot="end"
                :icon="removeCircle"
            ></ion-icon>
            <ion-label class="ion-text-uppercase"> {{ labels.incomplete_entry }}</ion-label>
          </ion-item>
        </div>
        <!-- ------------------------------------------------------ -->

        <!-- entries unsynced banner --------------------------------------->
        <ion-item
            v-if="state.synced === 0"
            class="item-warning ion-text-center animate__animated animate__fadeIn"
            lines="full"
        >
          <ion-label class="ion-text-uppercase ion-text-start">{{ labels.unsynced_entry }}</ion-label>
          <ion-button
              class="ion-text-nowrap"
              color="warning"
              size="default"
              @click="goToUploadPage()"
          >
            <ion-icon
                :icon="cloudUpload"
                slot="start"
            ></ion-icon>
            {{ labels.sync_now }}
          </ion-button>
        </ion-item>

        <!-- Remote entry warning banner -->
        <div v-if="state.entry.isRemote === 1">
          <ion-item
              class="item-warning animate__animated animate__fadeIn"
              lines="full"
              mode="md"
          >
            <ion-icon
                slot="end"
                :icon="desktopOutline"
            ></ion-icon>
            <ion-label class="ion-text-uppercase">{{ labels.remote_entry }}</ion-label>
          </ion-item>
        </div>

        <list-answers
            :formRef="state.formRef"
            :items="state.items"
            :entry="state.entry"
            :errors="state.errors"
            :areGroupAnswers="false"
            :areBranchAnswers="false"
        ></list-answers>
      </div>
    </template>
  </base-layout>
</template>

<script>
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings';
import {deleteEntry} from '@/use/delete-entry';
import {cloneEntry} from '@/use/clone-entry';
import {fetchAnswers} from '@/use/fetch-answers';

import {
  desktopOutline,
  cloudUpload,
  trash,
  removeCircle,
  chevronBackOutline,
  copyOutline
} from 'ionicons/icons';
import {reactive} from '@vue/reactivity';
import {PARAMETERS} from '@/config';
import {projectModel} from '@/models/project-model.js';
import {entryModel} from '@/models/entry-model';
import {useRouter, useRoute} from 'vue-router';
import {watch} from 'vue';
import ListAnswers from '@/components/ListAnswers';
import {useBackButton} from '@ionic/vue';
import {databaseSelectService} from '@/services/database/database-select-service';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {answerService} from '@/services/entry/answer-service';
import ItemDividerError from '@/components/ItemDividerError.vue';
import {useBookmarkStore} from '@/stores/bookmark-store';


export default {
  components: {ListAnswers, ItemDividerError},
  setup() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const bookmarkStore = useBookmarkStore();
    const statusCodes = STRINGS[language].status_codes;
    const router = useRouter();
    const route = useRoute();
    const state = reactive({
      isFetching: true,
      projectName: '',
      formRef: '',
      entryUuid: '',
      parentEntryUuid: '',
      title: '',
      entry: {},
      errors: {},
      branches: {},
      branchesMediaErrors: {},
      items: {},
      inputsExtra: {},
      statusCodes: STRINGS[language].status_codes,
      synced: null
    });

    const routeParams = rootStore.routeParams;
    state.entry = entryModel;
    state.entryUuid = routeParams.entryUuid;
    state.parentEntryUuid = routeParams.parentEntryUuid;
    state.formRef = routeParams.formRef;

    // Retrieve all form inputs
    state.inputs = projectModel.getFormInputs(state.formRef);

    // Retrieve the inputs extra details
    state.inputsExtra = projectModel.getExtraInputs();
    state.synced = state.entry.synced;

    // Retrieve the answers
    fetchAnswers(state, language, labels);

    const methods = {
      goBack() {
        if (rootStore.nextRoute) {
          const route = rootStore.nextRoute;
          const refreshEntries = route === PARAMETERS.ROUTES.ENTRIES;
          const refreshEntriesErrors = route === PARAMETERS.ROUTES.ENTRIES_ERRORS;
          //there is a route saved, go there
          router.replace({
            name: rootStore.nextRoute,
            query: {
              refreshEntries,
              refreshEntriesErrors,
              timestamp: Date.now()
            }
          });
          //reset route
          rootStore.nextRoute = null;
        } else {
          //go back to entries list
          router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
              refreshEntries: true
            }
          });
        }
      },
      async deleteEntry() {
        await deleteEntry(
            state,
            router,
            bookmarkStore,
            rootStore,
            language,
            labels
        );
      },
      goToUploadPage() {
        rootStore.nextRoute = router.currentRoute.value.name;
        router.replace({
          name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
        });
      },
      async cloneEntry() {
        await cloneEntry(
            state,
            router,
            rootStore,
            language,
            labels
        );
      }
    };

    watch(
        () => [
          {
            refreshEntriesView: route.params.refreshEntriesView,
            timestamp: route.params.timestamp
          }
        ],
        async (changes) => {
          console.log('WATCH ROUTING CALLED WITH ->', route.name);
          //imp: fix this it gets checked all the  time

          if (changes[0].refreshEntriesView === 'true') {
            state.isFetching = true;
            await notificationService.showProgressDialog(labels.wait, labels.loading_entry);
            setTimeout(async () => {
              await fetchAnswers(state, language, labels);
            }, PARAMETERS.DELAY_LONG);
          }
        }
    );

    //back with back button (Android)
    useBackButton(10, () => {
      console.log(window.history);
      if (!state.isFetching) {
        methods.goBack();
      }
    });

    return {
      state,
      labels,
      statusCodes,
      ...methods,
      //icons
      desktopOutline,
      cloudUpload,
      trash,
      removeCircle,
      chevronBackOutline,
      copyOutline
    };
  }
};
</script>

<style
    lang="scss"
    scoped
></style>
