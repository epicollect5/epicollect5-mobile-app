import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model.js';
import { databaseSelectService } from '@/services/database/database-select-service';

function toISODate(value) {
    if (!value) {
        return null;
    }
    return String(value).split('T')[0];
}

export const entriesListService = {

    async getFilterCounts(projectRef, formRef, parentEntryUuid, activeFilters) {
        const workingFilters = { ...activeFilters };
        if (!workingFilters.status) {
            workingFilters.status = PARAMETERS.STATUS.ALL;
        }

        // COUNT(*) always returns exactly one row: trust the query contract.
        const resultWithoutFilters = await databaseSelectService.countEntries(
            projectRef,
            formRef,
            parentEntryUuid,
            { ...PARAMETERS.FILTERS_DEFAULT },
            PARAMETERS.STATUS.ALL
        );
        const countNoFilters = resultWithoutFilters.rows.item(0).total;

        const result = await databaseSelectService.countEntries(
            projectRef,
            formRef,
            parentEntryUuid,
            workingFilters,
            workingFilters.status
        );

        const total = result.rows.item(0).total || 0;
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

        return {
            countNoFilters,
            countWithFilters: total,
            filters: workingFilters
        };
    },

    setActiveForm(params) {
        const { projectRef, formRef, hierarchyNavigation, language, bookmarks } = params;
        const navigation = hierarchyNavigation;
        const labels = STRINGS[language].labels;

        let currentFormRef = formRef || '';
        let form = currentFormRef ? projectModel.getExtraForm(currentFormRef) : {};
        let fellBack = false;
        if (currentFormRef === '' || Object.keys(form).length === 0) {
            // The project is guaranteed to hold at least one form (checked
            // at cold init), so the first form always exists here.
            currentFormRef = projectModel.getFirstFormRef();
            form = projectModel.getExtraForm(currentFormRef);
            fellBack = true;
        }

        const lastItem = navigation[navigation.length - 1];
        let parentEntryUuid = lastItem ? lastItem.parentEntryUuid : '';
        let parentEntryName = '';
        if (lastItem) {
            parentEntryName = '"' + lastItem.parentEntryName + '"';
        }
        if (fellBack) {
            parentEntryUuid = '';
            parentEntryName = '';
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
        const list = bookmarks;
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
            currentFormName: form.details.name,
            nextFormRef,
            parentFormRef,
            parentFormName,
            backLabel,
            bookmarkId,
            resetHierarchy
        };
    }
};
