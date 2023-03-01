export const PARAMETERS = {
    APP_NAME: 'Epicollect5',
    USER_GUIDE_URL: 'https://docs.epicollect.net',
    COMMUNITY_SUPPORT_URL: 'https://community.epicollect.net',

    DEBUG: process.env.VUE_APP_DEBUG,
    IS_LOCALHOST: process.env.NODE_ENV === 'production' ? 0 : 1, //for debugging outside of Laravel(production), it is set to 1
    BYPASS_UNIQUENESS: process.env.VUE_APP_BYPASS_UNIQUENESS,
    // url production
    DEFAULT_SERVER_URL: 'https://five.epicollect.net',
    //DEFAULT_SERVER_URL: 'http://localhost/~mirko/epicollect5-server/public',
    HOW_MANY_ENTRIES: 5,
    HOW_MANY_BRANCH_ENTRIES: 2,

    DEFAULT_LANGUAGE: 'en',

    EASTER_EGG: {
        PROJECT_REF: '031ad19cdaf04dbb9cc9a1c2086bdcbd'
    },

    //platforms
    WEB: 'web',
    ANDROID: 'android',
    IOS: 'ios',
    PWA: 'pwa',

    //legacy platforms
    LEGACY_ANDROID: 'Android',
    LEGACY_IOS: 'iOS',
    LEGACY_WEB: 'WEB',

    //providers
    PROVIDERS: {
        APPLE: 'apple',
        GOOGLE: 'google',
        PASSWORDLESS: 'passwordless',
        LOCAL: 'local',
        LDAP: 'ldap'
    },

    PROJECT_LOGO_PRIVATE: './assets/images/ec5-locked.png',
    GOOGLE_SIGNIN_BUTTON_IMAGE: './assets/images/login-google@2x.png',
    APPLE_SIGNIN_BUTTON_IMAGE: './assets/images/login-apple@2x.png',
    EMAIL_SIGNIN_BUTTON_IMAGE: './assets/images/email-signin-128x128.png',

    CHECKBOX_SVG: '/assets/svg/checkbox.svg',

    API: {
        ROUTES: {
            ROOT: '/api',
            PROJECT: '/project/',
            PROJECTS: '/projects/',
            UPLOAD: '/upload/',
            MEDIA: '/media/',
            PROJECT_VERSION: '/project-version/',
            GET_LOGIN: '/login',
            LOGIN: '/login/',
            HANDLE_GOOGLE: '/handle/google',
            HANDLE_APPLE: '/handle/apple',
            GOOGLE_AUTH: 'https://accounts.google.com/o/oauth2/auth?',
            LOCALHOST: 'http://localhost',
            ENTRIES: '/entries/',
            PASSWORDLESS_CODE: '/login/passwordless/code',
            PASSWORDLESS_AUTH: '/login/passwordless',
            VERIFY: {
                GOOGLE: '/login/verify-google',
                APPLE: '/login/verify-apple'
            },
            PWA: {
                ROOT: '/api/internal',
                ROOT_DEBUG: '/api',
                //api/internal/project/{project_slug}
                PROJECT: '/project/',
                ENTRIES: '/entries/',
                ENTRIES_DEBUG: '/pwa-entries/',
                MEDIA: '/media/',
                UPLOAD: '/web-upload/', //same as bulk upload
                UPLOAD_DEBUG: '/pwa-upload/',//for debugging
                UPLOAD_FILE: '/web-upload-file/',
                UPLOAD_FILE_DEBUG: '/pwa-upload-file/',//for debugging 
                TEMP_MEDIA: '/temp-media/',
                TEMP_MEDIA_DELETE: '/temp-media-delete/',
                TEMP_MEDIA_DELETE_DEBUG: '/pwa-temp-media-delete/',
                UNIQUE_ANSWER: '/unique-answer/',
                UNIQUE_ANSWER_DEBUG: '/pwa-unique-answer/',//for debugging
                DATA_VIEWER: '/data',
                OPENCAGE: '/proxies/opencage/',
                OPENCAGE_DEBUG: '/proxies/pwa-opencage/'
            }
        },
        PARAMS: {
            PROJECT_LOGO_QUERY_STRING: '?type=photo&name=logo.jpg&format=project_mobile_logo',
            GOOGLE_CODE: 'code',
            DATA_VIEWER_RESTORE_QUERY_STRING: '?restore=1'
        }
    },

    PHOTO_EXT: '.jpg',
    AUDIO_EXT: '.mp4',
    AUDIO_EXT_IOS: '.wav',//ios audio recording is only wav
    VIDEO_EXT: '.mp4',

    ALLOWED_ORDERING_COLUMNS: ['title', 'created_at'],
    ALLOWED_ORDERING: ['ASC', 'DESC'],

    DEFAULT_ORDERING_COLUMN: 'created_at',
    DEFAULT_ORDERING: 'DESC',

    AUTH_ERROR_CODES: [
        'ec5_70',
        'ec5_71',
        'ec5_77',
        'ec5_78',
        'ec5_50',
        'ec5_51'
    ],

    PROJECT_OUTDATED_ERROR_CODES: [
        'ec5_201'
    ],

    ENTRY_ADD: 'ADD',
    ENTRY_EDIT: 'EDIT',
    ENTRY_UPLOAD: 'UPLOAD',

    // Error codes which should stop all entry uploads, ie project does not exist, user not authenticated etc
    UPLOAD_STOPPING_ERROR_CODES: [
        'ec5_11', // project does not exist
        'ec5_50', // problem with JWT
        'ec5_51', // problem with JWT
        'ec5_70', // log in
        'ec5_71', // need permission
        'ec5_77', // private project, log in
        'ec5_78', // private project, need permission
        'ec5_116', // server error
        'ec5_201', // project version out of date
        'ec5_202', // project inactive
        'ec5_255' // too many attempts
    ],

    ENTRY: 'entry',
    ENTRIES_TABLE: 'entries',
    BRANCH_ENTRY: 'branch_entry',
    BRANCH_ENTRIES_TABLE: 'branch_entries',

    // Jumps
    JUMPS: {
        IS: 'IS',
        IS_NOT: 'IS_NOT',
        NO_ANSWER_GIVEN: 'NO_ANSWER_GIVEN',
        ALL: 'ALL',
        END_OF_FORM: 'END'
    },

    QUESTION_TYPES: {
        TEXT: 'text',
        PHONE: 'phone',
        TEXTAREA: 'textarea',
        INTEGER: 'integer',
        DECIMAL: 'decimal',
        DATE: 'date',
        TIME: 'time',
        RADIO: 'radio',
        CHECKBOX: 'checkbox',
        DROPDOWN: 'dropdown',
        BARCODE: 'barcode',
        LOCATION: 'location',
        AUDIO: 'audio',
        VIDEO: 'video',
        PHOTO: 'photo',
        BRANCH: 'branch',
        GROUP: 'group',
        README: 'readme',
        SEARCH_SINGLE: 'searchsingle',
        SEARCH_MULTIPLE: 'searchmultiple'

    },

    QUESTION_ANSWER_MAX_LENGTHS: {
        TEXT: 255,
        PHONE: 255,
        TEXTAREA: 1000,
        INTEGER: 255,
        DECIMAL: 255,
        DATE: 25,
        TIME: 25,
        RADIO: 13,
        //CHECKBOX: '',
        DROPDOWN: 13,
        BARCODE: 255,
        //LOCATION: '',
        AUDIO: 51,
        VIDEO: 51,
        PHOTO: 51,
        BRANCH: 0,
        GROUP: 0
    },

    //date formats
    DATE_FORMAT_1: 'dd/MM/YYYY',
    DATE_FORMAT_2: 'MM/dd/YYYY',
    DATE_FORMAT_3: 'YYYY/MM/dd',
    DATE_FORMAT_4: 'MM/YYYY',
    DATE_FORMAT_5: 'dd/MM',

    //time formats
    TIME_FORMAT_1: 'HH:mm:ss',
    TIME_FORMAT_2: 'hh:mm:ss',
    TIME_FORMAT_3: 'HH:mm',
    TIME_FORMAT_4: 'hh:mm',
    TIME_FORMAT_5: 'mm:ss',

    DEFAULT_TEXT_SIZE: '0',//todo: rename to zoom level or display size?
    MAX_SEARCH_HITS: 10,
    MAX_SAVED_ANSWERS: 50,
    POSSIBLE_ANSWERS_FILTER_THRESHOLD: 10,
    POSSIBLE_ANSWERS_LAZY_THRESHOLD: 10,

    FILTERS: {
        TITLE: 'title',
        DATES: 'dates'
    },
    FILTERS_DEFAULT: {
        title: '',
        from: null,
        to: null,
        oldest: null,
        newest: null,
        get status () {
            return PARAMETERS.STATUS.ALL;
        }
    },
    STATUS: {
        ALL: 'ALL',
        INCOMPLETE: 'INCOMPLETE',
        ERROR: 'ERROR'
    },
    ANDROID_ASSETS_ABS_PATH: 'file:///android_asset/www/',
    IOS_ASSETS_ABS_PATH: '',//set at run time
    USER_AGENT: '',

    COMPONENTS_PATH: 'js/components/',

    DEFAULT_TIMEOUT: 30000,
    GEOLOCATION_DEFAULT_ACCURACY: 4,

    DELAY_FAST: 250,
    DELAY_MEDIUM: 500,
    DELAY_LONG: 1000,
    DELAY_EXTRA_LONG: 2000,

    //file paths
    ANDROID_APP_PRIVATE_URI: 'file:///data/data/', //package name is appended at run time
    IOS_APP_PRIVATE_URI: '', //set at run time, it is the Documents folder or the Library folder
    ANDROID_APP_DOWNLOAD_FOLDER: 'Download/epicollect5/',

    PHOTO_DIR: 'photos/',
    AUDIO_DIR: 'audios/',
    VIDEO_DIR: 'videos/',
    LOGOS_DIR: 'logos/',

    ROUTES: {
        PWA_QUIT: 'pwa-quit',
        PROJECTS: 'projects',
        PROJECTS_ADD: 'projects-add',
        ENTRIES: 'entries',
        ENTRIES_ADD: 'entries-add',
        ENTRIES_EDIT: 'entries-edit',
        ENTRIES_BRANCH_ADD: 'entries-branch-add',
        ENTRIES_VIEW: 'entries-view',
        ENTRIES_VIEW_BRANCH: 'entries-view-branch',
        ENTRIES_UPLOAD: 'entries-upload',
        ENTRIES_ERRORS: 'entries-errors',
        ENTRIES_DOWNLOAD: 'entries-download',
        SETTINGS: 'settings',
        NOT_FOUND: 'not-found'
    },

    ENTRIES_REMOTE_PER_PAGE: 50,//this for the remote entries download
    ENTRIES_PER_PAGE: 25,//Entries
    ANSWERS_PER_PAGE: 25,//EntriesView
    POSSIBLE_ANSWERS_PER_PAGE: 25,
    POSSIBLE_ANSWERS_LIMIT: 300,

    SYNCED_CODES: {
        SYNCED_WITH_ERROR: -1,
        UNSYNCED: 0,
        SYNCED: 1,
        INCOMPLETE: 2,
        HAS_UNSYNCED_CHILD_ENTRIES: 3
    },

    EDIT_CODES: {
        CAN: 1,
        CANT: 0
    },

    REMOTE_CODES: {
        IS: 1,
        ISNT: 0
    },

    ANIMATION_FADEIN: 'animated fadeIn',
    ANIMATION_FADEOUT: '',//not used yet
    BARCODE_VIEW_STYLE: ' card ec5-barcode ec5__input ',

    ACTIONS: {
        FILE_DELETED: 'file-deleted',
        FILE_QUEUED: 'file-queded',
        ENTRY_QUIT: 'entry-quit',
        ENTRY_SAVE: 'entry-save'
    },
    SETTINGS_KEYS: {
        SERVER_URL: 'server_url',
        SELECTED_TEXT_SIZE: 'selected_text_size',
        FILTERS_TOGGLE: 'filters_toggle'
    },
    PWA_MIMETYPES: {
        PHOTO: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
        AUDIO: ['audio/mp4', 'audio/wav', 'video/mp4'],
        VIDEO: ['video/mp4']
    },
    //bytes
    PWA_UPLOAD_MAX_SIZE: {
        PHOTO: 10000000, // 10MB
        AUDIO: 100000000,// 100MB,
        VIDEO: 500000000 //500MB
    },
    PWA_FILE_ACCEPTED_FORMATS: {
        PHOTO: 'jpg or png only, max file size 10 MB, max resolution 4096 x 4096px',
        AUDIO: 'mp4 or wav only, max file size 100 MB',
        VIDEO: 'mp4 only, max file size 500 MB'
    },
    PWA_ADD_ENTRY: 'add-entry',
    PWA_EDIT_ENTRY: 'edit-entry',
    PWA_BRANCH_LOCAL: 'branch-local',
    PWA_BRANCH_REMOTE: 'branch-remote',
    PWA_FILE_STATE: {
        CACHED: 'cached',
        STORED: 'stored'
    },
    PWA_MAX_LATLONG_LENGTH: 10,
    PWA_LANGUAGE_FILES_ENDPOINT: '/data-editor/app/assets/ec5-status-codes/',

    //ESRI satellite -> https://wiki.openstreetmap.org/wiki/Esri#Legal_permissions
    ESRI_TILES_PROVIDER_SATELLITE: 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=' + process.env.VUE_APP_ESRI_API_TOKEN,
    //https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9
    ESRI_TILES_PROVIDER_ATTRIBUTION: 'Powered by Esri | Esri, Maxar, Earthstar Geographics, and the GIS User Community',

    //Mapbox  imagery https://docs.mapbox.com/api/maps/styles/
    MAPBOX_TILES_PROVIDER_OUTDOOR: 'https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/tiles/{z}/{x}/{y}?access_token=' + process.env.VUE_APP_MAPBOX_API_TOKEN,
    //https://docs.mapbox.com/help/getting-started/attribution/
    MAPBOX_TILES_ATTRIBUTION: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>',


    //high contrast maps http://maps.stamen.com
    STAMEN_HIGH_CONTRAST_TILES_PROVIDER: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.png',
    STAMEN_TILES_ATTRIBUTION: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.',

    //carto https://carto.com/basemaps/
    CARTO_LIGHT_TILES_PROVIDER: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
    CARTO_TILES_ATTRIBUTION: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution">CARTO</a>',

    //OSM tiles
    OSM_TILES_PROVIDER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    OSM_TILES_ATTRIBUTION: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',


    //bookmark title alphanumeric and - _
    REGEX_BOOKMARK_TITLE: /^[\w\-\s]+$/
};

export const MIGRATIONS = {
    dbVersionName: 'db_version',
    dbVersion: 1
};

export const DEMO_PROJECT = {
    PROJECT_LOGO_IMG_FILENAME: 'ec5-demo-project-logo.jpg',
    PROJECT_LOGO_STORED_FILENAME: 'mobile-logo.jpg',
    PROJECT_FILENAME: './assets/ec5-demo-project.json',
    PROJECT_NAME: 'EC5 Demo Project',
    PROJECT_SLUG: 'ec5-demo-project',
    PROJECT_REF: 'b963c3867b1441b89cb552b982f04bc8',
    LAST_UPDATED: '2016-10-26 16:06:57',
    PROJECT_EXTRA: '',//set at runtime
    MAPPING: ''//set at runtime
};

export const DB_ERRORS = {
    0: 'ec5_109',
    1: 'ec5_104',
    2: 'ec5_105',
    3: 'ec5_106',
    4: 'ec5_107',
    5: 'ec5_108',
    6: 'ec5_109',
    7: 'ec5_110'
};