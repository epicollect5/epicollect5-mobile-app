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
import {fetchProjectRow} from '@/use/project/fetch-project-row';
import {addFakeEntries} from '@/use/entries/add-fake-entries';
import {format} from 'date-fns';
import {fetchEntries} from '@/use/entries/fetch-entries.js';
import ListEntries from '@/components/ListEntries.vue';
import ToolbarFormName from '@/components/ToolbarFormName.vue';
import {provide} from 'vue';
import {useBackButton, onIonViewWillEnter, onIonViewWillLeave} from '@ionic/vue';
import {notificationService} from '@/services/notification-service';
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
      projectRef: '',
      loadToken: 0,
      loaderSeq: 0,
      showResolved: false,
      isLoading: false,
      leaving: false,
      pendingRequest: null,
      versionCheckPending: false
    });

    let updateAbortController = null;

    const routeParams = rootStore.routeParams;

    state.projectRef = routeParams.projectRef
        ? routeParams.projectRef
        : projectModel.getProjectRef();

    state.formRef =
        routeParams.formRef !== '' ? routeParams.formRef : formModel.formRef;

    function isCurrent(loadId) {
      if (loadId !== state.loadToken) {
        return false;
      }
      if (state.leaving) {
        return false;
      }
      return true;
    }

    async function showOwnedLoader(loadId) {
      const seq = state.loaderSeq + 1;
      state.loaderSeq = seq;
      state.showResolved = false;
      try {
        await notificationService.showProgressDialog(
            STRINGS[language].labels.wait,
            STRINGS[language].labels.loading_entries
        );
      } catch (_) {
        return { shown: false, seq };
      }
      if (loadId !== state.loadToken || state.leaving) {
        try {
          await notificationService.hideProgressDialog(0);
        } catch (hideError) {
          console.log('hide owned loader failed: ' + hideError);
        }
        return { shown: false, seq };
      }
      if (seq !== state.loaderSeq) {
        try {
          await notificationService.hideProgressDialog(0);
        } catch (hideError) {
          console.log('hide owned loader failed: ' + hideError);
        }
        return { shown: false, seq };
      }
      state.showResolved = true;
      return { shown: true, seq };
    }

    async function hideOwnedLoader(loadId, acquisition, delay) {
      if (!acquisition || !acquisition.shown) {
        return;
      }
      if (loadId !== state.loadToken) {
        return;
      }
      if (acquisition.seq !== state.loaderSeq) {
        return;
      }
      if (!state.showResolved) {
        return;
      }
      if (delay) {
        await utilsService.delay(delay);
      }
      if (loadId !== state.loadToken || acquisition.seq !== state.loaderSeq) {
        return;
      }
      await notificationService.hideProgressDialog();
      state.showResolved = false;
    }

    async function ensureColdInit(projectRef, loadId) {
      if (projectModel.hasInitialised() && projectModel.getProjectRef() === projectRef) {
        return { initialisedNow: false };
      }
      const row = await fetchProjectRow(projectRef);
      if (!isCurrent(loadId)) {
        return { initialisedNow: false, stale: true };
      }
      projectModel.initialise(row);
      if (projectModel.getProjectRef() !== projectRef) {
        const error = new Error('Wrong project initialised');
        error.code = 'PROJECT_MISMATCH';
        throw error;
      }
      rootStore.continueProjectVersionUpdate = true;
      return { initialisedNow: true };
    }

    async function fetchListData(projectRef) {
      const context = entriesListService.resolveFormContext({
        projectRef,
        formRef: state.formRef,
        hierarchyNavigation: [...rootStore.hierarchyNavigation],
        language,
        bookmarks: [...bookmarkStore.bookmarks]
      });
      const counts = await entriesListService.getFilterCounts(
          projectRef,
          context.formRef,
          context.parentEntryUuid,
          state.filters
      );
      const response = await fetchEntries({
        projectRef,
        formRef: context.formRef,
        parentEntryUuid: context.parentEntryUuid,
        currentEntryOffset: 0,
        filters: counts.filters
      });
      return {
        context,
        counts,
        response,
        projectName: utilsService.getProjectNameMarkup()
      };
    }

    function commitResult(data) {
      const { context, counts, response } = data;
      if (context.resetHierarchy) {
        rootStore.hierarchyNavigation = [];
      }
      const form = projectModel.getExtraForm(context.formRef);
      formModel.initialise(form);
      bookmarkStore.bookmarkId = context.bookmarkId;
      state.projectName = data.projectName;
      state.formRef = context.formRef;
      state.parentEntryUuid = context.parentEntryUuid;
      state.parentEntryName = context.parentEntryName;
      state.currentFormName = context.currentFormName;
      state.nextFormRef = context.nextFormRef;
      state.parentFormRef = context.parentFormRef;
      state.parentFormName = context.parentFormName;
      state.backLabel = context.backLabel;
      state.countNoFilters = counts.countNoFilters;
      state.countWithFilters = counts.countWithFilters;
      state.filters = counts.filters;
      state.entries = response.entries;
      state.branchMediaUuids = response.branchMediaUuids;
      state.allMediaUuids = response.allMediaUuids;
      state.hasUnsyncedEntries = response.hasUnsyncedEntries;
    }

    async function runLoad(options) {
      const opts = options || {};
      const skipVersionCheck = opts.skipVersionCheck === true;
      const loadId = state.loadToken + 1;
      state.loadToken = loadId;
      state.isLoading = true;
      state.isFetching = true;
      let loader = { shown: false, seq: 0 };
      try {
        const projectRef = state.projectRef;
        const init = await ensureColdInit(projectRef, loadId);
        if (init.stale || !isCurrent(loadId)) {
          return;
        }
        loader = await showOwnedLoader(loadId);
        const data = await fetchListData(projectRef);
        if (!isCurrent(loadId)) {
          return;
        }
        commitResult(data);
        if (isCurrent(loadId)) {
          state.isFetching = false;
        }
        await hideOwnedLoader(loadId, loader, PARAMETERS.DELAY_LONG);
        loader = { shown: false, seq: 0 };

        const shouldCheck = (init.initialisedNow || state.versionCheckPending) && !skipVersionCheck;
        if (!shouldCheck || !isCurrent(loadId)) {
          return;
        }
        updateAbortController = new AbortController();
        const isCurrentFn = () => isCurrent(loadId);
        const result = await updateLocalProject(isCurrentFn, updateAbortController.signal);
        updateAbortController = null;
        if (!isCurrent(loadId)) {
          if (result && result.outcome === 'CANCELLED') {
            state.versionCheckPending = true;
          }
          return;
        }
        if (result.outcome === 'CANCELLED') {
          state.versionCheckPending = true;
          return;
        }
        if (result.outcome === 'DECLINED' || result.outcome === 'UP_TO_DATE') {
          state.versionCheckPending = false;
          return;
        }
        if (result.outcome === 'UPDATE_FAILED') {
          state.versionCheckPending = false;
          state.pendingRequest = null;
          return;
        }
        state.versionCheckPending = false;
        const reloadLoader = await showOwnedLoader(loadId);
        const reloadData = await fetchListData(state.projectRef);
        if (!isCurrent(loadId)) {
          return;
        }
        commitResult(reloadData);
        if (isCurrent(loadId)) {
          state.isFetching = false;
        }
        await hideOwnedLoader(loadId, reloadLoader, PARAMETERS.DELAY_LONG);
      } catch (error) {
        if (!isCurrent(loadId)) {
          return;
        }
        state.isFetching = false;
        try {
          await notificationService.hideProgressDialog(0);
        } catch (hideError) {
          console.log('hide loader on error failed: ' + hideError);
        }
        state.showResolved = false;
        if (error && (error.code === 'PROJECT_MISSING' || error.code === 'PROJECT_MISMATCH' || error.code === 'NO_FORMS')) {
          await notificationService.showAlert(STRINGS[language].labels.error);
          if (!projectModel.hasInitialised()) {
            router.replace({
              name: PARAMETERS.ROUTES.PROJECTS,
              query: {refresh: true}
            });
          }
        } else {
          await notificationService.showAlert(STRINGS[language].labels.error);
        }
        state.pendingRequest = null;
      } finally {
        if (isCurrent(loadId)) {
          state.isLoading = false;
          const next = state.pendingRequest;
          state.pendingRequest = null;
          if (next && !state.leaving) {
            await runLoad(next);
          }
        } else if (state.loadToken === loadId) {
          state.isLoading = false;
        } else {
          const next = !state.leaving ? state.pendingRequest : null;
          if (!state.leaving && next && state.loadToken > loadId) {
            state.isLoading = false;
            state.pendingRequest = null;
            await runLoad(next);
          } else if (state.loadToken === loadId) {
            state.isLoading = false;
          }
        }
        if (state.loadToken === loadId && state.leaving) {
          state.isLoading = false;
        }
      }
    }

    function requestLoad(options) {
      if (state.isLoading) {
        state.pendingRequest = options || {};
        return;
      }
      runLoad(options || {});
    }

    async function beginLeave() {
      state.leaving = true;
      state.loadToken = state.loadToken + 1;
      state.loaderSeq = state.loaderSeq + 1;
      state.pendingRequest = null;
      if (updateAbortController) {
        try {
          updateAbortController.abort();
        } catch (abortError) {
          console.log('abort failed: ' + abortError);
        }
        updateAbortController = null;
      }
      if (state.showResolved) {
        try {
          await notificationService.hideProgressDialog(0);
        } catch (hideError) {
          console.log('hide loader on leave failed: ' + hideError);
        }
        state.showResolved = false;
      }
      rootStore.continueProjectVersionUpdate = false;
    }

    onMounted(async () => {
      console.log('Component Entries is mounted!');
      state.leaving = false;
      await requestLoad({});
    });

    onIonViewWillEnter(() => {
      state.leaving = false;
      if (state.isLoading) {
        state.pendingRequest = { skipVersionCheck: !state.versionCheckPending };
        return;
      }
      if (state.loadToken === 0) {
        return;
      }
      requestLoad({ skipVersionCheck: !state.versionCheckPending });
    });

    onIonViewWillLeave(async () => {
      await beginLeave();
    });

    const methods = {
      openRightDrawer() {
        menuController.open('right-drawer');
      },
      goBack() {
        beginLeave();
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
        beginLeave();
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
        rootStore.continueProjectVersionUpdate = false;
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
        rootStore.continueProjectVersionUpdate = false;

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
      applyFilters(params) {
        if (!utilsService.objectsMatch(state.filters, params.filters)) {
          state.isFetching = true;
          state.filters = params.filters;

          console.log('countNoFilters', state.countNoFilters);
          requestLoad({ skipVersionCheck: true });
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
          rootStore.continueProjectVersionUpdate = false;
          if (changes[0].refreshEntries === 'true' && !state.leaving) {
            state.isFetching = true;
            await utilsService.delay(PARAMETERS.DELAY_LONG);
            if (state.leaving) {
              return;
            }
            state.formRef = rootStore.routeParams.formRef;
            state.projectRef = rootStore.routeParams.projectRef
                ? rootStore.routeParams.projectRef
                : projectModel.getProjectRef();
            state.filters = {...PARAMETERS.FILTERS_DEFAULT};
            await requestLoad({ skipVersionCheck: true });
          }
        }
    );

    provide('entriesState', state);

    useBackButton(10, () => {
      console.log(window.history);
      console.log('useBackButton Entries');
      if (rootStore.isExportModalActive || rootStore.isProjectUpdating || rootStore.isProjectUpdateModalActive) {
        return false;
      }
      rootStore.continueProjectVersionUpdate = false;

      if (!(state.isAddingFakeEntries || state.isFetching)) {
        methods.goBack();
      }
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
