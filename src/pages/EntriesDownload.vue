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

    <template #footer>
      <div>
        <ion-card>
          <ion-card-content class="ion-text-center">
            <p><strong>{{labels.leaving_download_page_warning}}</strong></p>
            <ion-button color="warning" @click="openDownloadDocs()">
              <ion-icon
                  slot="start"
                  :icon="openOutline"
              ></ion-icon>
              {{labels.learn_more}}
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </template>
  </base-layout>
</template>

<script>
import {chevronBackOutline, documentText, desktopOutline, openOutline} from 'ionicons/icons';
import {reactive} from '@vue/reactivity';
import {STRINGS} from '@/config/strings';

import {useRootStore} from '@/stores/root-store';
import {useRouter} from 'vue-router';
import {projectModel} from '@/models/project-model.js';
import {PARAMETERS} from '@/config';
import {onIonViewWillEnter, onIonViewWillLeave, useBackButton} from '@ionic/vue';
import {utilsService} from '@/services/utilities/utils-service';
import {entriesDownloadService} from '@/services/entries-download-service';
import {notificationService} from '@/services/notification-service';

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
        return state.isFetching || state.promptOpen || !state.enabledButtons[formRef] || state.entriesDownloaded[formRef] || state.noEntriesFound || state.completed;
      },
      async clearDownloadProgress(formRef) {
        await entriesDownloader.clearDownloadProgress(formRef);
      },
      async goBack() {
        //Do not navigate while a download or prompt is in flight: leaving would
        //clear the progress cache while the download keeps writing it back
        if (state.isFetching || state.promptOpen) {
          return;
        }

        //Leaving clears any download progress: warn the user before navigating away
        const hasProgress = state.forms.some((form) => entriesDownloader.hasDownloadProgress(form.formRef));

        if (hasProgress) {
          const confirmed = await notificationService.confirmSingle(labels.leaving_download_clear_progress, labels.clear_download_progress);

          if (!confirmed) {
            return;
          }
        }

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
      },
      openDownloadDocs() {
        window.open(PARAMETERS.DOWNLOAD_ENTRIES_DOCS_URL, '_system', 'location=yes');
      }
    };

    _getFormButtons();

    onIonViewWillEnter(() => {
      //Entering the page clears any persisted download progress (also covers an app
      //killed while on this page), so the resume feature only works within this page
      //visit. Every re-entry starts a fresh download from a clean state.
      entriesDownloader.clearProjectDownloadCache();
      state.showWarning = true;
      entriesDownloader.resetDownloadButtonState();
      entriesDownloader.syncResumeAvailabilityForForms();
    });

    onIonViewWillLeave(() => {
      entriesDownloader.clearProjectDownloadCache();
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
      documentText,
      openOutline
    };
  }
};
</script>

<style src="@/theme/pages/EntriesDownload.scss" lang="scss"></style>
