import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import ModalProgressTransfer from '@/components/modals/ModalProgressTransfer';
import {modalController} from '@ionic/vue';
import {showModalLogin} from '@/use/auth/show-modal-login';
import {notificationService} from '@/services/notification-service';
import {errorsService} from '@/services/errors-service';
import {downloadService} from '@/services/utilities/download-service';
import {entriesDownloadProgressService} from '@/services/utilities/entries-download-progress-service';
import {databaseDeleteService} from '@/services/database/database-delete-service';
import {databaseSelectService} from '@/services/database/database-select-service';
import {versioningService} from '@/services/utilities/versioning-service';
import {logout} from '@/use/auth/logout';

function initDownloader({state, rootStore, labels, language, projectModel}) {
  function resetDownloadButtonState() {
    state.completed = false;
    state.noEntriesFound = false;
    state.enabledButtons = [];
    state.entriesDownloaded = [];

    state.forms.forEach((form, formIndex) => {
      state.enabledButtons[form.formRef] = formIndex === 0;
      state.entriesDownloaded[form.formRef] = false;
    });
  }

  function persistFormDownloadCache(formRef) {
    try {
      entriesDownloadProgressService.save(projectModel.getProjectRef(), formRef, state.downloadCache[formRef]);
    } catch (error) {
      console.warn('Failed to persist entries download progress:', error);
    }
  }

  function loadFormDownloadCache(formRef) {
    return entriesDownloadProgressService.load(projectModel.getProjectRef(), formRef);
  }

  function getFormDownloadCache(formRef) {
    if (!state.downloadCache[formRef]) {
      state.downloadCache[formRef] = loadFormDownloadCache(formRef);
    }

    return state.downloadCache[formRef];
  }

  function syncResumeAvailability(formRef) {
    const formCache = getFormDownloadCache(formRef);
    state.resumeAvailable[formRef] = Object.keys(formCache.urls).length > 0;
  }

  function syncResumeAvailabilityForForms() {
    state.forms.forEach((form) => {
      syncResumeAvailability(form.formRef);
    });
  }

  function hasDownloadProgress(formRef) {
    const formCache = getFormDownloadCache(formRef);
    return Boolean(formCache.updatedAt || formCache.processedEntries || formCache.totalEntries || Object.keys(formCache.urls).length > 0);
  }

  function getDownloadProgressLabel(formRef) {
    if (!hasDownloadProgress(formRef)) {
      return '-/-';
    }

    const formCache = getFormDownloadCache(formRef);
    return `${formCache.processedEntries ?? 0}/${formCache.totalEntries ?? 0}`;
  }

  function rememberDownloadedUrl(formRef, currentUrl, nextUrl, progress) {
    if (!currentUrl) {
      return;
    }

    const formCache = getFormDownloadCache(formRef);
    formCache.startUrl = formCache.startUrl || currentUrl;
    formCache.urls[currentUrl] = nextUrl || null;
    formCache.totalEntries = progress?.totalEntries ?? formCache.totalEntries;
    formCache.processedEntries = progress?.processedEntries ?? formCache.processedEntries;
    formCache.updatedAt = Date.now();
    persistFormDownloadCache(formRef);
    syncResumeAvailability(formRef);
  }

  function updateStoredProgress(formRef, progress) {
    const formCache = getFormDownloadCache(formRef);
    formCache.totalEntries = progress?.totalEntries ?? formCache.totalEntries;
    formCache.processedEntries = progress?.processedEntries ?? formCache.processedEntries;
    formCache.updatedAt = Date.now();
    persistFormDownloadCache(formRef);
  }

  function clearFormDownloadCache(formRef) {
    delete state.downloadCache[formRef];
    entriesDownloadProgressService.clear(projectModel.getProjectRef(), formRef);
    state.resumeAvailable[formRef] = false;
  }

  function clearDownloadCache() {
    state.downloadCache = {};
  }

  function clearProjectDownloadCache() {
    clearDownloadCache();
    entriesDownloadProgressService.clearProject(projectModel.getProjectRef());
    state.forms.forEach((form) => {
      state.resumeAvailable[form.formRef] = false;
    });
  }

  async function clearDownloadProgress(formRef) {
    const confirmed = await notificationService.confirmSingle(labels.are_you_sure, labels.clear_download_progress);

    if (confirmed) {
      clearFormDownloadCache(formRef);
    }
  }

  async function checkProjectVersion() {
    let isUpToDate;
    try {
      isUpToDate = await versioningService.checkProjectVersion();
    } catch (error) {
      if (error?.data?.errors?.[0]?.code === 'ec5_11') {
        //Project has been trashed/deleted on the server: stop the download,
        //the remote entries are gone.
        await notificationService.showAlert(STRINGS[language].status_codes.ec5_11);
        return {shouldProceed: false, projectTrashed: true, projectUpdated: false};
      }

      throw error;
    }

    if (!isUpToDate) {
      const confirmed = await notificationService.confirmSingle(
        STRINGS[language].labels.update_project,
        STRINGS[language].labels.project_outdated
      );

      if (confirmed) {
        try {
          await notificationService.showProgressDialog(
            STRINGS[language].labels.wait,
            STRINGS[language].labels.updating_project
          );
          await versioningService.updateProject();
          await notificationService.hideProgressDialog(0);
          // Project changes invalidate cached page URLs and entry counts.
          clearProjectDownloadCache();
          return {shouldProceed: true, projectUpdated: true};
        } catch (error) {
          await notificationService.hideProgressDialog(0);
          await errorsService.handleWebError(error);
          return {shouldProceed: false, projectUpdated: false};
        }
      } else {
        return {shouldProceed: false, projectUpdated: false};
      }
    }

    return {shouldProceed: true, projectUpdated: false};
  }

  async function downloadEntries(formRef, shouldResume = false) {
    let downloadCancelled = false;

    async function showModalUploadProgress(progress = {total: 0, done: 0}) {
      rootStore.progressTransfer = progress;
      const modal = await modalController.create({
        cssClass: 'modal-progress-transfer',
        component: ModalProgressTransfer,
        showBackdrop: true,
        backdropDismiss: false,
        componentProps: {
          header: labels.downloading_entries,
          showCloseButton: true,
          onClose() {
            downloadCancelled = true;
          }
        }
      });

      return modal.present();
    }

    const handleProjectUpdated = async (message) => {
      state.forms = projectModel.getFormsInOrder();
      resetDownloadButtonState();
      await notificationService.showAlert(message, STRINGS[language].labels.project_outdated);
    };

    const beginDownload = async (resumeDownload = false) => {
      if (state.isFetching) {
        return;
      }

      state.isFetching = true;

      try {
        const versionCheck = await checkProjectVersion();
        if (versionCheck.projectTrashed) {
          //Alert already shown: the project was trashed on the server, do not
          //offer the download warning nor wipe any local entries.
          state.isFetching = false;
          return;
        }

        if (!versionCheck.shouldProceed) {
          state.showWarning = true;
          state.isFetching = false;
          return;
        }

        if (versionCheck.projectUpdated) {
          //Project structure changed: refresh the form buttons and clear all
          //download progress. Do not start a download automatically, the user
          //must start again from the first form button.
          await handleProjectUpdated(STRINGS[language].status_codes.ec5_137);
          state.isFetching = false;
          return;
        }

        state.wasAttemptedDownload = true;
        // A resumed download is only safe when the project structure did not change.
        await startDownload(resumeDownload);
      } catch (error) {
        state.isFetching = false;
        await errorsService.handleWebError(error);
      }
    };

    const startDownload = async (resumeDownload = false) => {
      const formCache = getFormDownloadCache(formRef);
      try {
        if (!resumeDownload) {
          const unsyncedCount = await databaseSelectService.countUnsyncedEntries(projectModel.getProjectRef());
          const unsyncedMediaCount = await databaseSelectService.countMediaUnsynced(projectModel.getProjectRef());
          const totalUnsynced = unsyncedCount.rows.item(0).total_number_of_entries_with_errors
              + unsyncedCount.rows.item(0).total_number_of_entries_unsynced
              + unsyncedCount.rows.item(0).total_number_of_incomplete_entries
              + unsyncedMediaCount.rows.item(0).total;
          if (totalUnsynced > 0) {
            await notificationService.showDismissAlert(
                labels.remote_entries_out_of_sync,
                labels.unsynced_entries,
                PARAMETERS.DOWNLOAD_ENTRIES_DOCS_URL
            );
            state.resumeAvailable[formRef] = false;
            return;
          }
          //A fresh download removes the remote entries of the selected form and of
          //every form that follows it in the project. Only the selected form is
          //re-downloaded now; the following forms are downloaded in turn, one at a
          //time, so an interrupted download can never leave orphaned children.
          //The download caches of the following forms are cleared as well: their rows
          //are gone, so any stale resume state would skip pages whose rows no longer
          //exist.
          const formsInOrder = projectModel.getFormsInOrder();
          const currentFormIndex = formsInOrder.findIndex((form) => form.formRef === formRef);
          const formRefs = formsInOrder.slice(currentFormIndex).map((form) => form.formRef);
          formRefs.slice(1).forEach((formRefToClear) => clearFormDownloadCache(formRefToClear));
          await databaseDeleteService.deleteEntriesBeforeDownload(projectModel.getProjectRef(), formRefs);
        }

        await showModalUploadProgress({
          total: resumeDownload ? formCache.totalEntries : 0,
          done: resumeDownload ? formCache.processedEntries : 0
        });

        const hasEntries = await downloadService.downloadFormEntries(formRef, {
          delayMs: 3 * PARAMETERS.DELAY_LONG,
          startUrl: resumeDownload ? formCache.startUrl : null,
          initialTotalEntries: resumeDownload ? formCache.totalEntries : 0,
          initialEntryNumber: resumeDownload ? formCache.processedEntries : 0,
          isCancelled() {
            return downloadCancelled;
          },
          //The project version is checked before each page download: if it changed
          //on the server mid-download, rows already inserted may not match the new
          //structure, so the download is aborted and the user is asked to restart.
          shouldAbort: async () => {
            const versionCheck = await checkProjectVersion();
            if (!versionCheck.shouldProceed || versionCheck.projectUpdated) {
              return {
                versionChanged: true,
                projectUpdated: versionCheck.projectUpdated,
                projectTrashed: versionCheck.projectTrashed
              };
            }
            return null;
          },
          shouldSkipUrl(url) {
            return Object.prototype.hasOwnProperty.call(formCache.urls, url);
          },
          getCachedNextUrl(url) {
            return formCache.urls[url] || null;
          },
          onProgress(progress) {
            updateStoredProgress(formRef, progress);
          },
          onPageDownloaded(currentUrl, nextUrl, progress) {
            rememberDownloadedUrl(formRef, currentUrl, nextUrl, progress);
          }
        });

        let code = 'ec5_143';

        modalController.dismiss();

        if (!hasEntries) {
          code = 'ec5_144';

          if (projectModel.getFirstFormRef() === formRef) {
            state.noEntriesFound = true;
          } else {
            state.completed = true;
          }
        } else {
          state.enabledButtons[projectModel.getNextFormRef(formRef)] = true;
          state.entriesDownloaded[formRef] = true;

          if (projectModel.getLastFormRef() === formRef) {
            state.completed = true;
          }
        }

        clearFormDownloadCache(formRef);
        notificationService.showToast(STRINGS[language].status_codes[code]);
      } catch (error) {
        const authErrors = PARAMETERS.AUTH_ERROR_CODES;

        modalController.dismiss();
        syncResumeAvailability(formRef);

        if (error?.cancelled) {
          return;
        }

        if (error?.projectTrashed) {
          //The project was trashed on the server mid-download: clear all
          //progress and stop. The alert was already shown by the version check.
          clearProjectDownloadCache();
          return;
        }

        if (error?.versionChanged) {
          //The project changed on the server while downloading: clear all progress
          //and invite the user to update the project and restart the download, as
          //the entries already downloaded might be invalid.
          clearProjectDownloadCache();
          await handleProjectUpdated(labels.download_interrupted_restart);
          return;
        }

        if (authErrors.indexOf(error?.data?.errors[0]?.code) >= 0) {
          if (error.data.errors[0].code !== 'ec5_78') {
            const confirmed = await notificationService.confirmSingle(
                STRINGS[rootStore.language].status_codes[error.data.errors[0].code]
            );

            if (confirmed) {
              await logout();
              showModalLogin();
            }
          }
        } else {
          await errorsService.handleWebError(error);
        }
      } finally {
        state.isFetching = false;
      }
    };

    const confirmDownloadWarning = async () => {
      const confirmed = await notificationService.confirmSingle(labels.download_warning, labels.download_remote_entries, PARAMETERS.DOWNLOAD_ENTRIES_DOCS_URL);

      if (confirmed) {
        state.showWarning = false;
      }

      return confirmed;
    };

    const handleResumePrompt = async () => {
      state.promptOpen = true;

      try {
        const action = await notificationService.confirmMultiple(
            labels.resume_last_download_message,
            labels.download_remote_entries,
            labels.resume_last_download,
            labels.restart_download,
            PARAMETERS.ACTIONS.DOWNLOAD_RESUME,
            PARAMETERS.ACTIONS.DOWNLOAD_RESTART
        );

        if (action === PARAMETERS.ACTIONS.DOWNLOAD_RESUME) {
          beginDownload(true);
        }

        if (action === PARAMETERS.ACTIONS.DOWNLOAD_RESTART) {
          if (state.showWarning) {
            const confirmed = await confirmDownloadWarning();

            if (!confirmed) {
              return;
            }
          }

          clearFormDownloadCache(formRef);
          beginDownload(false);
        }
      } finally {
        state.promptOpen = false;
      }
    };

    if (state.isFetching || state.promptOpen) {
      return;
    }

    if (!shouldResume && state.resumeAvailable[formRef]) {
      await handleResumePrompt();
      return;
    }

    if (state.showWarning && !shouldResume) {
      state.promptOpen = true;

      try {
        if (await confirmDownloadWarning()) {
          beginDownload(false);
        }
      } finally {
        state.promptOpen = false;
      }
    } else {
      beginDownload(shouldResume);
    }
  }

  return {
    resetDownloadButtonState,
    syncResumeAvailabilityForForms,
    hasDownloadProgress,
    getDownloadProgressLabel,
    clearDownloadProgress,
    clearDownloadCache,
    clearProjectDownloadCache,
    downloadEntries
  };
}

const entriesDownloadService = {
  initDownloader
};

export {entriesDownloadService};
