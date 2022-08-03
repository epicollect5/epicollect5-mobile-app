import { databaseSelectService } from '@/services/database/database-select-service';

import { useRootStore } from '@/stores/root-store';
import { PARAMETERS, DEMO_PROJECT } from '@/config';
import { Capacitor } from '@capacitor/core';

export function fetchLocalProjects () {

    return new Promise((resolve) => {

        const rootStore = useRootStore();
        const projects = [];

        databaseSelectService.selectProjects().then(
            function (res) {
                let appPersistentStoragePath;
                // let easterEggFound = false;

                if (res.rows.length > 0) {
                    for (let i = 0; i < res.rows.length; i++) {

                        if (rootStore.device.platform === PARAMETERS.WEB) {
                            appPersistentStoragePath =
                                '/assets/images/ec5-placeholder-100x100.jpg';
                        } else {
                            console.log('App tempDir -> ' + rootStore.tempDir);
                            //hack for ios not loading files from www in WKWebView
                            //show project demo logo
                            if (res.rows.item(i).project_ref === DEMO_PROJECT.PROJECT_REF) {
                                appPersistentStoragePath =
                                    './assets/images/ec5-demo-project-logo.jpg';
                            } else {
                                appPersistentStoragePath = Capacitor.convertFileSrc(
                                    rootStore.persistentDir +
                                    PARAMETERS.LOGOS_DIR +
                                    res.rows.item(i).project_ref +
                                    '/mobile-logo.jpg?' +
                                    new Date().getTime()
                                );
                            }
                            console.log('Loading from ->' + appPersistentStoragePath);
                        }

                        projects.push({
                            ref: res.rows.item(i).project_ref,
                            name: res.rows.item(i).name,
                            logo: appPersistentStoragePath
                        });
                        //todo: do this somewhere else
                        //check if we have the EASTER EGG project to unlock extra settings
                        // if (
                        //     res.rows.item(i).project_ref ===
                        //     PARAMETERS.EASTER_EGG.PROJECT_REF
                        // ) {
                        //     easterEggFound = true;
                        // }
                    }
                }

                resolve(projects);

                //todo: do this somewhere else
                // //set flag if the EASTER EGG project was found
                // if (easterEggFound) {
                //     //found, unlock extra settings
                //     PARAMETERS.EASTER_EGG.STATUS = 1;
                // } else {
                //     //not found, hide extra settings
                //     PARAMETERS.EASTER_EGG.STATUS = 0;
                // }

                //hide loader
                //state.isFetching = false;

                //todo: check this on device
                // _hideSplashscreen();
            },
            function (error) {
                console.log(error);
                resolve([]);
                // Error
                //  _hideSplashscreen();
            }
        );
    });
}