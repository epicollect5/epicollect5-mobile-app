import { projectModel } from '@/models/project-model.js';
import { useRootStore } from '@/stores/root-store';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { formModel } from '@/models/form-model.js';
import { notificationService } from '@/services/notification-service';
import { entryCommonService } from '@/services/entry/entry-common-service';
import { entryService } from '@/services/entry/entry-service';
import { branchEntryService } from '@/services/entry/branch-entry-service';
import { databaseInsertService } from '@/services/database/database-insert-service';

export async function addFakeEntries(params) {
    const { formRef, parentEntryUuid, parentFormRef } = params;
    const rootStore = useRootStore();
    const language = rootStore.language;
    const labels = STRINGS[language].labels;

    await notificationService.showProgressDialog(labels.wait);

    const howManyEntries = PARAMETERS.HOW_MANY_ENTRIES;
    const howManyBranches = PARAMETERS.HOW_MANY_BRANCH_ENTRIES;
    const branches = Object.keys(formModel.formStructure.branch);
    const BATCH_SIZE = 100;
    const syncType = PARAMETERS.SYNCED_CODES.UNSYNCED;

    // Unsync parent chain once for all fake entries
    if (parentEntryUuid) {
        await entryService.unsyncParentEntries(projectModel.getProjectRef(), parentEntryUuid);
    }

    const batch = [];

    try {
        for (let i = 1; i <= howManyEntries; i++) {
            entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);
            console.log(`${i}. - adding fake entry for ${entryService.entry.entryUuid}`);

            if (Math.random() < 0.5) {
                entryService.entry.createdAt = '1970-01-01T12:24:27.000Z';
                console.warn(`${i}. - created_at is epoch for entry: ${entryService.entry.entryUuid}`);
            }

            await entryCommonService.addFakeAnswers(
                entryService.entry,
                entryService.form.inputs.slice(0),
                i
            );

            // Set title as saveEntry does
            entryCommonService.setEntryTitle(
                projectModel.getExtraForm(entryService.entry.formRef),
                projectModel.getExtraInputs(),
                entryService.entry,
                false
            );

            // Snapshot entry before next setUpNew overwrites the singleton
            batch.push({
                entryUuid: entryService.entry.entryUuid,
                parentEntryUuid: entryService.entry.parentEntryUuid,
                projectRef: entryService.entry.projectRef,
                formRef: entryService.entry.formRef,
                parentFormRef: entryService.entry.parentFormRef,
                answers: entryService.entry.answers,
                canEdit: entryService.entry.canEdit,
                isRemote: entryService.entry.isRemote,
                createdAt: entryService.entry.createdAt,
                updatedAt: entryService.entry.updatedAt,
                title: entryService.entry.title
            });

            // Flush batch in a single transaction
            await databaseInsertService.insertEntries(batch, syncType);
            batch.length = 0;

            for (const branchRef of branches) {
                const branchInputs = projectModel.getBranches(formModel.formRef, branchRef);

                for (let j = 1; j <= howManyBranches; j++) {
                    branchEntryService.setUpNew(
                        formModel.formRef,
                        branchRef,
                        entryService.entry.entryUuid
                    );
                    console.log(`${j}. - adding fake branch for ${entryService.entry.entryUuid}`);

                    if (Math.random() < 0.5) {
                        branchEntryService.entry.createdAt = '1970-01-01T12:24:27.000Z';
                        console.warn(`${i}. - created_at is epoch for BRANCH entry: ${branchEntryService.entry.entryUuid}`);
                    }

                    await entryCommonService.addFakeAnswers(
                        branchEntryService.entry,
                        branchInputs.slice(0),
                        j
                    );

                    await branchEntryService.saveEntry(syncType);
                }
            }

            // Yield to keep UI responsive
            if (i % 100 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
        }

        // Flush remaining entries
        if (batch.length > 0) {
            await databaseInsertService.insertEntries(batch, syncType);
        }
        await databaseInsertService.moveBranchEntries();
        await databaseInsertService.moveUniqueAnswers();
    } catch (error) {
        notificationService.hideProgressDialog();
        throw error;
    }

    notificationService.hideProgressDialog();
}
