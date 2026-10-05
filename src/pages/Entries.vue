<template>
  <base-layout
      v-if="true"
      :title="state.projectName"
  >
    <template #actions-start>
      <ion-menu-button></ion-menu-button>
    </template>

    <template #actions-end>
      <ion-button @click="goToUploadPage()">
        <ion-icon
            slot="icon-only"
            :icon="cloudUpload"
        ></ion-icon>
      </ion-button>
      <ion-button @click="openRightDrawer()">
        <ion-icon
            slot="icon-only"
            :icon="ellipsisVertical"
        ></ion-icon>
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
            ></ion-icon>
            <div class="overflow-ellipsis toolbar-navigation-button">
              {{ state.backLabel }}
            </div>
          </ion-button>
        </ion-buttons>

        <ion-buttons slot="end">
          <ion-button
              @click="addEntry()"
          >
            <ion-icon
                slot="start"
                :icon="add"
            ></ion-icon>
            <div class="overflow-ellipsis toolbar-navigation-button">
              {{ labels.add_entry }}
            </div>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- fake entries toolbar -->
      <ion-toolbar
          v-if="state.isDebug && !state.isFetching"
          color="tertiary"
          mode="ios"
          class="animate__animated animate__fadeIn ion-no-margin ion-no-padding ion-text-center"
      >
        <ion-button
            class="ion-text-uppercase ion-no-margin ion-no-padding"
            fill="clear"
            color="dark"
            @click="addFakeEntries()"
        >
          <ion-icon
              slot="start"
              :icon="add"
          ></ion-icon>
          Add fakes
        </ion-button>
      </ion-toolbar>

      <!-- entries unsynced toolbar -->
      <ion-item
          v-if="state.hasUnsyncedEntries && !state.isFetching"
          class="item-warning ion-text-center animate__animated animate__fadeIn"
          lines="full"
      >
        <ion-label class="ion-text-uppercase ion-text-start">{{
            labels.unsynced_entries
          }}
        </ion-label>
        <ion-button
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

      <!-- form name (and filters button)  toolbar -->
      <toolbar-form-name
          :isFetching="state.isFetching"
          :projectRef="state.projectRef"
          :parentEntryName="state.parentEntryName"
          :currentFormName="state.currentFormName"
          :formRef="state.formRef"
          :parentEntryUuid="state.parentEntryUuid"
          :countWithFilters="state.countWithFilters"
          :countNoFilters="state.countNoFilters"
          :filters="{ ...state.filters }"
          @filters-params="applyFilters"
      ></toolbar-form-name>
    </template>

    <template #content>
      <ion-spinner
          v-if="state.isFetching"
          class="loader"
          name="crescent"
      ></ion-spinner>

      <div
          v-else
          class="animate__animated animate__fadeIn"
      >
        <list-entries
            v-show="!state.isFetching"
            :key="state.formRef + state.parentEntryUuid"
            :projectRef="state.projectRef"
            :entries="state.entries"
            :nextFormRef="state.nextFormRef"
            :formRef="state.formRef"
            :parentEntryUuid="state.parentEntryUuid"
            :filters="state.filters"
            :countWithFilters="state.countWithFilters"
            :countNoFilters="state.countNoFilters"
        >
        </list-entries>
      </div>
    </template>
  </base-layout>
</template>

<script>
import {menuController} from '@ionic/vue';
import {useRootStore} from '@/stores/root-store';
import {useBookmarkStore} from '@/stores/bookmark-store';
import {STRINGS} from '@/config/strings';
import {
  cloudUpload,
  add,
  chevronBackOutline,
  ellipsisVertical
} from 'ionicons/icons';
import {reactive} from '@vue/reactivity';
import {PARAMETERS} from '@/config';
import {projectModel} from '@/models/project-model.js';
import {formModel} from '@/models/form-model.js';
import {useRouter, useRoute} from 'vue-router';
import {onMounted, watch} from 'vue';
import {updateLocalProject} from '@/use/project/update-local-project';
import {databaseSelectService} from '@/services/database/database-select-service';
import {addFakeEntries} from '@/use/entries/add-fake-entries';
import {format} from 'date-fns';
import {fetchEntries} from '@/use/entries/fetch-entries.js';
import ListEntries from '@/components/ListEntries.vue';
import ToolbarFormName from '@/components/ToolbarFormName.vue';
import {provide} from 'vue';
import {useBackButton} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
import {rollbarService} from '@/services/utilities/rollbar-service';
import {utilsService} from '@/services/utilities/utils-service';
import {entryService} from '@/services/entry/entry-service';
import {locationService} from '@/services/utilities/location-cordova-service';
import {entriesListService} from '@/services/entry/entries-list-service';


export default {
  components: {ListEntries, ToolbarFormName},
  setup() {
    const rootStore = useRootStore();
    const bookmarkStore = useBookmarkStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const router = useRouter();
    const route = useRoute();
    const state = reactive({
      isFetching: true,
      entries: [],
      countNoFilters: 0,
      countWithFilters: 0,
      projectName: '',
      currentFormName: '',
      parentFormName: '',
      parentEntryName: '',
      formRef: '',
      nextFormRef: '',
      parentFormRef: '',
      parentEntryUuid: '',
      hasUnsyncedEntries: false,
      backLabel: STRINGS[language].labels.projects,
      allMediaUuids: [],
      branchMediaUuids: [],
      filters: {...PARAMETERS.FILTERS_DEFAULT},
      isDebug: PARAMETERS.DEBUG,
      isAddingFakeEntries: false,
      projectRef: ''
    });

    const routeParams = rootStore.routeParams;

    state.projectRef = routeParams.projectRef
        ? routeParams.projectRef
        : projectModel.getProjectRef();

    state.formRef = routeParams.formRef || formModel.formRef || '';

    async function checkIfProjectReady(projectRef) {
      // Warm path: same project already in memory, nothing to initialise.
      if (projectModel.hasInitialised() && projectModel.getProjectRef() === projectRef) {
        return false;
      }
      // Cold path: load the project tapped in the previous page.
      const result = await databaseSelectService.selectProject(projectRef);
      projectModel.initialise(result.rows.item(0));
      rootStore.continueProjectVersionBackgroundCheck = true;
      return true;
    }

    async function fetchListData(projectRef) {
      const activeForm = entriesListService.setActiveForm({
        projectRef,
        formRef: state.formRef,
        hierarchyNavigation: [...rootStore.hierarchyNavigation],
        language,
        bookmarks: [...bookmarkStore.bookmarks]
      });
      const counts = await entriesListService.getFilterCounts(
          projectRef,
          activeForm.formRef,
          activeForm.parentEntryUuid,
          state.filters
      );
      const queryResult = await fetchEntries({
        projectRef,
        formRef: activeForm.formRef,
        parentEntryUuid: activeForm.parentEntryUuid,
        currentEntryOffset: 0,
        filters: counts.filters
      });
      return {
        activeForm,
        counts,
        queryResult,
        projectName: utilsService.getProjectNameMarkup()
      };
    }

    function updateLocalState(data) {
      const {projectName, activeForm, counts, queryResult} = data;
      if (activeForm.resetHierarchy) {
        rootStore.hierarchyNavigation = [];
      }
      const form = projectModel.getExtraForm(activeForm.formRef);
      formModel.initialise(form);
      bookmarkStore.bookmarkId = activeForm.bookmarkId;
      state.projectName = projectName;
      state.formRef = activeForm.formRef;
      state.parentEntryUuid = activeForm.parentEntryUuid;
      state.parentEntryName = activeForm.parentEntryName;
      state.currentFormName = activeForm.currentFormName;
      state.nextFormRef = activeForm.nextFormRef;
      state.parentFormRef = activeForm.parentFormRef;
      state.parentFormName = activeForm.parentFormName;
      state.backLabel = activeForm.backLabel;
      state.countNoFilters = counts.countNoFilters;
      state.countWithFilters = counts.countWithFilters;
      state.filters = counts.filters;
      state.entries = queryResult.entries;
      state.branchMediaUuids = queryResult.branchMediaUuids;
      state.allMediaUuids = queryResult.allMediaUuids;
      state.hasUnsyncedEntries = queryResult.hasUnsyncedEntries;
    }

    async function getEntriesPageContent(skipProjectVersionCheck) {
      state.isFetching = true;
      try {
        const projectRef = state.projectRef;
        const isProjectReady = await checkIfProjectReady(projectRef);
        await notificationService.showProgressDialog(
            STRINGS[language].labels.wait,
            STRINGS[language].labels.loading_entries
        );
        const data = await fetchListData(projectRef);
        updateLocalState(data);
        state.isFetching = false;
        await notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);

        // List-first: the version check runs only on cold init, never on
        // filter/watch reloads.
        if (!isProjectReady || skipProjectVersionCheck) {
          return;
        }
        const updated = await updateLocalProject();
        if (!updated) {
          return;
        }
        // Post-update drill always restarts from the first form, which is
        // compulsory and always present: the viewed form may be gone and the
        // old hierarchy no longer applies.
        state.formRef = projectModel.getFirstFormRef();
        rootStore.hierarchyNavigation = [];
        await notificationService.showProgressDialog(
            STRINGS[language].labels.wait,
            STRINGS[language].labels.loading_entries
        );
        const reloadData = await fetchListData(state.projectRef);
        updateLocalState(reloadData);
        state.isFetching = false;
        await notificationService.hideProgressDialog(PARAMETERS.DELAY_LONG);
      } catch (error) {
        rollbarService.criticalWithContext('Entries list load failed', error);
        state.isFetching = false;
        await notificationService.hideProgressDialog(0);
        await notificationService.showAlert(STRINGS[language].labels.error);
        if (!projectModel.hasInitialised()) {
          router.replace({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: {refresh: true}
          });
        }
      }
    }

    onMounted(async () => {
      console.log('Component Entries is mounted!');
      await getEntriesPageContent(false);
    });

    const methods = {
      openRightDrawer() {
        menuController.open('right-drawer');
      },
      goBack() {
        if (state.isFetching || state.isAddingFakeEntries) {
          return;
        }
        if (rootStore.isProjectUpdating || rootStore.isProjectUpdateModalActive) {
          return;
        }
        // Project update cannot take place if navigating away
        rootStore.continueProjectVersionBackgroundCheck = false;
        if (state.parentFormRef === '') {
          projectModel.destroy();
          formModel.destroy();

          router.replace({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: {refresh: true}
          });
        } else {
          const hierarchyNavigation = [...rootStore.hierarchyNavigation];
          hierarchyNavigation.pop();
          rootStore.hierarchyNavigation = [...hierarchyNavigation];

          const nextParams = {...rootStore.routeParams};
          nextParams.formRef = state.parentFormRef;

          if (rootStore.hierarchyNavigation.length === 0) {
            nextParams.formRef = '';
          }
          rootStore.routeParams = nextParams;
          router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
              refreshEntries: 'true',
              timestamp: Date.now()
            }
          });
        }
      },
      goToUploadPage() {
        // Project update cannot take place if navigating away
        rootStore.continueProjectVersionBackgroundCheck = false;
        rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;
        rootStore.routeParamsEntries = rootStore.routeParams;

        router.replace({
          name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
        });
      },
      utcToLocal(utcDateString) {
        return format(new Date(utcDateString), 'dd MMM, yyyy @ h:mma');
      },
      viewEntry(entry) {
        rootStore.continueProjectVersionBackgroundCheck = false;
        rootStore.nextRoute = PARAMETERS.ROUTES.ENTRIES;

        rootStore.routeParams = {
          entryUuid: entry.entry_uuid,
          parentEntryUuid: state.parentEntryUuid,
          formRef: state.formRef
        };

        router.replace({
          name: PARAMETERS.ROUTES.ENTRIES_VIEW
        });
      },
      async addEntry() {
        rootStore.continueProjectVersionBackgroundCheck = false;

        rootStore.queueFilesToDelete = [];

        await notificationService.showProgressDialog(
            STRINGS[language].labels.wait
        );
        entryService.setUpNew(
            state.formRef,
            state.parentEntryUuid,
            state.parentFormRef
        );

        rootStore.routeParams = {
          formRef: state.formRef,
          inputRef: null,
          inputIndex: 0,
          isBranch: false,
          error: {}
        };

        window.setTimeout(function () {
          notificationService.hideProgressDialog();
        }, PARAMETERS.DELAY_LONG);

        router.replace({
          name: PARAMETERS.ROUTES.ENTRIES_ADD
        });
      },
      async addFakeEntries() {
        const {formRef, parentEntryUuid, parentFormRef} = state;
        const params = {formRef, parentEntryUuid, parentFormRef};
        state.isAddingFakeEntries = true;
        await addFakeEntries(params);
        state.isAddingFakeEntries = false;
        locationService.stopWatching();

        setTimeout(function () {
          router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
              refreshEntries: 'true',
              timestamp: Date.now()
            }
          });
        }, PARAMETERS.DELAY_FAST);
      },
      async applyFilters(params) {
        if (!utilsService.objectsMatch(state.filters, params.filters)) {
          state.isFetching = true;
          state.filters = params.filters;

          console.log('countNoFilters', state.countNoFilters);
          await getEntriesPageContent(true);
        }
      }
    };

    watch(
        () => [
          {
            refreshEntries: route.query.refreshEntries,
            refresh: route.query.refresh,
            timestamp: route.query.timestamp
          }
        ],
        async (changes) => {
          console.log('WATCH ROUTING CALLED WITH ->', route.name);
          rootStore.continueProjectVersionBackgroundCheck = false;
          if (changes[0].refreshEntries === 'true') {
            state.isFetching = true;
            await utilsService.delay(PARAMETERS.DELAY_LONG);
            state.formRef = rootStore.routeParams.formRef;
            state.projectRef = rootStore.routeParams.projectRef
                ? rootStore.routeParams.projectRef
                : projectModel.getProjectRef();
            state.filters = {...PARAMETERS.FILTERS_DEFAULT};
            await getEntriesPageContent(true);
          }
        }
    );

    provide('entriesState', state);

    useBackButton(10, () => {
      console.log('useBackButton Entries');
      if (rootStore.isExportModalActive || rootStore.isProjectUpdating || rootStore.isProjectUpdateModalActive) {
        return false;
      }

      if (state.isAddingFakeEntries || state.isFetching) {
        return false;
      }

      rootStore.continueProjectVersionBackgroundCheck = false;
      methods.goBack();
    });

    const computedScope = {};

    return {
      labels,
      state,
      ...methods,
      ...computedScope,
      cloudUpload,
      add,
      chevronBackOutline,
      ellipsisVertical
    };
  }
};
</script>

<style src="@/theme/pages/Entries.scss" lang="scss"></style>
