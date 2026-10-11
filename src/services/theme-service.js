import {PARAMETERS} from '@/config';
import {Capacitor, registerPlugin} from '@capacitor/core';

const SYSTEM_MEDIA_QUERY = '(prefers-color-scheme: dark)';

//local native plugin: pins the night mode independently of the device theme.
//See docs/ARCHITECTURE.md "Native Night Mode (Theme)" — includes the iOS
//packageClassList gotcha and its guard script/test.
const nightModePlugin = registerPlugin('NightMode');

const NIGHT_MODES = {
    [PARAMETERS.THEMES.LIGHT]: 'no',
    [PARAMETERS.THEMES.DARK]: 'yes',
    [PARAMETERS.THEMES.SYSTEM]: 'follow_system'
};

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
    //included — only the NightMode plugin call below is native-only),
    //so the light index.html meta only covers first paint
    document.documentElement.style.setProperty(
        'color-scheme',
        effectiveDark ? 'dark' : 'light'
    );

    //native dialogs/pickers must follow the in-app choice, not the device
    //theme. Android and iOS each ship a NightMode plugin; the web/PWA has
    //neither and must not be called. Fire-and-forget: a failed call never
    //affects the web theme.
    const platform = Capacitor.getPlatform();
    if (platform === PARAMETERS.ANDROID || platform === PARAMETERS.IOS) {
        nightModePlugin.setNightMode({mode: NIGHT_MODES[preference]}).catch((error) => {
            console.log('Night mode sync failed: ' + error);
        });
    }
}

export const themeService = {
    applyTheme
};
