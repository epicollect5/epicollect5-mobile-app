
export const entryModel = {

    //Initialise the entry model
    initialise (entry) {

        this.entryUuid = entry.entry_uuid;
        this.parentEntryUuid = entry.parent_entry_uuid;
        this.isRemote = entry.is_remote;
        this.synced = entry.synced;
        this.canEdit = entry.can_edit;
        this.createdAt = entry.created_at;
        this.title = entry.title ? entry.title : '';
        this.formRef = entry.form_ref;
        this.parentFormRef = entry.parent_form_ref;
        this.projectRef = entry.project_ref;
        this.branchEntries = (entry.branchEntries ? entry.branchEntries : {});
        this.media = (entry.media ? entry.media : {});
        this.uniqueAnswers = {};
        this.syncedError = entry.synced_error;
        this.isBranch = false;
        this.verifyAnswers = {};

        // Attempt to parse the json
        try {
            this.answers = (typeof entry.answers === 'object' ? entry.answers : JSON.parse(entry.answers));
        } catch (e) {
            // Failed
            this.answers = {};
        }
    }
};
