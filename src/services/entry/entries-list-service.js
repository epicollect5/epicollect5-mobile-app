import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';

function cloneFilters(filters) {
    return { ...filters };
}

function freshUnfilteredFilters() {
    return { ...PARAMETERS.FILTERS_DEFAULT };
}

function toISODate(value) {
    if (!value) {
        return null;
    }
    return String(value).split('T')[0];
}

export const entriesListService = {

    async getFilterCounts(projectRef, formRef, parentEntryUuid, activeFilters) {
        const workingFilters = cloneFilters(activeFilters || {});
        if (!workingFilters.status) {
            workingFilters.status = PARAMETERS.STATUS.ALL;
        }

        const resultWithoutFilters = await databaseSelectService.countEntries(
            projectRef,
            formRef,
            parentEntryUuid,
            freshUnfilteredFilters(),
            PARAMETERS.STATUS.ALL
        );
        const countNoFilters = resultWithoutFilters.rows.length > 0 ? resultWithoutFilters.rows.item(0).total : 0;

        const result = await databaseSelectService.countEntries(
            projectRef,
            formRef,
            parentEntryUuid,
            workingFilters,
            workingFilters.status
        );

        let countWithFilters = 0;
        if (result.rows.length > 0) {
            const total = result.rows.item(0).total || 0;
            countWithFilters = total;
            if (total > 0) {
                const oldestDateISO = toISODate(result.rows.item(0).oldest);
                const newestDateISO = toISODate(result.rows.item(0).newest);
                if (workingFilters.oldest === null && workingFilters.newest === null) {
                    workingFilters.oldest = oldestDateISO;
                    workingFilters.newest = newestDateISO;
                    workingFilters.from = oldestDateISO;
                    workingFilters.to = newestDateISO;
                }
            }
        }

        return {
            countNoFilters,
            countWithFilters,
            filters: workingFilters
        };
    },

    resolveFormContext(params) {
        const { projectRef, formRef, hierarchyNavigation, language, bookmarks } = params;
        const navigation = Array.isArray(hierarchyNavigation) ? hierarchyNavigation : [];
        const labels = STRINGS[language].labels;

        let currentFormRef = formRef || '';
        let form = currentFormRef ? projectModel.getExtraForm(currentFormRef) : {};
        if (currentFormRef === '' || Object.keys(form).length === 0) {
            currentFormRef = projectModel.getFirstFormRef();
            form = currentFormRef ? projectModel.getExtraForm(currentFormRef) : {};
        }
        if (!currentFormRef || Object.keys(form).length === 0) {
            const error = new Error('No valid forms');
            error.code = 'NO_FORMS';
            throw error;
        }

        const lastItem = navigation[navigation.length - 1];
        const parentEntryUuid = lastItem ? lastItem.parentEntryUuid : '';
        let parentEntryName = '';
        if (lastItem) {
            parentEntryName = '"' + lastItem.parentEntryName + '"';
        }
        const nextFormRef = projectModel.getNextFormRef(currentFormRef) || '';
        const parentFormRef = projectModel.getParentFormRef(currentFormRef) || '';
        let parentFormName = '';
        let backLabel = labels.projects;
        if (parentFormRef) {
            parentFormName = projectModel.getFormName(parentFormRef);
            backLabel = parentFormName;
        }

        let bookmarkId = null;
        const list = Array.isArray(bookmarks) ? bookmarks : [];
        for (let i = 0; i < list.length; i++) {
            const bookmark = list[i];
            if (bookmark.projectRef === projectRef && bookmark.formRef === currentFormRef) {
                const hierarchy = bookmark.hierarchyNavigation || [];
                if (hierarchy.length === 0 || hierarchy[hierarchy.length - 1].parentEntryUuid === parentEntryUuid) {
                    bookmarkId = bookmark.id;
                }
            }
        }

        const resetHierarchy = (formRef || '') === '' || formRef !== currentFormRef;

        return {
            formRef: currentFormRef,
            parentEntryUuid,
            parentEntryName,
            currentFormName: form.details ? form.details.name : '',
            nextFormRef,
            parentFormRef,
            parentFormName,
            backLabel,
            bookmarkId,
            resetHierarchy
        };
    }
};
