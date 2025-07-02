<template>
  <ion-app>
    <left-drawer v-if="needsDrawers"></left-drawer>
    <right-drawer v-if="needsDrawers"></right-drawer>
    <ion-router-outlet id="main"/>
  </ion-app>
</template>

<script>
import {STRINGS} from '@/config/strings';
import {IonApp, IonRouterOutlet} from '@ionic/vue';
import {useRootStore} from '@/stores/root-store';
import {useRouter} from 'vue-router';
import {computed, reactive} from '@vue/reactivity';
import {PARAMETERS} from '@/config';
import {onMounted} from 'vue';
import {App as CapacitorApp} from '@capacitor/app'; // Alias the Capacitor App module as CapacitorApp
import {addProject} from '@/use/add-project';
import {utilsService} from '@/services/utilities/utils-service';
import {webService} from '@/services/web-service';
import {SplashScreen} from '@capacitor/splash-screen';
import {notificationService} from '@/services/notification-service';
import {errorsService} from '@/services/errors-service';

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
      })
    };



    // noinspection JSDeprecatedSymbols
    CapacitorApp.addListener('appUrlOpen', async (data) => {

      await notificationService.showProgressDialog(
          STRINGS[rootStore.language].labels.wait,
          STRINGS[rootStore.language].labels.loading_project
      );

      //Send app to add project page to re-use everything
      //like we are adding a project manually
      router.replace({
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
        router.replace({
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
