import { createRouter, createWebHistory } from '@ionic/vue-router';
import Projects from '@/pages/Projects';
import Profile from '@/pages/Profile';
import NotFound from '@/pages/NotFound.vue';
import { PARAMETERS } from '@/config';
import EntriesAdd from '@/pages/EntriesAdd.vue';
import ProjectsAdd from '@/pages/ProjectsAdd.vue';
import Entries from '@/pages/Entries.vue';
import EntriesErrors from '@/pages/EntriesErrors.vue';
import EntriesView from '@/pages/EntriesView.vue';
import EntriesViewBranch from '@/pages/EntriesViewBranch.vue';
import EntriesUpload from '@/pages/EntriesUpload.vue';
import Settings from '@/pages/Settings.vue';
import EntriesDownload from '@/pages/EntriesDownload.vue';
import { utilsService } from '@/services/utilities/utils-service';

let routes = [];
//routes for PWA
if (process.env.VUE_APP_MODE.toLowerCase() === PARAMETERS.PWA.toLowerCase()) {
  const basePath = utilsService.getBasepath();
  routes = [
    {
      path: basePath + '/',
      component: NotFound,
      name: PARAMETERS.ROUTES.NOT_FOUND
    },
    {
      path: basePath + '/project/:project_slug/add-entry',
      component: EntriesAdd,
      name: PARAMETERS.ROUTES.ENTRIES_ADD
    },
    {
      path: basePath + '/project/:project_slug/edit-entry',
      component: EntriesAdd,
      name: PARAMETERS.ROUTES.ENTRIES_EDIT
    },
    {
      path: basePath + '/project/:project_slug/add-entry/branch',
      component: EntriesAdd,
      name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
    },
    {
      path: basePath + '/:pathMatch(.*)*',
      redirect: { name: PARAMETERS.ROUTES.NOT_FOUND }
    }
  ];
}
else {
  //routes for mobile app
  routes = [
    {
      path: '/',
      redirect: {
        name: PARAMETERS.ROUTES.PROJECTS
      }
    },
    {
      path: '/projects',
      component: Projects,
      name: PARAMETERS.ROUTES.PROJECTS
    },
    {
      path: '/profile',
      component: Profile,
      name: PARAMETERS.ROUTES.PROFILE
    },
    {
      path: '/projects/add',
      component: ProjectsAdd,
      name: PARAMETERS.ROUTES.PROJECTS_ADD
    },
    {
      path: '/projects/entries',
      component: Entries,
      name: PARAMETERS.ROUTES.ENTRIES
    },
    {
      path: '/projects/entries/add',
      component: EntriesAdd,
      name: PARAMETERS.ROUTES.ENTRIES_ADD
    },
    {
      path: '/projects/entries/errors',
      component: EntriesErrors,
      name: PARAMETERS.ROUTES.ENTRIES_ERRORS
    },
    {
      path: '/projects/entries/add/branch',
      component: EntriesAdd,
      name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
    },
    {
      path: '/projects/entries/view',
      component: EntriesView,
      name: PARAMETERS.ROUTES.ENTRIES_VIEW
    },
    {
      path: '/projects/entries/view/branch',
      component: EntriesViewBranch,
      name: PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH
    },
    {
      path: '/projects/entries/upload',
      component: EntriesUpload,
      name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
    },
    {
      path: '/settings',
      component: Settings,
      name: PARAMETERS.ROUTES.SETTINGS
    },
    {
      path: '/projects/entries/download',
      component: EntriesDownload,
      name: PARAMETERS.ROUTES.ENTRIES_DOWNLOAD
    }
  ];
}

console.log(routes);
console.log({ base_url: process.env.BASE_URL });

const router = createRouter({
  /** imp: across the app we always use router.replace()
   *  imp: as apparently that makes the back button (Android)
   * imp: consistent and mirrors the UI navigation
   * 
   * imp: using a mix of push() and replace() was just messing up
   * imp: the back button navigation
   */

  //https://router.vuejs.org/api/index.html#createwebhashhistory
  //imp: passing a base url into createWebHistory() breaks the PWA
  //history: createWebHistory(process.env.BASE_URL),
  history: createWebHistory(),
  scrollBehavior () {
    return { x: 0, y: 0 };
  },
  routes
});
if (process.env.NODE_ENV !== 'production') {
  if (process.env.VUE_APP_MODE.toLowerCase() !== PARAMETERS.PWA.toLowerCase()) {
    router.beforeEach((to, from, next) => {
      //hack: on app page reloads (but not in PWA mode), always redirect to the projects page
      //hack: "from.name" would be undefined, and when the requested route
      //hack: is NOT / or /projects, it needs redirecting
      //hack: this is helpful when debugginh in the browser and using hot reload
      if (!from.name && to.name !== PARAMETERS.ROUTES.PROJECTS) {
        next({
          path: PARAMETERS.ROUTES.PROJECTS,
          replace: true
        });
      }
      else {
        next();
      }
    });
  }
}

export default router;
