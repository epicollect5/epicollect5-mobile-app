import { STRINGS } from '@/config/strings';

import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import * as services from '@/services';
import { PARAMETERS } from '@/config';

export const downloadService = {

    //Download entries for a given formRef
    downloadFormEntries (formRef) {

        const rootStore = useRootStore();
        const language = rootStore.language;

        // Default error object
        const errorObj = {
            errors: [{
                code: 'ec5_116',
                source: '',
                title: STRINGS[language].status_codes.ec5_116
            }]
        };

        return new Promise((resolve, reject) => {
            const slug = projectModel.getSlug();
            let totalEntries = 0;
            let entryNumber = 0;

            function _download (url) {

                services.webService.downloadEntries(slug, formRef, url).then(
                    function (response) {

                        if (response.data.data) {

                            const entries = response.data.data.entries;
                            const nextUrl = response.data.links.next;
                            totalEntries = response.data.meta.total;

                            let hasEntries = false;

                            // Do we have any entries?
                            if (entries.length > 0) {

                                hasEntries = true;

                                // Loop entries
                                entries.forEach((entry) => {
                                    // Insert into the db
                                    const flattenedEntry = services.JSONTransformerService.flattenJsonEntry(entry, PARAMETERS.EDIT_CODES.CANT, PARAMETERS.REMOTE_CODES.IS);
                                    // Add the projectRef
                                    flattenedEntry.projectRef = projectModel.getProjectRef();
                                    services.databaseInsertService.insertEntry(flattenedEntry, PARAMETERS.SYNCED_CODES.SYNCED).then(
                                        function () {
                                            console.log('inserted');
                                        },
                                        function (error) {
                                            console.log('error', error);
                                        }
                                    );
                                    entryNumber++;
                                });

                                // Update the progress and counter
                                _updateProgress(entryNumber);

                                // Check if we have any more entries
                                // Use the nextUrl to download the next set
                                if (nextUrl) {
                                    _download(nextUrl);
                                } else {
                                    // Otherwise resolve
                                    resolve(hasEntries);
                                }

                            } else {
                                // No entries
                                resolve(hasEntries);
                            }
                        } else {
                            // Server error
                            reject(errorObj);
                        }
                    }, function (response) {
                        console.log('error');
                        reject(response);
                    });
            }

            //Update the progress counter
            function _updateProgress (entryNumber) {
                services.notificationService.setProgress({ total: totalEntries, done: entryNumber });
            }

            // Start the first download
            _download();
        });
    }
};
