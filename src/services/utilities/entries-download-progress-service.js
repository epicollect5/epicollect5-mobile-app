const STORAGE_KEY_PREFIX = 'entries-download-progress';

function _getStorageKey(projectRef, formRef) {
    return `${STORAGE_KEY_PREFIX}:${projectRef}:${formRef}`;
}

function _createEmptyProgress() {
    return {
        urls: {},
        startUrl: null,
        totalEntries: 0,
        processedEntries: 0,
        updatedAt: null
    };
}

export const entriesDownloadProgressService = {
    getStorageKey(projectRef, formRef) {
        return _getStorageKey(projectRef, formRef);
    },

    createEmptyProgress() {
        return _createEmptyProgress();
    },

    load(projectRef, formRef) {
        const storageKey = _getStorageKey(projectRef, formRef);
        let cachedValue = null;

        try {
            cachedValue = window.localStorage.getItem(storageKey);
        } catch (error) {
            console.warn('Failed to load entries download progress:', error);
            return _createEmptyProgress();
        }

        if (!cachedValue) {
            return _createEmptyProgress();
        }

        try {
            const parsedValue = JSON.parse(cachedValue);
            return {
                ..._createEmptyProgress(),
                ...parsedValue,
                urls: parsedValue?.urls || {}
            };
        } catch (error) {
            console.warn('Failed to parse entries download progress:', error);

            try {
                window.localStorage.removeItem(storageKey);
            } catch (removeError) {
                console.warn('Failed to remove invalid entries download progress:', removeError);
            }

            return _createEmptyProgress();
        }
    },

    save(projectRef, formRef, progress) {
        try {
            window.localStorage.setItem(
                _getStorageKey(projectRef, formRef),
                JSON.stringify(progress)
            );
        } catch (error) {
            console.warn('Failed to save entries download progress:', error);
        }
    },

    clear(projectRef, formRef) {
        try {
            window.localStorage.removeItem(_getStorageKey(projectRef, formRef));
        } catch (error) {
            console.warn('Failed to clear entries download progress:', error);
        }
    }
};
