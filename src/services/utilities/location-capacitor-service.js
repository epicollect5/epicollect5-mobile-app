import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { notificationService } from '@/services/notification-service';
import { Geolocation } from '@capacitor/geolocation';

import { useRootStore } from '@/stores/root-store';

export const locationService = {

    requestLocationPermission () {
        const rootStore = useRootStore();
        const language = rootStore.language;
        if (rootStore.device.platform !== PARAMETERS.WEB) {
            //is the device authorised?
            cordova.plugins.diagnostic.isLocationAuthorized((response) => {
                //if it is, track location
                if (response) {
                    console.log('Permission granted');
                    rootStore.geolocationPermission = true;
                    this.startWatching();
                }
                else {
                    //ask for permission
                    console.log('permission status: ->', cordova.plugins.diagnostic.permissionStatus);

                    cordova.plugins.diagnostic.getLocationAuthorizationStatus((status) => {

                        //handle iOS permissions
                        if (rootStore.device.platform === PARAMETERS.IOS) {
                            //warn user about wrong permissions
                            if (status === cordova.plugins.diagnostic.permissionStatus.DENIED) {
                                notificationService.showAlert(STRINGS[language].labels.ios_location_permission_denied, STRINGS[language].labels.error);
                                rootStore.geolocationPermission = false;
                            }
                            if (status === cordova.plugins.diagnostic.permissionStatus.RESTRICTED) {
                                notificationService.showAlert(STRINGS[language].labels.ios_location_permission_restricted, STRINGS[language].labels.error);
                                rootStore.geolocationPermission = false;
                            }
                        }

                        cordova.plugins.diagnostic.requestLocationAuthorization((status) => {
                            console.log('Location auth status is:' + status);
                            switch (status) {
                                case cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED:
                                    console.log('Permission not requested');
                                    break;
                                case cordova.plugins.diagnostic.permissionStatus.GRANTED:
                                    console.log('Permission granted');
                                    rootStore.geolocationPermission = true;
                                    this.startWatching();
                                    break;
                                case cordova.plugins.diagnostic.permissionStatus.DENIED:
                                    console.log('Permission denied');
                                    //notify user he needs to enable locatino permissions and restart the app
                                    notificationService.showAlert(STRINGS[language].labels.location_service_fail, STRINGS[language].labels.error);
                                    rootStore.geolocationPermission = false;
                                    break;
                                case cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS:
                                    console.log('Permission permanently denied');
                                    //notify user he needs to enable locatino permissions and restart the app
                                    notificationService.showAlert(STRINGS[language].labels.location_service_fail, STRINGS[language].labels.error);
                                    rootStore.geolocationPermission = false;
                                    break;
                            }
                        }, function (error) {
                            console.error(error);
                        });
                    }, function (error) {
                        console.error(error);
                    });
                }
            }, function (error) {
                console.log(error);
            });
        }
    },

    getWatchTimeout () {
        const rootStore = useRootStore();
        let timeout = PARAMETERS.DEFAULT_TIMEOUT;
        //set unlimited timeout for watch position to avoid timeout error on iOS when the device does not move
        // see http://goo.gl/tYsBSC, http://goo.gl/jYQhgr, http://goo.gl/8oR1g2
        if (rootStore.device.platform !== PARAMETERS.WEB) {
            timeout = (rootStore.device.platform === PARAMETERS.IOS) ? Infinity : PARAMETERS.DEFAULT_TIMEOUT;
        }
        return timeout;
    },

    startWatching () {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const self = this;
        if (rootStore.device.platform !== PARAMETERS.WEB) {
            //is the location available?
            cordova.plugins.diagnostic.isLocationAvailable(function (isAvailable) {
                if (isAvailable) {
                    rootStore.geolocationPermission = true;
                    _triggerStartWatching();
                }
                else {
                    rootStore.geolocationPermission = false;
                    notificationService.showAlert(
                        STRINGS[language].labels.location_not_available,
                        STRINGS[language].labels.error
                    );
                }
            }, function (error) {
                rootStore.geolocationPermission = false;
                notificationService.showAlert(STRINGS[language].labels.location_fail, STRINGS[language].labels.error);
                console.error(error);
            });

        } else {
            //testing on browser, all good
            rootStore.geolocationPermission = true;
            _triggerStartWatching();
        }


        async function _triggerStartWatching () {
            console.log('Started watching position...');

            const geolocationOptions = {
                maximumAge: 0,
                timeout: self.getWatchTimeout(),
                enableHighAccuracy: true
            };

            function geolocationCallback (position, error) {

                if (position === null) {
                    geolocationError(error);
                }
                else {
                    rootStore.deviceGeolocation = {
                        ...rootStore.deviceGeolocation,
                        ...{ position: position.coords }
                    };
                }
            }

            function geolocationError (error) {

                console.log(JSON.stringify(error));
                rootStore.deviceGeolocation = {
                    ...rootStore.deviceGeolocation,
                    ...{ error: error.code }
                };

                switch (error.code) {
                    case 1:
                        if (rootStore.device.platform === PARAMETERS.IOS) {
                            notificationService.showAlert(STRINGS[language].labels.error, STRINGS[language].labels.location_service_fail);
                        }
                        self.stopWatching();
                        rootStore.geolocationPermission = false;
                        break;
                    case 2:
                        // no permission
                        self.stopWatching();
                        rootStore.geolocationPermission = false;
                        break;
                    case 3:
                        //timeout
                        console.log(error);
                        break;
                    default:
                        self.stopWatching();
                        rootStore.geolocationPermission = false;
                        notificationService.showAlert(STRINGS[language].labels.error, STRINGS[language].labels.unknown_error);
                }

            }

            const watchId = await Geolocation.watchPosition(geolocationOptions, geolocationCallback);
            //imp: check this

            rootStore.deviceGeolocation = {
                ...rootStore.deviceGeolocation,
                ...{ watchId }
            };
        }
    },
    stopWatching () {
        const rootStore = useRootStore();
        if (rootStore.geolocationPermission) {

            Geolocation.clearWatch({ id: rootStore.deviceGeolocation.watchId });
        }
    }
};
