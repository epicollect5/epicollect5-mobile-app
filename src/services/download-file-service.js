import { PARAMETERS } from '@/config';

import { useRootStore } from '@/stores/root-store';
import { webService } from '@/services/web-service';

export const downloadFileService = {

    downloadProjectLogo (slug, projectRef) {
        const rootStore = useRootStore();
        return new Promise(function (resolve, reject) {

            if (rootStore.device.platform !== PARAMETERS.WEB) {
                // Get the headers first
                webService.getHeaders(true).then(
                    function (headers) {

                        //remember to add cordova whitelist plugin as if affects other plugins
                        //see t.ly/Opox
                        const fileTransfer = new window.FileTransfer();
                        const uri = encodeURI(webService.getProjectImageUrl(slug));
                        const appStorePath = rootStore.persistentDir + PARAMETERS.LOGOS_DIR + projectRef + '/mobile-logo.jpg?' + new Date().getTime();

                        fileTransfer.download(
                            uri,
                            appStorePath,
                            function (entry) {
                                console.log('download complete: ' + entry.toURL());
                                resolve();
                            },
                            function (error) {
                                console.error(error);
                                console.log('download error source ' + error.source);
                                console.log('download error target ' + error.target);
                                console.log('download error code' + error.code);
                                reject();
                            },
                            false,
                            {
                                headers: headers
                            }
                        );
                    });
            } else {
                // If via browser, just resolve
                resolve();
            }
        });
    }
};