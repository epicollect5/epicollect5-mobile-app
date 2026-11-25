import {createApp} from 'vue';
import {createPinia} from 'pinia';
import {PiniaLogger} from 'pinia-logger';
import App from '@/App.vue';
import router from '@/router';
import * as IonComponents from '@ionic/vue';
import {IonicVue} from '@ionic/vue';
import {SplashScreen} from '@capacitor/splash-screen';
import {bootPWA} from '@/use/entry/boot-pwa';
import {bootNative} from '@/use/entry/boot-native';
import {initService} from '@/services/init-service';
import {rollbarService} from '@/services/utilities/rollbar-service';
import {useRootStore} from '@/stores/root-store';
import {PARAMETERS} from '@/config';

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
import '@/theme/dark.scss';
import '@/theme/animate.min.css';
import '@/theme/core.scss';
import '@/theme/zoom.scss';

import BaseLayout from '@/components/globals/BaseLayout.vue';
import LeftDrawer from '@/components/globals/LeftDrawer.vue';
import RightDrawer from '@/components/globals/RightDrawer.vue';
import ListAnswers from '@/components/lists/ListAnswers.vue';
import ListItemAnswer from '@/components/lists/ListItemAnswer.vue';
//import '@/registerServiceWorker';

// Override console.info to use bold blue
const originalInfo = console.info;
console.info = function (...args) {
    originalInfo.apply(console, [
        '%c' + args.join(' '),
        'color: blue; font-weight: bold;'
    ]);
};

const pinia = createPinia();
pinia.use(PiniaLogger({
    expanded: true,
    disabled: import.meta.env.PROD
}));


export const app = createApp(App)
    .use(IonicVue, {
        innerHTMLTemplatesEnabled: true,
        hardwareBackButton: true,
        mode: 'md'
    })
    .use(router)
    .use(pinia);

//wrap with IIFE to use top level await t.ly/Nhzb
(async function () {

    const rootStore = useRootStore();
    //register all Ionic components globally
    Object.keys(IonComponents).forEach((key) => {
        if (/^Ion[A-Z]\w+$/.test(key)) {
            app.component(key, IonComponents[key]);
        }
    });

    //register global components (any platform)
    app.component('base-layout', BaseLayout);
    //global components for mobile app
    //loaded for pwa as well since they are referenced
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

    //reporting starts off: bootPWA applies the stored error reporting consent
    //(without a stored answer the consent toast keeps it off), while a native
    //boot failure must not submit before the collectErrors preference is read
    //(it lives in the settings table, so it cannot be read until the DB is
    //open) — bootNative holds its failures and flushes them once it is known
    rollbarService.configure({ enabled: false });

    //boot the platform, then mount. Only a native openDB failure aborts the
    //boot (bootNative returns false): the splash stays up instead of a dead UI
    const booted = rootStore.isPWA ? await bootPWA() : await bootNative();
    if (booted === false) {
        return;
    }

    //mount app
    router.isReady().then(async () => {
        //init error reporting
        rollbarService.init(app);
        console.log('Mounting app');
        app.mount('#app');

        if (!rootStore.isPWA) {
            setTimeout(async () => {
                    await SplashScreen.hide();
                }, PARAMETERS.DELAY_LONG
            );
        }
    });
}());
