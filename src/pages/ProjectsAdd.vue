<template>
  <base-layout title="">

    <template #actions-start>
      <ion-menu-button></ion-menu-button>
    </template>

    <template #actions-end>
      <ion-button
          class="ion-text-nowrap"
          fill="clear"
          @click="openFilePicker()"
      >
        <ion-icon
            slot="start"
            :icon="folderOpenOutline"
        ></ion-icon>
        {{ labels.import }}
        &nbsp;<sup><small>BETA</small></sup>
      </ion-button>
    </template>

    <template #subheader>
      <ion-toolbar
          color="dark"
          mode="md"
      >
        <ion-buttons slot="start">
          <ion-button @click="goToProjectsList()">
            <ion-icon
                slot="start"
                :icon="chevronBackOutline"
            >
            </ion-icon>
            {{ labels.projects }}
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </template>

    <template #content>
      <ion-searchbar
          animated
          debounce="500"
          :placeholder="searchForProjectPlaceholder"
          @ionInput="fetchProjects"
      ></ion-searchbar>

      <div
          v-if="state.isFetching"
          class="ion-text-center ion-margin"
      >
        <ion-spinner
            class="spinner-fetch-projects "
            name="crescent"
        ></ion-spinner>
      </div>

      <div
          v-else
          class="animate__animated animate__fadeIn"
      >
        <div
            v-show="!state.isFetching && state.projects.length > 0"
            class="projects-list"
        >
          <ion-list lines="none">
            <list-item-projects
                :projects="state.projects"
                page="add-project"
                @project-selected="onProjectSelected"
            ></list-item-projects>
          </ion-list>
        </div>
        <div v-show="!state.isFetching && state.projects.length === 0 && state.searchTerm !== ''">
          <ion-card class="ion-text-center animate__animated animate__fadeIn">
            <ion-card-header>
              <ion-card-title>{{ labels.no_projects_found }}</ion-card-title>
            </ion-card-header>
          </ion-card>
        </div>
      </div>
    </template>
  </base-layout>
</template>

<script>
import ListItemProjects from '@/components/ListItemProjects';
import {chevronBackOutline, folderOpenOutline} from 'ionicons/icons';
import {PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {useRootStore} from '@/stores/root-store';
import {useRouter} from 'vue-router';
import {addProject} from '@/use/project/add-project';
import {fetchServerProjects} from '@/use/project/fetch-server-projects';
import {notificationService} from '@/services/notification-service';
import {utilsService} from '@/services/utilities/utils-service';
import {errorsService} from '@/services/errors-service';
import {useBackButton} from '@ionic/vue';
import {reactive, readonly, computed} from 'vue';
import {FilePicker} from '@capawesome/capacitor-file-picker';
import {importProject} from '@/use/project/import-project';


export default {
  components: {
    ListItemProjects
  },
  setup() {
    const rootStore = useRootStore();
    const router = useRouter();
    const state = reactive({
      isFetching: false,
      projects: [],
      searchTerm: ''
    });

    const computedScope = {
      searchForProjectPlaceholder: computed(() => {
        return STRINGS[rootStore.language].labels.search_for_project;
      })
    };


    const methods = {
      //redirect to projects list
      goToProjectsList() {
        router.replace({
          name: PARAMETERS.ROUTES.PROJECTS
        });
      },
      onProjectSelected(project) {
        addProject(project, router);
      },
      async openFilePicker() {
        try {
          const result = await FilePicker.pickFiles({
            // "application/json" is the standard for .json files
            types: ['application/json'],
            multiple: false,
            readData: true// Set to true if you want the file content (base64)
          });

          const file = result.files[0];

          if (file && file.data) {
            // Decode base64 to UTF-8 string properly
            const binaryString = atob(file.data);
            const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0));
            const decodedData = new TextDecoder('utf-8').decode(bytes);
            const jsonData = JSON.parse(decodedData);

            console.log('Parsed JSON:', jsonData);

            await importProject(jsonData, router);
          }
        } catch (e) {
          // FilePicker throws when user cancels - this is expected
          if (e?.message?.toLowerCase().includes('cancel') || e?.code === 'RESULT_CANCELED') {
            console.log('User cancelled file picker');
          } else {
            console.error('File import error:', e);
            await notificationService.showAlert(
                STRINGS[rootStore.language].status_codes.ec5_103 || 'Failed to read file'
            );
          }
        }
      },
      async fetchProjects(e) {
        state.searchTerm = e.target.value.trimStart();

        //search string too short, bail out
        if (state.searchTerm.length < 3) {
          return false;
        }
        //no internet connection, bail out
        const hasInternetConnection = await utilsService.hasInternetConnection();
        if (!hasInternetConnection) {
          await notificationService.showAlert(
              STRINGS[rootStore.language].status_codes.ec5_135 + '!',
              STRINGS[rootStore.language].labels.error
          );
          return false;
        }

        state.isFetching = true;
        fetchServerProjects(readonly(state.searchTerm)).then(
            (projects) => {
              if (projects.length > 0) {
                state.projects = projects;
              } else {
                state.projects = [];
              }
              state.isFetching = false;
            },
            (error) => {
              errorsService.handleWebError(error);
              // No projects?
              try {
                if (error?.data === null) {
                  // Show no projects found message
                  state.projects = [];
                }
              } catch (error) {
                console.log(error);
                state.projects = [];
              }
              state.isFetching = false;
            }
        );
      }
    };

    //back to projects list with back button (Android)
    useBackButton(10, () => {
      console.log(window.history);
      if (!state.isFetching) {
        methods.goToProjectsList();
      }
    });

    return {
      labels: STRINGS[rootStore.language].labels,
      ...methods,
      ...computedScope,
      state,
      chevronBackOutline,
      folderOpenOutline
    };
  }
};
</script>

<style lang="scss" scoped></style>
