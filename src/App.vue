<template>
  <ion-app>
    <left-drawer v-if="needsDrawers"></left-drawer>
    <right-drawer v-if="needsDrawers" :key="projectRef"></right-drawer>
    <ion-router-outlet id="main"/>
  </ion-app>
</template>

<script>
import {STRINGS} from '@/config/strings';
import {IonApp, IonRouterOutlet} from '@ionic/vue';
import {useRootStore} from '@/stores/root-store';
import {useRouter} from 'vue-router';
import {PARAMETERS} from '@/config';
import {onMounted, computed} from 'vue';
import {App as CapacitorApp} from '@capacitor/app'; // Alias the Capacitor App module as CapacitorApp
import {addProject} from '@/composables/project/add-project';
import {importProject} from '@/composables/project/import-project';
import {utilsService} from '@/services/utilities/utils-service';
import {webService} from '@/services/web-service';
import {notificationService} from '@/services/notification-service';
import {errorsService} from '@/services/errors-service';
import {androidFileIntentService} from '@/services/android-file-intent-service';

export default {
  name: 'App',
  components: {
    IonApp,
    IonRouterOutlet
  },
  setup() {
    const rootStore = useRootStore();
    const router = useRouter();
    const computedScope = {
      needsDrawers: computed(() => {
        return rootStore.device.platform !== PARAMETERS.PWA;
      }),
      projectRef: computed(() => {
        return rootStore.routeParams.projectRef;
      })
    };



    // noinspection JSDeprecatedSymbols
    CapacitorApp.addListener('appUrlOpen', async (data) => {

      await notificationService.showProgressDialog(
          STRINGS[rootStore.language].labels.wait,
          STRINGS[rootStore.language].labels.loading_project
      );

      // Check if this is a JSON file intent from Android file manager
      if (androidFileIntentService.isJsonFileIntent(data.url, rootStore.device.platform)) {
        try {
          await router.replace({
            name: PARAMETERS.ROUTES.PROJECTS_ADD,
            query: {refresh: true}
          });

          // Extract and parse the JSON file
          const jsonData = await androidFileIntentService.extractJsonFromIntent(data.url);

          // Run the import flow with the JSON data
          await importProject(jsonData, router);
          return;
        } catch (error) {
          console.error('Failed to handle JSON file intent:', error);
          notificationService.hideProgressDialog();
          await notificationService.showAlert(STRINGS[rootStore.language].labels.invalid);
          await router.replace({
            name: PARAMETERS.ROUTES.PROJECTS,
            query: {refresh: true}
          });
          return;
        }
      }

      //Send app to add project page to re-use everything
      //like we are adding a project manually
      await router.replace({
        name: PARAMETERS.ROUTES.PROJECTS_ADD,
        query: {refresh: true}
      });

      console.log('App opened with URL:', data.url);

      // Create a new URL object
      const parsedUrl = new URL(data.url);
      const pattern = /^https:\/\/(five|dev)\.epicollect\.net\/open\/project\/[^/]+\/?$/;

      //check if the project url is a valid one
      if (pattern.test(data.url)) {

        // Get the pathname from the URL object
        const pathname = parsedUrl.pathname;
        // Split the pathname by '/'
        const parts = pathname.split('/');
        // Extract the last part
        const projectSlug = parts[parts.length - 1];

        if (projectSlug) {
          //get project name from slug
          const projectName = utilsService.inverseSlug(projectSlug);

          webService.searchForProject(projectName, true)
              .then((response) => {
                //if Project does not exist, error out
                if (response.data.data.length === 0) {
                  // Show 'Project does not exist' message
                  notificationService.showAlert(STRINGS[rootStore.language].status_codes.ec5_11);
                  //go back to projects list
                  router.replace({
                    name: PARAMETERS.ROUTES.PROJECTS,
                    query: {refresh: true}
                  });
                } else {
                  //we only have a single match since we passed the exact query parameter
                  const project = {
                    slug: response.data.data[0].project.slug,
                    name: response.data.data[0].project.name,
                    ref: response.data.data[0].project.ref
                  };
                  //try to load the project in
                  addProject(project, router);
                }
              }, (error) => {
                errorsService.handleWebError(error);
                // No projects?
                try {
                  if (error?.data === null) {
                    // Show no projects found message
                    notificationService.showAlert(STRINGS[rootStore.language].labels.no_projects_found);
                  }
                } catch (error) {
                  notificationService.showAlert(JSON.stringify(error), STRINGS[rootStore.language].labels.unknown_error);
                }

                //just launch app
                router.replace({
                  name: PARAMETERS.ROUTES.PROJECTS,
                  query: {refresh: true}
                });
              });
        }
      } else {
        //otherwise just project list
        await router.replace({
          name: PARAMETERS.ROUTES.PROJECTS,
          query: {refresh: true}
        });
      }
    });

    onMounted(async () => {
      console.log('App mounted');
      if (rootStore.isPWA && process.env.NODE_ENV === 'production') {
        //remove loader div (laravel servers only)
        document.querySelector('#loader.loader-placeholder').remove();
      }
    });

    return {
      ...computedScope
    };
  }
};
</script>
