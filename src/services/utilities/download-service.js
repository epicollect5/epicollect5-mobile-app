import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model.js';
import { PARAMETERS } from '@/config';
import { notificationService } from '@/services/notification-service';
import { JSONTransformerService } from '@/services/utilities/json-transformer-service';
import { databaseInsertService } from '@/services/database/database-insert-service';
import { webService } from '@/services/web-service';

export const downloadService = {

    //Download entries for a given formRef
    async downloadFormEntries (formRef, options = {}) {

        const rootStore = useRootStore();
        const language = rootStore.language;
        const delayMs = options.delayMs ?? 3 * PARAMETERS.DELAY_LONG;

        // Default error object
        const errorObj = {
            errors: [{
                code: 'ec5_116',
                source: '',
                title: STRINGS[language].status_codes.ec5_116
            }]
        };

        const slug = projectModel.getSlug();
        let totalEntries = options.initialTotalEntries ?? 0;
        let entryNumber = options.initialEntryNumber ?? 0;
        let url = options.startUrl;
        let hasEntries = entryNumber > 0;
        const cancellationError = {
            cancelled: true
        };

        function _wait (ms) {
            return new Promise((resolve) => {
                window.setTimeout(resolve, ms);
            });
        }

        async function _waitUnlessCancelled(ms) {
            const intervalMs = 100;
            let remainingMs = ms;

            while (remainingMs > 0) {
                _throwIfCancelled();
                const nextDelayMs = Math.min(intervalMs, remainingMs);
                await _wait(nextDelayMs);
                remainingMs -= nextDelayMs;
            }

            _throwIfCancelled();
        }

        function _throwIfCancelled() {
            if (options.isCancelled?.()) {
                throw cancellationError;
            }
        }

        function _normalizeNextUrlProtocol(nextUrl, currentUrl) {
            if (!PARAMETERS.DEBUG) {
                return nextUrl;
            }

            if (!nextUrl || !currentUrl) {
                return nextUrl;
            }

            try {
                const nextUrlObject = new URL(nextUrl);
                const currentUrlObject = new URL(currentUrl);

                if (currentUrlObject.protocol === 'https:' && nextUrlObject.protocol === 'http:' && nextUrlObject.host === currentUrlObject.host) {
                    nextUrlObject.protocol = 'https:';
                    return nextUrlObject.toString();
                }
            } catch (_error) {
                return nextUrl;
            }

            return nextUrl;
        }

        //Update the progress counter
        function _updateProgress (entryNumber) {
            notificationService.setProgressTransfer({ total: totalEntries, done: entryNumber });
        }

        let shouldContinue = true;

        while (shouldContinue) {
            _throwIfCancelled();

            if (options.shouldSkipUrl && url && options.shouldSkipUrl(url)) {
                const cachedNextUrl = options.getCachedNextUrl?.(url);

                if (cachedNextUrl) {
                    url = _normalizeNextUrlProtocol(cachedNextUrl, url);
                    continue;
                }

                return hasEntries;
            }

            const response = await webService.downloadEntries(slug, formRef, url);

            _throwIfCancelled();

            if (!response.data.data) {
                throw errorObj;
            }

            const entries = response.data.data.entries;
            const currentUrl = response.config?.url || url;
            const nextUrl = _normalizeNextUrlProtocol(response.data.links.next, currentUrl);
            totalEntries = response.data.meta.total;

            if (options.onProgress) {
                options.onProgress({
                    totalEntries,
                    processedEntries: entryNumber
                });
            }

            // Do we have any entries?
            if (entries.length > 0) {

                hasEntries = true;

                const flattenedEntries = entries.map((entry) => {
                    const flattenedEntry = JSONTransformerService.flattenJsonEntry(entry, PARAMETERS.EDIT_CODES.CANT, PARAMETERS.REMOTE_CODES.IS);
                    // Add the projectRef
                    flattenedEntry.projectRef = projectModel.getProjectRef();
                    return flattenedEntry;
                });

                _throwIfCancelled();
                await databaseInsertService.insertEntries(flattenedEntries, PARAMETERS.SYNCED_CODES.SYNCED);

                entryNumber += entries.length;

                // Update the progress and counter
                _updateProgress(entryNumber);

                if (options.onPageDownloaded && currentUrl) {
                    options.onPageDownloaded(currentUrl, nextUrl, {
                        totalEntries,
                        processedEntries: entryNumber
                    });
                }

                _throwIfCancelled();

                // Check if we have any more entries
                // Use the nextUrl to download the next set
                if (nextUrl) {
                    await _waitUnlessCancelled(delayMs);
                    url = nextUrl;
                    continue;
                }
            }

            shouldContinue = false;
            return hasEntries;
        }
    }
};
