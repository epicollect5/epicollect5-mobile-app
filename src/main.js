import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { PiniaLogger } from 'pinia-logger';
import App from '@/App.vue';
import router from '@/router';
import { Capacitor } from '@capacitor/core';
import { IonicVue } from '@ionic/vue';
import { SplashScreen } from '@capacitor/splash-screen';
import { projectModel } from '@/models/project-model.js';
import { setupPWAEntry } from '@/use/setup-pwa-entry';
import { STRINGS } from '@/config/strings';
import { commonValidate } from '@/services/validation/common-validate';
/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';
import { notificationService } from '@/services/notification-service';
import { utilsService } from '@/services/utilities/utils-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { initService } from '@/services/init-service';
import { webService } from '@/services/web-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme variables */
import '@/theme/variables.css';
import '@/theme/animate.min.css';
import '@/theme/core.scss';
import '@/theme/question.scss';
import '@/theme/modal.scss';
import '@/theme/popover.scss';
import '@/theme/zoom.scss';

import BaseLayout from '@/components/globals/BaseLayout.vue';
import LeftDrawer from '@/components/globals/LeftDrawer.vue';
import RightDrawer from '@/components/globals/RightDrawer.vue';
import ListAnswers from '@/components/ListAnswers.vue';
import ListItemAnswer from '@/components/ListItemAnswer.vue';
import { useRootStore } from '@/stores/root-store';
import { useDBStore } from '@/stores/db-store';
import { useBookmarkStore } from '@/stores/bookmark-store';
import { tempDirsService } from '@/services/filesystem/temp-dirs-service';
import { persistentDirsService } from '@/services/filesystem/persistent-dirs-service';
import { createDatabaseService } from '@/services/database/database-create-service';
import { PARAMETERS } from '@/config';
import * as IonComponents from '@ionic/vue';
//import '@/registerServiceWorker';

const pinia = createPinia();
pinia.use(PiniaLogger({
  expanded: true,
  disabled: process.env.NODE_ENV === 'production'
}));

export const app = createApp(App)
  .use(IonicVue, { hardwareBackButton: true, mode: 'md' })
  .use(router)
  .use(pinia);

//wrap with IIFE to use top level await t.ly/Nhzb
(async function () {

  const rootStore = useRootStore();
  //register all Ionic components globally
  //imp: check performance hit of doing this
  const keys = [
    'IonActionSheet',
    'IonAlert',
    'IonApp',
    'IonAvatar',
    'IonBackButton',
    'IonBackdrop',
    'IonBadge',
    'IonButton',
    'IonButtons',
    'IonCard',
    'IonCardContent',
    'IonCardHeader',
    'IonCardSubtitle',
    'IonCardTitle',
    'IonCheckbox',
    'IonChip',
    'IonCol',
    'IonContent',
    'IonDatetime',
    'IonFooter',
    'IonGrid',
    'IonHeader',
    'IonIcon',
    'IonImg',
    'IonInfiniteScroll',
    'IonInfiniteScrollContent',
    'IonInput',
    'IonItem',
    'IonItemDivider',
    'IonItemGroup',
    'IonItemOption',
    'IonItemOptions',
    'IonItemSliding',
    'IonLabel',
    'IonList',
    'IonListHeader',
    'IonLoading',
    'IonMenu',
    'IonMenuButton',
    'IonMenuToggle',
    'IonModal',
    'IonNav',
    'IonNavLink',
    'IonNote',
    'IonPage',
    'IonPicker',
    'IonPopover',
    'IonProgressBar',
    'IonRadio',
    'IonRadioGroup',
    'IonRange',
    'IonRefresher',
    'IonRefresherContent',
    'IonReorder',
    'IonReorderGroup',
    'IonRippleEffect',
    'IonRouterOutlet',
    'IonRow',
    'IonSearchbar',
    'IonSelect',
    'IonSelectOption',
    'IonSpinner',
    'IonSplitPane',
    'IonText',
    'IonTextarea',
    'IonThumbnail',
    'IonTitle',
    'IonToast',
    'IonToggle',
    'IonToolbar',
    'IonVirtualScroll'
  ];
  Object.keys(IonComponents).forEach((key) => {
    if (/^Ion[A-Z]\w+$/.test(key)) {
      //    if (keys.includes(key)) {
      app.component(key, IonComponents[key]);
      //  }
    }
  });

  //register global components (any platform)
  app.component('base-layout', BaseLayout);
  //global components for mobile app
  //loaded for pwa as well since thery are referenced
  app.component('left-drawer', LeftDrawer);
  app.component('right-drawer', RightDrawer);
  app.component('list-answers', ListAnswers);
  app.component('list-item-answer', ListItemAnswer);

  //get device info
  const deviceInfo = await initService.getDeviceInfo();
  console.log('Platform: => ', deviceInfo.platform.toLocaleUpperCase());
  //make deviceInfo global
  rootStore.device = deviceInfo;
  //detect if we are running a PWA or not
  rootStore.isPWA = (rootStore.device.platform === PARAMETERS.PWA);

  if (rootStore.isPWA) {

    const searchParams = new URLSearchParams(window.location.search);
    rootStore.searchParams = searchParams;
    const urlSegments = window.location.pathname.split('/');
    const acceptedSegments = [PARAMETERS.PWA_ADD_ENTRY, PARAMETERS.PWA_EDIT_ENTRY];
    const providedSegment = urlSegments.pop();
    if (!acceptedSegments.includes(providedSegment)) {
      rootStore.notFound = true;
    }

    rootStore.searchParams = searchParams;
    // Display the key/value pairs
    for (const [key, value] of searchParams.entries()) {
      console.log(`${key}, ${value}`);
    }

    //start PWA by getting the server URL for vue router and internal API requests
    if (process.env.NODE_ENV === 'production') {
      const url = new URL(window.location.href);
      rootStore.serverUrl = url.origin + utilsService.getBasepath();
    }
    else {
      const serverUrl = utilsService.stripTrailingSlash(process.env.VUE_APP_PWA_DEVELOPMENT_SERVER);
      rootStore.serverUrl = serverUrl;
    }
    console.log('Server URL -> ', rootStore.serverUrl);

    //set en as language (PWA can get translated by browser tools)
    rootStore.language = PARAMETERS.DEFAULT_LANGUAGE;
    //load language files for PWA
    await initService.getLanguagePWA();

    if (!rootStore.notFound) {
      const projectSlug = window.location.pathname.split('/').splice(-2, 1)[0];
      console.log({ path: window.location.pathname }, projectSlug);

      try {
        //get requested project and init PWA
        const response = await webService.getProjectPWA(projectSlug);
        projectModel.initialisePWA((response));

        // Set up a new entry or edit existing one
        let formRef = '';
        if (providedSegment === PARAMETERS.PWA_ADD_ENTRY) {
          try {
            formRef = await setupPWAEntry(PARAMETERS.PWA_ADD_ENTRY);
          }
          catch (error) {
            console.log(error);
            return false;
          }
        }
        else {
          //fetch existing entry (uuid must be provided)
          if (!rootStore.searchParams.has('uuid')) {
            rootStore.notFound = true;
          }
          const entryUuid = rootStore.searchParams.get('uuid');
          if (!commonValidate.isValidUuid(entryUuid)) {
            rootStore.notFound = true;
          }

          try {
            formRef = await setupPWAEntry(PARAMETERS.PWA_EDIT_ENTRY);
          }
          catch (error) {
            console.log(error);
            rootStore.notFound = true;
          }
        }

        //update route params BRANCH
        if (rootStore.searchParams.get('branch_ref') && rootStore.searchParams.get('branch_owner_uuid')) {
          console.log('should open branch');
          rootStore.routeParams = {
            formRef,
            inputRef: null,
            inputIndex: 0,
            isBranch: true,
            error: {}
          };
        }
        else {
          console.log('should open hierarchy');
          //update route params HIERARCHY
          rootStore.routeParams = {
            formRef,
            inputRef: null,
            inputIndex: 0,
            isBranch: false,
            error: {}
          };
        }
      }
      catch (error) {
        console.log(error);
        if (error) {
          notificationService
            .showAlert(error.statusText, error.status);
        }
        else {
          notificationService
            .showAlert(STRINGS[rootStore.language].labels.unknown_error);
        }
        rootStore.notFound = true;
      }
    }
  }
  else {
    //start mobile app
    const dbStore = useDBStore();
    const bookmarkStore = useBookmarkStore();
    const appInfo = await initService.getAppInfo();
    //make appInfo global
    rootStore.app = appInfo;

    //get device language
    const language = await initService.getLanguage();
    rootStore.language = language;
    console.log('Device language -> ', rootStore.language);

    //open db
    const db = await initService.openDB(deviceInfo.platform);
    //create db tables if needed
    await createDatabaseService.execute(db);
    //make db available globally
    dbStore.db = db;
    dbStore.dbVersion = await initService.getDBVersion();
    console.log('Database version ->  ', dbStore.dbVersion);

    //do migrations if needed
    const dbVersion = await initService.migrateDB();
    dbStore.dbVersion = dbVersion;
    console.log('Database version migrated to ->  ', dbStore.dbVersion);

    //create media dirs (only on devices)
    if (Capacitor.isNativePlatform()) {
      //imp: use createDirsLegacy() to match the legacy directories
      //imp: capacitor !== cordova filesystem, would break old apps updates
      //cordova -> https://github.com/apache/cordova-plugin-file
      //capacitor -> https://capacitorjs.com/docs/apis/filesystem#directory

      await mediaDirsService.createDirsLegacy();

      //get temp dirs path
      const tempDir = await tempDirsService.execute();
      rootStore.tempDir = tempDir;
      console.log('Device temp directory ->  ', rootStore.tempDir);

      //get persistent dirs path
      const persistentDir = await persistentDirsService.execute();
      rootStore.persistentDir = persistentDir;
      console.log('Device persistent directory ->  ', rootStore.persistentDir);
    }

    //set server URL
    const serverUrl = await initService.getServerUrl();
    rootStore.serverUrl = serverUrl;
    console.log('Server URL -> ', rootStore.serverUrl);

    //set bookmarks in pinia store
    const bookmarks = await bookmarksService.getBookmarks();
    bookmarkStore.setBookmarks(bookmarks);

    //clear temporary tables
    await initService.tidyTempTables();

    //get the user preferred entrie order
    const dbEntriesOrder = await initService.getEntriesOrder();
    if (dbEntriesOrder !== null) {
      dbStore.dbEntriesOrder = dbEntriesOrder;
    }

    //insert demo project to DB
    await initService.insertDemoProject();

    //text size preferences
    const selectedTextSize = await initService.getSelectedTextSize();
    rootStore.selectedTextSize = selectedTextSize;

    // filter entries preferences
    const filtersToggle = await initService.getFiltersToggleStatus();
    rootStore.filtersToggle = filtersToggle;

    // Attempt to retrieve the jwt token
    const user = await initService.retrieveJwtToken();
    rootStore.user = user;

    //are Google Services available?
    if (rootStore.device.platform === PARAMETERS.ANDROID) {
      rootStore.hasGoogleServices = await utilsService.hasGoogleServices();
      console.log('has Google Services?', rootStore.hasGoogleServices);
    }
  }

  /**
  * String.prototype.replaceAll() polyfill
  * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
  * @author Chris Ferdinandi
  * @license MIT
  */
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, newStr) {
      // If a regex pattern
      if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
        return this.replace(str, newStr);
      }
      // If a string
      return this.replace(new RegExp(str, 'g'), newStr);
    };
  }

  //mount app
  router.isReady().then(() => {

    console.log('mounting app');
    app.mount('#app');

    if (!rootStore.isPWA) {
      setTimeout(async () => {
        await SplashScreen.hide();
      }, PARAMETERS.DELAY_EXTRA_LONG
      );
    }
  });
}());