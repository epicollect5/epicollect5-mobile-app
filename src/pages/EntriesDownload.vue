<template>
  <base-layout :title="state.projectName">

    <template #actions-start>
      <ion-menu-button></ion-menu-button>
    </template>

    <template #actions-end>
      <!-- imp: Added only as spacers to center project name -->
      <ion-button disabled>
        <ion-icon>
        </ion-icon>
      </ion-button>
      <!-- imp: End spacers ----------------------------------->
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
      </ion-toolbar>
    </template>

    <template #content>
      <ion-list>
        <ion-item
            v-for="form in state.forms"
            :key="form.ref"
            lines="none"
        >
          <div class="center-item-content-wrapper">
            <ion-button
                @click="downloadEntries(form.formRef)"
                :disabled="isDownloadDisabled(form.formRef)"
                size="default"
                color="secondary"
                expand="block"
            >
              <ion-icon
                  slot="start"
                  :icon="documentText"
              ></ion-icon>
              &nbsp;{{ form.name }}
            </ion-button>
            <ion-grid class="download-progress-grid">
              <ion-row>
                <ion-col size="6">
									<span class="download-progress-value">
                    <ion-icon
                        slot="start"
                        :icon="desktopOutline"
                    ></ion-icon>
                    &nbsp;
                    {{getDownloadProgressLabel(form.formRef) }}
									</span>
                </ion-col>
                <ion-col
                    size="6"
                    class="download-progress-action"
                >
                  <ion-button
                      @click="clearDownloadProgress(form.formRef)"
                      :disabled="state.isFetching || !hasDownloadProgress(form.formRef)"
                      size="small"
                      fill="clear"
                      color="tertiary"
                  >
                    {{ labels.clear_download_progress }}
                  </ion-button>
                </ion-col>
              </ion-row>
            </ion-grid>
          </div>
        </ion-item>
      </ion-list>

    </template>
  </base-layout>
</template>

<script>
import {chevronBackOutline, documentText, desktopOutline} from 'ionicons/icons';
import {reactive} from '@vue/reactivity';
import {STRINGS} from '@/config/strings';

import {useRootStore} from '@/stores/root-store';
import {useRouter} from 'vue-router';
import {projectModel} from '@/models/project-model.js';
import {PARAMETERS} from '@/config';
import {onIonViewWillEnter, onIonViewWillLeave, useBackButton} from '@ionic/vue';
import {utilsService} from '@/services/utilities/utils-service';
import {entriesDownloadService} from '@/services/entries-download-service';

export default {
  setup() {
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;
    const router = useRouter();
    const state = reactive({
      projectName: '',
      forms: [],
      errors: false,
      completed: false,
      noEntriesFound: false,
      enabledButtons: [],
      entriesDownloaded: [],
      resumeAvailable: {},
      showWarning: true,
      wasAttemptedDownload: false,
      isFetching: false,
      promptOpen: false,
      downloadCache: {}
    });

    //get markup to show project logo in page header
    state.projectName = utilsService.getProjectNameMarkup();

    // Get all the forms (in order) for the form download buttons
    function _getFormButtons() {
      const orderedForms = projectModel.getFormsInOrder();

      orderedForms.forEach((form, formIndex) => {
        // Only enable the first form button initially
        if (formIndex === 0) {
          state.enabledButtons[form.formRef] = true;
        }
        state.forms.push(form);
      });
    }

    const entriesDownloader = entriesDownloadService.initDownloader({
      state,
      rootStore,
      labels,
      language,
      projectModel
    });

    const methods = {
      hasDownloadProgress(formRef) {
        return entriesDownloader.hasDownloadProgress(formRef);
      },
      getDownloadProgressLabel(formRef) {
        return entriesDownloader.getDownloadProgressLabel(formRef);
      },
      isDownloadDisabled(formRef) {
        return !state.enabledButtons[formRef] || state.entriesDownloaded[formRef] || state.noEntriesFound || state.completed;
      },
      async clearDownloadProgress(formRef) {
        await entriesDownloader.clearDownloadProgress(formRef);
      },
      goBack() {
        const currentRouteName = router.currentRoute.value.name;
        if (!state.wasAttemptedDownload) {
          //if next route not specified or itself, default back to entries
          if (rootStore.nextRoute === null || rootStore.nextRoute === currentRouteName) {
            router.replace({
              name: PARAMETERS.ROUTES.ENTRIES,
              query: {
                refreshEntries: true,
                timestamp: Date.now()
              }
            });
          } else {
            router.replace({
              name: rootStore.nextRoute,
              query: {...rootStore.routeParams}
            });
          }
        } else {
          router.replace({
            name: PARAMETERS.ROUTES.ENTRIES,
            query: {
              refreshEntries: true,
              timestamp: Date.now()
            }
          });
        }
      },
      async downloadEntries(formRef, shouldResume = false) {
        await entriesDownloader.downloadEntries(formRef, shouldResume);
      }
    };

    _getFormButtons();

    onIonViewWillEnter(() => {
      entriesDownloader.resetDownloadButtonState();
      entriesDownloader.syncResumeAvailabilityForForms();
    });

    onIonViewWillLeave(() => {
      entriesDownloader.clearDownloadCache();
    });

    //back with back button (Android)
    useBackButton(10, () => {
      console.log(window.history);
      if (!state.isFetching) {
        methods.goBack();
      }
    });

    return {
      labels,
      ...methods,
      state,
      //icons
      chevronBackOutline,
      desktopOutline,
      documentText
    };
  }
};
</script>

<style src="@/theme/pages/EntriesDownload.scss" lang="scss"></style>
