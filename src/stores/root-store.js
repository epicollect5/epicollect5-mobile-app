import { defineStore } from 'pinia';
import { PARAMETERS } from '@/config';

export const useRootStore = defineStore('RootStore', {
    state: () => {
        return {
            serverUrl: '',
            device: {},
            isPWA: false,
            app: {},
            language: PARAMETERS.DEFAULT_LANGUAGE,
            tempDir: '',
            persistentDir: '',
            hierarchyNavigation: [],
            selectedTextSize: PARAMETERS.DEFAULT_TEXT_SIZE,
            //by default, we collect WebView errors in production
            collectErrors: true,
            continueProjectVersionUpdate: false,
            user: {
                jwt: null,
                name: '',
                email: '',
                action: ''
            },
            deviceGeolocation: {
                error: null,
                position: null,
                watchId: 0
            },
            //this will stop location watchPosition on web browser
            geolocationPermission: false,
            routeParams: {},
            routeParamsEntries: {},
            progressDialog: null,
            nextRoute: null,
            attemptedUploadOrErrorFix: false,
            progressTransfer: {
                total: 0,
                done: 0
            },
            modalLogin: {},
            afterUserIsLoggedIn: {
                callback: null,
                params: null
            },
            isAudioModalActive: false,
            isLocationModalActive: false,
            ec5LoadingDialog: null,
            hasGoogleServices: true,
            entriesAddScope: {},
            queueFilesToDelete: [],
            searchParams: null,
            notFound: false,
            queueTempBranchEntriesPWA: {},
            queueRemoteFilesToDeletePWA: [],
            queueBranchUploadErrorsPWA: {},
            queueGlobalUploadErrorsPWA: [],
            branchEditType: PARAMETERS.PWA_BRANCH_LOCAL,
            providedSegment: null,
            easterEgg: false
        };
    },
    getters: {},
    actions: {}
});