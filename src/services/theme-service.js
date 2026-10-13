import {PARAMETERS} from '@/config';
import {Capacitor, registerPlugin} from '@capacitor/core';

const SYSTEM_MEDIA_QUERY = '(prefers-color-scheme: dark)';

//native plugin (github:epicollect5/capacitor-plugin-theme): pins the native
//theme independently of the device theme.
//See docs/ARCHITECTURE.md "Native Night Mode (Theme)".
const themePlugin = registerPlugin('Theme');

//last preference passed to applyTheme(), used by the system listener
//to re-apply only while the preference is 'system'
let lastPreference = PARAMETERS.DEFAULT_THEME;
let systemMediaQuery = null;

function getSystemMediaQuery() {
    if (!systemMediaQuery) {
        //registered once, guarded so repeated applyTheme() calls never stack listeners
        systemMediaQuery = window.matchMedia(SYSTEM_MEDIA_QUERY);
        systemMediaQuery.addEventListener('change', () => {
            if (lastPreference === PARAMETERS.THEMES.SYSTEM) {
                applyTheme(lastPreference);
            }
        });
    }
    return systemMediaQuery;
}

function isEffectiveDark(preference) {
    if (preference === PARAMETERS.THEMES.DARK) {
        return true;
    }
    if (preference === PARAMETERS.THEMES.SYSTEM) {
        return getSystemMediaQuery().matches;
    }
    return false;
}

function applyTheme(preference) {
    lastPreference = preference;
    const effectiveDark = isEffectiveDark(preference);
    document.body.classList.toggle('theme-dark', effectiveDark);
    //root-level scheme drives UA widgets (native date/time pickers);
    //applyTheme runs on all platforms (boot and Settings saves, PWA
    //included — only the Theme plugin call below is native-only),
    //so the light index.html meta only covers first paint
    document.documentElement.style.setProperty(
        'color-scheme',
        effectiveDark ? 'dark' : 'light'
    );

    //native dialogs/pickers must follow the in-app choice, not the device
    //theme. Android and iOS each ship a Theme plugin; the web/PWA has
    //neither and must not be called. Fire-and-forget: a failed call never
    //affects the web theme.
    const platform = Capacitor.getPlatform();
    if (platform === PARAMETERS.ANDROID || platform === PARAMETERS.IOS) {
        themePlugin.setTheme({theme: preference}).catch((error) => {
            console.log('Theme sync failed: ' + error);
        });
    }
}

export const themeService = {
    applyTheme
};
