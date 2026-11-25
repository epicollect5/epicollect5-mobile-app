import { config } from '@vue/test-utils';

//an unresolved component is the most expensive spec failure to debug: the
//tag renders as an unknown element, so content inside named slots disappears
//and findComponent finds nothing, while the failing assertion blames business
//logic. Vue does warn on the failed resolution, but the vitest run silences
//console output; surface it as a thrown error naming the tag instead
config.global.config.warnHandler = (message) => {
    if (message.includes('Failed to resolve component')) {
        throw new Error(message);
    }
};
