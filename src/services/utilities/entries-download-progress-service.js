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
        const cachedValue = window.localStorage.getItem(storageKey);

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
            console.log('error', error);
            window.localStorage.removeItem(storageKey);
            return _createEmptyProgress();
        }
    },

    save(projectRef, formRef, progress) {
        window.localStorage.setItem(
            _getStorageKey(projectRef, formRef),
            JSON.stringify(progress)
        );
    },

    clear(projectRef, formRef) {
        window.localStorage.removeItem(_getStorageKey(projectRef, formRef));
    }
};
