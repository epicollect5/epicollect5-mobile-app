import Rollbar from 'rollbar';
import { Capacitor } from '@capacitor/core';
import { useRootStore } from '@/stores/root-store';

//https://docs.rollbar.com/docs/rollbarjs-configuration-reference
const rollbar = new Rollbar({
    enabled: true,
    accessToken: import.meta.env.VITE_ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
    reportLevel: 'error',
    captureIp: false,
    itemsPerMinute: 1,
    timeout: 3000,
    maxRetries: 3,
    payload: {
        environment: '',//to be set at run time,
        source_map_enabled: true,
        guess_uncaught_frames: true,
        client: {
            javascript: {
                code_version: ''//defined at run time, see init() below
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

//JSON.stringify throws on circular values, BigInt, or throwing toJSON: fall
//back so reporting itself never throws and hides the original failure.
//Functions are capped to a short tag (their source via String(fn) could bloat
//payloads past Rollbar limits)
function _safeStringify(value) {
    if (typeof value === 'function') {
        try {
            return '[Function ' + (value.name || 'anonymous') + ']';
        } catch (error) {
            return '[Function]';
        }
    }
    try {
        const result = JSON.stringify(value);
        return typeof result === 'string' ? result : String(value);
    } catch (error) {
        try {
            return String(value);
        } catch (ignored) {
            return '[unserializable]';
        }
    }
}

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
        try {
            const reportableError = error instanceof Error ? error : new Error(_safeStringify(error));
            rollbar.critical(reportableError);
        } catch (ignored) { /* fire-and-forget */ }
    },
    //Shared reporter for caught errors: fingerprints by operation context for
    //Rollbar grouping (the default fingerprint is stack frames + class, which
    //the message prefix alone cannot influence), preserves the original stack,
    //name and cause chain, and passes through diagnostic fields (code,
    //resizeContext, ...) via custom so they are not lost in the wrapper
    criticalWithContext(context, error) {
        try {
            let reportableError;
            const custom = { context };
            if (error instanceof Error) {
                reportableError = new Error(context + ': ' + error.message);
                reportableError.stack = error.stack;
                if (error.name && error.name !== 'Error') {
                    reportableError.name = error.name;
                }
                if (error.cause !== undefined) {
                    reportableError.cause = error.cause;
                }
                //own enumerable diagnostics ride in custom (never on the wrapper,
                //where Rollbar would ignore them): each read is guarded so a
                //throwing getter cannot break reporting
                try {
                    const keys = Object.keys(error);
                    for (const key of keys) {
                        if (key === 'message' || key === 'stack' || key === 'cause' || key === 'name') {
                            continue;
                        }
                        try {
                            custom[key] = error[key];
                        } catch (ignored) {
                            custom[key] = _safeStringify(error[key]);
                        }
                    }
                    if (typeof Object.getOwnPropertySymbols === 'function') {
                        const symbols = Object.getOwnPropertySymbols(error);
                        for (const sym of symbols) {
                            try {
                                if (Object.prototype.propertyIsEnumerable.call(error, sym)) {
                                    custom[sym.toString()] = error[sym];
                                }
                            } catch (ignored) {
                                continue;
                            }
                        }
                    }
                } catch (ignored) {
                    console.log('rollbar custom fields skipped: ' + ignored);
                }
            } else if (error && (typeof error === 'object' || typeof error === 'function')) {
                reportableError = new Error(context + ': ' + _safeStringify(error));
                try {
                    const keys = Object.keys(error);
                    for (const key of keys) {
                        try {
                            custom[key] = error[key];
                        } catch (ignored) {
                            custom[key] = _safeStringify(error[key]);
                        }
                    }
                } catch (ignored) {
                    console.log('rollbar custom fields skipped: ' + ignored);
                }
            } else {
                reportableError = new Error(context + ': ' + _safeStringify(error));
            }
            rollbar.critical(reportableError, custom);
        } catch (ignored) { /* fire-and-forget */ }
    },
    configure(params) {
        rollbar.configure(params);
    },
    init(app) {
        const rootStore = useRootStore();
        let environment = rootStore.device.operatingSystem + ' ' + rootStore.device.osVersion;
        environment += ' - ' + rootStore.device.model;
        environment += ' - WebView ' + rootStore.device.webViewVersion;
        console.log('Environment -> ', environment);

        //set rollbar version & environment for payloads; fingerprint by
        //operation context so one noisy operation groups as one item
        //(documented client-side fingerprint key, takes precedence over the
        //default frames+class fingerprint; Rollbar hashes strings over 40 chars)
        const transformer = function (payload) {
            //fold in the constructor's file://app.js filename normalization
            //(configure() overwrites the constructor transform, so without this
            //it never runs in production): keep pure and side-effect free so a
            //throw cannot drop the transform and its fingerprint with it
            try {
                if (payload && payload.body && payload.body.trace && payload.body.trace.frames) {
                    const frames = payload.body.trace.frames;
                    for (let i = 0; i < frames.length; i++) {
                        if (frames[i].filename && frames[i].filename.indexOf('app.js') > -1) {
                            payload.body.trace.frames[i].filename = 'file://app.js';
                        }
                    }
                }
            } catch (ignored) {
                console.log('rollbar frame normalization skipped');
            }
            payload.client = {
                javascript: {
                    code_version: rootStore.app.version
                }
            };
            payload.environment = environment;
            try {
                const context = payload.custom && payload.custom.context;
                if (context) {
                    payload.fingerprint = 'cc:' + context;
                }
            } catch (ignored) {
                console.log('rollbar fingerprint skipped');
            }
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