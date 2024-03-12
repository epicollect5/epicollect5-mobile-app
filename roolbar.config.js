export default {
    accessToken: process.env.VUE_APP_ROLLBAR_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true,
    reportLevel: 'error',
    captureIp: false,
    itemsPerMinute: 1,
    payload: {
        environment: 'production',
        client: {
            javascript: {
                code_version: '6.0.0'
            }
        }
    }
};