<template>
  <base-layout
      :title="state.projectName"
      id="entries-view-branch"
  >

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

          <ion-button @click="cloneEntryBranch()">
            <ion-icon
                slot="start"
                :icon="copyOutline"
            >
            </ion-icon>
            {{ labels.clone }}
          </ion-button>

          <ion-button @click="deleteEntryBranch()">
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
          <ion-item-divider
              color="warning"
              class="entry-incomplete"
              sticky
          >
            <ion-label class="entry-title-label ion-text-center">
              {{ labels.incomplete_entry }}
            </ion-label>
          </ion-item-divider>
        </div>
        <!-- ------------------------------------------------------ -->

        <list-answers
            :formRef="state.formRef"
            :items="state.items"
            :entry="state.entry"
            :errors="state.errors"
            :areGroupAnswers="false"
            :areBranchAnswers="true"
        ></list-answers>
      </div>
    </template>
  </base-layout>
</template>

<script>
import {useRootStore} from '@/stores/root-store';
import {STRINGS} from '@/config/strings';
import {chevronBackOutline, trash, copyOutline} from 'ionicons/icons';
import {PARAMETERS} from '@/config';
import {projectModel} from '@/models/project-model.js';
import {branchEntryModel} from '@/models/branch-entry-model.js';
import {useRouter, useRoute} from 'vue-router';
import {watch, reactive} from 'vue';
import ListAnswers from '@/components/ListAnswers';
import {useBackButton} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import ItemDividerError from '@/components/ItemDividerError.vue';
import {cloneEntryBranch} from '@/use/clone-entry-branch';
import {fetchBranchAnswers} from '@/use/fetch-branch-answers';
import {deleteEntryBranch} from '@/use/delete-entry-branch';

export default {
  components: {ListAnswers, ItemDividerError},
  setup() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const statusCodes = STRINGS[language].status_codes;

    const router = useRouter();
    const route = useRoute();
    const state = reactive({
      isFetching: true,
      projectName: '',
      formRef: '',
      entryUuid: '',
      parentEntryUuid: '',
      ownerEntryUuid: '',
      ownerInputRef: '',
      title: '',
      entry: {},
      errors: {},
      branches: {},
      branchesMediaErrors: {},
      items: {},
      inputsExtra: {},
      branchInputs: [],
      statusCodes: STRINGS[language].status_codes,
      synced: null
    });

    const routeParams = rootStore.routeParams;

    state.entry = branchEntryModel;
    state.entryUuid = routeParams.entryUuid;
    state.ownerEntryUuid = routeParams.ownerEntryUuid;
    state.ownerInputRef = routeParams.ownerInputRef;
    state.formRef = routeParams.formRef;
    //get markup to show project logo in page header
    state.projectName = utilsService.getProjectNameMarkup();
    // Retrieve all branch inputs

    state.branchInputs = projectModel.getBranches(state.formRef, state.ownerInputRef);
    // Retrieve the inputs extra details
    state.inputsExtra = projectModel.getExtraInputs();
    state.synced = state.entry.synced;

    const methods = {
      goBack() {
        rootStore.routeParams = {
          formRef: state.entry.formRef,
          inputRef: state.entry.ownerInputRef,
          inputIndex: projectModel.getInputIndexFromRef(
              state.entry.formRef,
              state.entry.ownerInputRef
          ),
          error: state.errors
        };

        router.replace({
          name: PARAMETERS.ROUTES.ENTRIES_ADD,
          query: {
            refreshBranchEntries: 'true',
            timestamp: Date.now()
          }
        });
      },
      async deleteEntryBranch() {
        await deleteEntryBranch(state, language, labels, methods.goBack);
      },
      async cloneEntryBranch() {
        await cloneEntryBranch(
            state,
            language,
            labels,
            methods.goBack
        );
      }
    };

    fetchBranchAnswers(state, language, labels).catch((error) => {
      console.error('Failed to fetch answers:', error);
      state.isFetching = false;
      notificationService.hideProgressDialog();
    });

    watch(
        () => [
          {
            refreshEntriesViewBranch: route.params.refreshEntriesViewBranch,
            timestamp: route.params.timestamp
          }
        ],
        (changes) => {
          console.log('WATCH ROUTING CALLED WITH ->', route.name);

          //imp: fix this it gets checked all the  time
          if (changes[0].refreshEntriesViewBranch === 'true') {
            state.isFetching = true;
            setTimeout(async () => {
               fetchBranchAnswers( state, language, labels).catch((error) => {
                  console.error('Failed to fetch answers:', error);
                  state.isFetching = false;
                  notificationService.hideProgressDialog();
                });
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
      chevronBackOutline,
      trash,
      copyOutline
    };
  }
};
</script>

<style
    lang="scss"
    scoped
></style>
