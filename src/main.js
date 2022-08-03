import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { PiniaLogger } from 'pinia-logger';
import App from '@/App.vue';
import router from '@/router';

import { IonicVue } from '@ionic/vue';
import { SplashScreen } from '@capacitor/splash-screen';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

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
import { initService } from '@/services/init-service';
import { mediaDirsService } from '@/services/filesystem/media-dirs-service';
import { tempDirsService } from '@/services/filesystem/temp-dirs-service';
import { persistentDirsService } from '@/services/filesystem/persistent-dirs-service';
import { createDatabaseService } from '@/services/database/database-create-service';
import { bookmarksService } from '@/services/utilities/bookmarks-service';
import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import * as IonComponents from '@ionic/vue';

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
  const dbStore = useDBStore();
  const bookmarkStore = useBookmarkStore();
  //get device info
  const deviceInfo = await initService.getDeviceInfo();
  console.log('Platform: => ', deviceInfo.platform.toLocaleUpperCase());
  //make deviceInfo global
  rootStore.device = deviceInfo;

  const appInfo = await initService.getAppInfo();
  //make appInfo global
  rootStore.app = appInfo;

  //get device language
  const language = await initService.getLanguage();
  rootStore.language = language;
  console.log('Device language -> ', rootStore.language);

  //register global components
  app.component('base-layout', BaseLayout);
  app.component('left-drawer', LeftDrawer);
  app.component('right-drawer', RightDrawer);
  app.component('list-answers', ListAnswers);
  app.component('list-item-answer', ListItemAnswer);

  //custom directives
  app.directive('visible', {
    beforeMount (el, binding) {
      // el.style.visibility = binding.value ? 'visible' : 'hidden';
      el.style.backgroundColor = binding.value ? 'red' : 'blue';
    }
  });

  //register all Ionic components
  //imp: check performance hit of doing this
  Object.keys(IonComponents).forEach((key) => {
    if (/^Ion[A-Z]\w+$/.test(key)) {
      app.component(key, IonComponents[key]);
    }
  });

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
  if (deviceInfo.platform !== PARAMETERS.WEB) {
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

  //set bookmarks in pini store
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

  //are Google Services available?
  if (rootStore.device.platform === PARAMETERS.ANDROID) {
    rootStore.hasGoogleServices = await utilsService.hasGoogleServices();
    console.log('has Google Services?', rootStore.hasGoogleServices);
  }

  //mount app
  router.isReady().then(() => {
    app.mount('#app');

    setTimeout(async () => {
      await SplashScreen.hide();
    }, PARAMETERS.DELAY_EXTRA_LONG
    );
  });
}());