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
import {reactive} from '@vue/reactivity';
import {PARAMETERS} from '@/config';
import {projectModel} from '@/models/project-model.js';
import {branchEntryModel} from '@/models/branch-entry-model.js';
import {useRouter, useRoute} from 'vue-router';
import {watch} from 'vue';
import ListAnswers from '@/components/ListAnswers';
import {useBackButton} from '@ionic/vue';
import {databaseSelectService} from '@/services/database/database-select-service';
import {databaseDeleteService} from '@/services/database/database-delete-service';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {deleteFileService} from '@/services/filesystem/delete-file-service';
import {answerService} from '@/services/entry/answer-service';
import ItemDividerError from '@/components/ItemDividerError.vue';
import {cloneEntryBranch} from '@/use/clone-entry-branch';

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
        const confirmed = await notificationService.confirmSingle(
            STRINGS[language].status_codes.ec5_129,
            labels.delete_branch_entry + '?'
        );

        if (confirmed) {
          await databaseDeleteService.deleteBranchEntry(state.entryUuid);

          // Delete all the media related to this entry
          const mediaFiles = await databaseSelectService.selectProjectMedia({
            project_ref: projectModel.getProjectRef(),
            synced: null,
            entry_uuid: [state.entryUuid]
          });

          // If any media files
          const allMediaFiles = mediaFiles.audios
              .concat(mediaFiles.videos)
              .concat(mediaFiles.photos);

          if (allMediaFiles.length === 0) {
            // Go back
            notificationService.showToast(labels.entry_deleted);
            methods.goBack();
            return false;
          }

          try {
            await deleteFileService.removeFiles(allMediaFiles);
            //remove all related rows from media table
            await databaseDeleteService.deleteEntryMedia(state.entryUuid);
            //navigate back
            notificationService.showToast(labels.entry_deleted);
            methods.goBack();
          } catch (error) {
            console.log(error);
            //todo error deleting files, handle it
          }
        }
      },
      async cloneEntryBranch() {
        await cloneEntryBranch(
            state,
            router,
            rootStore,
            language,
            labels,
            methods.goBack
        );
      }
    };

    /*
     * View this entry answers
     */
    async function fetchBranchAnswers() {
      let data;
      let inputDetails;

      // Show loader
      await notificationService.showProgressDialog(labels.wait, labels.loading_entry);

      Promise.all([
        databaseSelectService.selectBranchEntry(state.entryUuid),
        databaseSelectService.selectEntryMediaErrors([state.entryUuid])
      ]).then((response) => {
        const res = response[0];
        const mediaRes = response[1];
        let mediaErrors = [];
        let mediaError;

        //grab media errors if any
        for (let index = 0; index < mediaRes.rows.length; index++) {
          mediaError = JSON.parse(mediaRes.rows.item(index).synced_error);
          //media error is an array of errors
          mediaError.errors.forEach((error) => {
            error.inputRef = mediaRes.rows.item(index).input_ref;
            mediaErrors = mediaErrors.concat(error);
          });
        }

        try {
          if (res.rows.length > 0) {
            // Initialize the entry model
            data = res.rows.item(res.rows.length - 1);
            state.entry.initialise(data);
            state.title = state.entry.title;
            state.synced = state.entry.synced;
          }
          state.errors = JSON.parse(data.synced_error);
          //add media errors (if any)
          state.errors.errors = state.errors.errors.concat(mediaErrors);
        } catch (e) {
          state.errors = {};
          //add media errors (if any)
          if (mediaErrors.length > 0) {
            state.errors.errors = mediaErrors;
          }
        }

        // Now loop round all inputs and display questions and answers
        Object.values(state.branchInputs).forEach((value, index) => {
          inputDetails = state.inputsExtra[value].data;

          // Check we have an answer for this question
          if (typeof state.entry.answers[inputDetails.ref] !== 'undefined') {
            // If the question wasn't jumped, add to items array
            if (!state.entry.answers[inputDetails.ref].was_jumped) {
              _addAnswerToItems(inputDetails, index);
            }
          }
        });

        // Hide loader
        notificationService.hideProgressDialog();
        state.isFetching = false;
      });
    }

    function _addAnswerToItems(inputDetails, index) {
      let error = '';
      let scopeError;
      let groupIndex;
      let group;
      let groupInputDetails;
      let answer = '';

      switch (inputDetails.type) {
        case PARAMETERS.QUESTION_TYPES.GROUP:
          // Loop round group inputs
          answer = {};
          // Add group answers to main group
          group = projectModel.getFormGroups(state.entry.formRef);
          for (groupIndex = 0; groupIndex < group[inputDetails.ref].length; groupIndex++) {
            groupInputDetails = state.inputsExtra[group[inputDetails.ref][groupIndex]].data;

            error = '';
            // Check for synced errors on group input
            if (state.errors.errors) {
              // Check if this input has an error
              for (scopeError in state.errors.errors) {
                if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
                  if (state.errors.errors[scopeError].source === groupInputDetails.ref) {
                    // Get translated error code or, if it doesn't exist, server translation from 'title'
                    error =
                        STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                        state.errors.errors[scopeError].title;
                  }

                  //get media errors for the group if any
                  if (
                      state.errors.errors[scopeError].code === 'ec5_231' &&
                      state.errors.errors[scopeError].inputRef
                  ) {
                    if (state.errors.errors[scopeError].inputRef === groupInputDetails.ref) {
                      error =
                          STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                          state.errors.errors[scopeError].title;
                    }
                  }
                }
              }
            }

            //filter out README type when the entry is remote as we do not have a remote answer for it
            if (
                !(
                    groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README &&
                    state.entry.isRemote === 1
                )
            ) {
              answer[groupInputDetails.ref] = {
                type: groupInputDetails.type,
                question:
                    groupInputDetails.type === PARAMETERS.QUESTION_TYPES.README
                        ? utilsService.htmlDecode(groupInputDetails.question)
                        : groupInputDetails.question,
                answer: _getAnswer(
                    groupInputDetails,
                    state.entry.answers[groupInputDetails.ref].answer
                ),
                synced_error: error
              };
            }
          }

          _renderErrors();
          _renderAnswers();
          break;
        case PARAMETERS.QUESTION_TYPES.BRANCH:
          // Get number of branches for this input
          //also find if there are media errors for this branch

          answer = _getAnswer(inputDetails, state.branches);

          //any media errors on branches?
          databaseSelectService
              .countCurrentBranchMediaErrors(inputDetails.ref)
              .then(function (response) {
                //set up generic branch error
                const branch_synced_error = {
                  errors: [
                    {
                      code: 'ec5_231',
                      title: STRINGS[language].entries_errors,
                      source: inputDetails.ref
                    }
                  ]
                };

                //set branch entry media error( to show bug icon next to branch input)
                state.branchesMediaErrors[inputDetails.ref] = response.rows.item(0).total > 0;

                //add generic media error so it appears at the top in the view
                if (state.branchesMediaErrors[inputDetails.ref]) {
                  if (Object.keys(state.errors).length === 0) {
                    state.errors = branch_synced_error;
                  } else {
                    state.errors.errors = state.errors.errors.concat(branch_synced_error);
                  }
                }
                _renderErrors();
                _renderAnswers();
              });
          break;
        default:
          // Default show answer
          answer = _getAnswer(inputDetails, state.entry.answers[inputDetails.ref].answer);
          _renderErrors();
          _renderAnswers();
      }

      //Get answer for viewing via the AnswerService

      function _getAnswer(inputDetails, answer) {
        return answerService.parseAnswerForViewing(inputDetails, answer);
      }

      function _renderErrors() {
        // Check for synced errors on main input
        if (state.errors.errors) {
          // Check if this input has an error
          for (scopeError in state.errors.errors) {
            if (Object.prototype.hasOwnProperty.call(state.errors.errors, scopeError)) {
              if (state.errors.errors[scopeError].source === inputDetails.ref) {
                // Get translated error code or, if it doesn't exist, server translation from 'title'
                error =
                    STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                    state.errors.errors[scopeError].title;
              }

              //show error on media question (input) if any
              if (state.errors.errors[scopeError].inputRef) {
                if (state.errors.errors[scopeError].inputRef === inputDetails.ref) {
                  // Get translated error code or, if it doesn't exist, server translation from 'title'
                  error =
                      STRINGS[language].status_codes[state.errors.errors[scopeError].code] ||
                      state.errors.errors[scopeError].title;
                }
              }
            }
          }
        }
      }

      function _renderAnswers() {
        state.items[inputDetails.ref] = {
          question:
              inputDetails.type === PARAMETERS.QUESTION_TYPES.README
                  ? utilsService.htmlDecode(inputDetails.question)
                  : inputDetails.question,
          answer: answer,
          possible_answers:
              inputDetails.possible_answers.length > 0 ? inputDetails.possible_answers : null,
          input_ref: inputDetails.ref,
          input_index: index,
          type: inputDetails.type,
          synced_error: error,
          can_edit: state.entry.canEdit
        };
      }

      //get markup to show project logo in page header
      state.projectName = utilsService.getProjectNameMarkup();

      const routeParams = rootStore.routeParams;
      console.log(routeParams);
    }

    fetchBranchAnswers();

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
              await fetchBranchAnswers();
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
