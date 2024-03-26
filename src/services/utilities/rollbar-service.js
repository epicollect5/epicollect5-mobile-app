import Rollbar from 'rollbar';
import { Capacitor } from '@capacitor/core';
import { useRootStore } from '@/stores/root-store';

//https://docs.rollbar.com/docs/rollbarjs-configuration-reference
const rollbar = new Rollbar({
    enabled: true,
    accessToken: process.env.VUE_APP_ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
    reportLevel: 'error',
    captureIp: false,
    itemsPerMinute: 1,
    timeout: 3000,
    maxRetries: 3,
    payload: {
        environment: 'production',
        source_map_enabled: true,
        guess_uncaught_frames: true,
        client: {
            javascript: {
                code_version: '6.0.1'
            }
        }
    },
    //this is to tackle iOS where the file location will be a dynamic hash
    //see https://chris-hand.medium.com/ionic-and-rollbar-the-perfect-pair-5e0e711bcbab
    transform: function (payload) {
        if (payload && payload.body && payload.body.trace && payload.body.trace.frames) {
            const frames = payload.body.trace.frames;
            for (let i = 0; i < frames.length; i++) {
                if (frames[i].filename.indexOf('app.js') > -1) {
                    payload.body.trace.frames[i].filename = 'file://app.js';
                }
            }
        }
    }
}
);

export const rollbarService = {
    //imp: edited to avoid memory leaks
    //imp: see https://github.com/rollbar/rollbar.js/issues/1126
    install(app) {
        app.config.errorHandler = (error, vm, info) => {
            rollbar.error(error, { info });
            if (app.config.devtools) {
                console.error(error);
            }
        };

        app.config.warnHandler = (msg) => {
            console.warn(msg);
        };

        app.provide('rollbar', rollbar);
    },
    critical(error) {
        rollbar.critical(error);
    },
    configure(params) {
        rollbar.configure(params);
    },
    init(app) {
        const rootStore = useRootStore();

        //set rollbar version for payloads
        // For example, to change the environment:
        const transformer = function (payload) {
            payload.client = {
                javascript: {
                    code_version: rootStore.app.version
                }
            };
        };
        rollbar.configure({ transform: transformer });

        if (!Capacitor.DEBUG && Capacitor.isNativePlatform()) {
            //if user did not opt out, inject rollbar in release builds
            if (rootStore.collectErrors) {
                console.log('Rollbar reporting enabled');
                app.use(rollbar);
            }
            else {
                console.log('Rollbar reporting disabled');
                rollbar.configure({ enabled: false });
            }
        }
        else {
            console.log('Rollbar reporting disabled');
            rollbar.configure({ enabled: false });
        }
    }
};