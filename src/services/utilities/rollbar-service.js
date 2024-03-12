import Rollbar from 'rollbar';
import config from '../../../roolbar.config';

const rollbar = new Rollbar(config);

export default {
    install(app) {
        app.config.errorHandler = (error, vm, info) => {
            rollbar.error(error, { vueComponent: vm, info });
            if (app.config.devtools) {
                console.error(error);
            }
        };
        app.provide('rollbar', rollbar);
    },
    critical(error) {
        rollbar.critical(error);
    },
    configure(params) {
        rollbar.configure(params);
    }
};