import { createRouter, createWebHistory } from '@ionic/vue-router';
import Projects from '@/pages/Projects';
import NotFound from '@/pages/NotFound.vue';
import { PARAMETERS } from '@/config';

let routes = [];
//routes for PWA
if (process.env.VUE_APP_MODE.toLowerCase() === PARAMETERS.PWA.toLowerCase()) {
  routes = [
    {
      path: '/',
      component: NotFound,
      name: PARAMETERS.ROUTES.NOT_FOUND
    },
    {
      path: '/project/:project_slug/add-entry',
      component: () => import('@/pages/EntriesAdd.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_ADD
    },
    {
      path: '/project/:project_slug/add-entry/branch',
      component: () => import('@/pages/EntriesAdd.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
    },
    {
      path: '/:pathMatch(.*)*',
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
      path: '/projects/add',
      component: () => import('@/pages/ProjectsAdd.vue'),
      name: PARAMETERS.ROUTES.PROJECTS_ADD
    },
    {
      path: '/projects/entries',
      component: () => import('@/pages/Entries.vue'),
      name: PARAMETERS.ROUTES.ENTRIES
    },
    {
      path: '/projects/entries/add',
      component: () => import('@/pages/EntriesAdd.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_ADD
    },
    {
      path: '/projects/entries/errors',
      component: () => import('@/pages/EntriesErrors.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_ERRORS
    },
    {
      path: '/projects/entries/add/branch',
      component: () => import('@/pages/EntriesAdd.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_BRANCH_ADD
    },
    {
      path: '/projects/entries/view',
      component: () => import('@/pages/EntriesView.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_VIEW
    },
    {
      path: '/projects/entries/view/branch',
      component: () => import('@/pages/EntriesViewBranch.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_VIEW_BRANCH
    },
    {
      path: '/projects/entries/upload',
      component: () => import('@/pages/EntriesUpload.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_UPLOAD
    },
    {
      path: '/settings',
      component: () => import('@/pages/Settings.vue'),
      name: PARAMETERS.ROUTES.SETTINGS
    },
    {
      path: '/projects/entries/download',
      component: () => import('@/pages/EntriesDownload.vue'),
      name: PARAMETERS.ROUTES.ENTRIES_DOWNLOAD
    }

  ];
}

console.log(routes);

const router = createRouter({
  /** imp: across the app we always use router.replace()
   *  imp: as apparently that makes the back button (Android)
   * imp: consistent and mirrors the UI navigation
   * 
   * imp: using a mix of push() and replace() was just messing up
   * imp: the back button navigation
   */
  history: createWebHistory(process.env.BASE_URL),
  scrollBehavior () {
    return { x: 0, y: 0 };
  },
  routes
});
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

export default router;
