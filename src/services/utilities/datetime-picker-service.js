import { Capacitor } from '@capacitor/core';
import { DatetimePicker } from '@capawesome-team/capacitor-datetime-picker';
import { PARAMETERS } from '@/config';
import { useRootStore } from '@/stores/root-store';

const DATE_FORMAT = 'yyyy-MM-dd';
const TIME_FORMAT = 'HH:mm';

const BCP47_MAP = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    it: 'it-IT',
    pl: 'pl-PL',
    pt: 'pt-PT',
    ca: 'ca-ES',
    de: 'de-DE',
    sl: 'sl-SI'
};

function toBCP47(language) {
    if (!language || typeof language !== 'string') {
        return 'en-US';
    }
    if (BCP47_MAP[language]) {
        return BCP47_MAP[language];
    }
    //already BCP47 (e.g. en-US) or unknown: pass through
    return language;
}

function getLocale() {
    try {
        const rootStore = useRootStore();
        return toBCP47(rootStore.language);
    } catch (error) {
        console.log(error);
        return 'en-US';
    }
}

function getTheme() {
    try {
        const rootStore = useRootStore();
        if (rootStore.theme === PARAMETERS.THEMES.DARK) {
            return 'dark';
        }
        if (rootStore.theme === PARAMETERS.THEMES.LIGHT) {
            return 'light';
        }
        return 'auto';
    } catch (error) {
        console.log(error);
        return 'auto';
    }
}

//The Cordova wheel selector only accepts 'light'|'dark' (no 'auto'),
//so the system preference is resolved here to the effective theme
function getWheelTheme() {
    try {
        const rootStore = useRootStore();
        if (rootStore.theme === PARAMETERS.THEMES.DARK) {
            return 'dark';
        }
        if (rootStore.theme === PARAMETERS.THEMES.LIGHT) {
            return 'light';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (error) {
        console.log(error);
        return 'light';
    }
}

function isDismissal(error) {
    if (!error) {
        return false;
    }
    const code = error.code || error.message || '';
    if (typeof code === 'string') {
        const lowered = code.toLowerCase();
        if (lowered.includes('dismissed') || lowered.includes('cancel')) {
            return true;
        }
    }
    return false;
}

function isSupported() {
    return Capacitor.isNativePlatform();
}

async function presentDate(params) {
    const { value, min, max, locale, theme } = params || {};
    if (!isSupported()) {
        return null;
    }
    try {
        const result = await DatetimePicker.present({
            mode: 'date',
            format: DATE_FORMAT,
            value,
            min,
            max,
            locale: locale || getLocale(),
            theme: theme || getTheme()
        });
        return result.value;
    } catch (error) {
        if (isDismissal(error)) {
            return null;
        }
        throw error;
    }
}

async function presentTime(params) {
    const { value, locale, theme } = params || {};
    if (!isSupported()) {
        return null;
    }
    try {
        const result = await DatetimePicker.present({
            mode: 'time',
            format: TIME_FORMAT,
            value,
            locale: locale || getLocale(),
            theme: theme || getTheme()
        });
        return result.value;
    } catch (error) {
        if (isDismissal(error)) {
            return null;
        }
        throw error;
    }
}

export const datetimePickerService = {
    DATE_FORMAT,
    TIME_FORMAT,
    isSupported,
    presentDate,
    presentTime,
    toBCP47,
    getLocale,
    getTheme,
    getWheelTheme
};
