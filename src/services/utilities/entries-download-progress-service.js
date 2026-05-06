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

function _removeStorageKey(storageKey, warningMessage) {
    try {
        window.localStorage.removeItem(storageKey);
    } catch (error) {
        console.warn(warningMessage, error);
    }
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
            _removeStorageKey(storageKey, 'Failed to remove invalid entries download progress:');

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
        _removeStorageKey(_getStorageKey(projectRef, formRef), 'Failed to clear entries download progress:');
    },

    clearProject(projectRef) {
        const storageKeyPrefix = `${STORAGE_KEY_PREFIX}:${projectRef}:`;
        const storageKeys = [];

        try {
            for (let index = 0; index < window.localStorage.length; index += 1) {
                const storageKey = window.localStorage.key(index);

                if (storageKey?.startsWith(storageKeyPrefix)) {
                    storageKeys.push(storageKey);
                }
            }
        } catch (error) {
            console.warn('Failed to list entries download progress keys:', error);
            return;
        }

        storageKeys.forEach((storageKey) => {
            _removeStorageKey(storageKey, 'Failed to clear project entries download progress:');
        });
    }
};
