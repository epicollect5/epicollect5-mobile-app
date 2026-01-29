'use strict';
import { STRINGS } from '@/config/strings';
import { useRootStore } from '@/stores/root-store';

export const projectModel = {

    project_extra: {},
    mapping: {},
    data: {
        last_updated: '',
        server_url: ''
    },

    //data coming from DB
    initialise(data) {

        this.data = data;
        try {
            this.project_extra = JSON.parse(this.data.json_extra);
            this.mapping = JSON.parse(this.data.mapping);
            console.log('Initialised project -> ', this.project_extra.project.details.name);
        } catch (e) {
            console.log(e);
            console.error('Failed to initialize project with -> ', JSON.stringify(data));
        }
    },
    //data coming from server
    initialisePWA(data) {
        this.data = data;
        try {
            this.project_extra = this.data.json_extra;
            this.mapping = this.data.mapping;
        } catch (e) {
            console.log(e);
            // Failed
        }
    },
    //Load in the project extra structure only
    loadExtraStructure(projectExtra) {
        this.project_extra = projectExtra;
    },
    hasInitialised() {
        return (this.project_extra.project ? true : false);
    },
    getProjectExtra() {
        return this.project_extra;
    },
    getProjectMappings() {
        return this.mapping;
    },
    //Destroy this project model by resetting the attributes
    destroy() {
        this.project_extra = {};
        this.data = {};
        this.mapping = {};
    },
    getProjectName() {
        return this.project_extra.project.details.name;
    },
    getSmallDescription() {
        return this.project_extra.project.details.small_description;
    },
    getDescription() {
        const rootStore = useRootStore();
        const language = rootStore.language;
        const labels = STRINGS[language].labels;
        return this.project_extra.project.details.description || labels.not_available;
    },
    getSlug() {
        return this.project_extra.project.details.slug;
    },
    getProjectRef() {
        return (this.project_extra.project ? this.project_extra.project.details.ref : '');
    },
    getInputs(formRef) {
        return (this.project_extra.forms[formRef].inputs) ? this.project_extra.forms[formRef].inputs : {};
    },
    getFormsInOrder() {
        const forms = this.project_extra.forms ? this.project_extra.forms : {};
        const formRefsInOrder = this.getFormRefsInOrder();
        return formRefsInOrder.map((formRef) => ({
            name: forms[formRef].details.name,
            formRef
        }));
    },
    getExtraForm(formRef) {
        return (this.project_extra.forms[formRef]) ? this.project_extra.forms[formRef] : {};
    },
    getFirstFormRef() {
        return (this.project_extra.project.forms[0]) ? this.project_extra.project.forms[0] : '';
    },
    getLastFormRef() {
        return (this.project_extra.project.forms[this.project_extra.project.forms.length - 1]) ? this.project_extra.project.forms[this.project_extra.project.forms.length - 1] : '';
    },
    getNextFormRef(formRef) {
        // Loop round forms to get position of current form
        for (let i = 0; i < this.project_extra.project.forms.length; i++) {
            // Return next form in the array
            if (formRef === this.project_extra.project.forms[i]) {
                return (this.project_extra.project.forms[i + 1]) ? this.project_extra.project.forms[i + 1] : '';
            }
        }
    },
    getParentFormRef(formRef) {
        // Loop round forms to get position of current form
        for (let i = 0; i < this.project_extra.project.forms.length; i++) {
            // return next form in the array
            if (formRef === this.project_extra.project.forms[i]) {
                return (this.project_extra.project.forms[i - 1]) ? this.project_extra.project.forms[i - 1] : '';
            }
        }
    },
    getFormIndex(formRef) {
        // loop round forms to get position of current form
        for (let i = 0; i < this.project_extra.project.forms.length; i++) {
            // return next form in the array
            if (formRef === this.project_extra.project.forms[i]) {
                return i;
            }
        }
        return 0;
    },
    getFirstForm() {
        return this.project_extra.forms[this.getFirstFormRef()];
    },
    getFirstFormName() {
        return this.project_extra.forms[this.getFirstFormRef()].details.name;
    },
    getFormName(formRef) {
        return this.project_extra.forms[formRef].details.name;
    },
    getExtraInputs() {
        return this.project_extra.inputs ? this.project_extra.inputs : {};
    },
    getFormInputs(formRef) {
        return (this.project_extra.forms[formRef].inputs) ? this.project_extra.forms[formRef].inputs : {};
    },
    getInput(inputRef) {
        return this.project_extra.inputs[inputRef] ? this.project_extra.inputs[inputRef].data : {};
    },
    inputExists(inputRef) {
        return this.project_extra.inputs[inputRef] ? true : false;
    },
    getInputIndexFromRef(formRef, inputRef) {

        for (let i = 0; i < this.project_extra.forms[formRef].inputs.length; i++) {

            if (this.project_extra.forms[formRef].inputs[i] === inputRef) {
                return i;
            }
        }
        // Otherwise return the end-of-the-form index
        return this.project_extra.forms[formRef].inputs.length;
    },
    getBranchInputIndexFromRef(formRef, ownerInputRef, inputRef) {

        for (let i = 0; i < this.project_extra.forms[formRef].branch[ownerInputRef].length; i++) {

            if (this.project_extra.forms[formRef].branch[ownerInputRef][i] === inputRef) {
                return i;
            }
        }
        // Otherwise return the end of the form index
        return this.project_extra.forms[formRef].branch[ownerInputRef].length;
    },
    getInputRefFromIndex(formRef, inputIndex) {
        return (this.project_extra.forms[formRef].inputs[inputIndex] ? this.project_extra.forms[formRef].inputs[inputIndex] : null);
    },
    getBranchInputRefFromIndex(formRef, ownerInputRef, inputIndex) {
        return (this.project_extra.forms[formRef].branch[ownerInputRef][inputIndex] ? this.project_extra.forms[formRef].branch[ownerInputRef][inputIndex] : null);
    },
    // BRANCHES
    getFormBranches(formRef) {
        return (this.project_extra.forms[formRef].branch) ? this.project_extra.forms[formRef].branch : {};
    },
    getBranches(formRef, inputRef) {
        return (this.project_extra.forms[formRef].branch[inputRef]) ? this.project_extra.forms[formRef].branch[inputRef] : {};
    },

    // GROUPS
    getFormGroups(formRef) {
        return (this.project_extra.forms[formRef].group) ? this.project_extra.forms[formRef].group : {};
    },
    getGroupInputs(formRef, inputRef) {
        const out = [];
        let i;
        let group;

        if (this.project_extra.forms[formRef].group[inputRef]) {
            group = this.project_extra.forms[formRef].group[inputRef];
            // loop group input refs and retrieve inputs
            for (i = 0; i < group.length; i++) {
                out[i] = this.getInput(group[i]);
            }
        }

        return out;
    },
    getForms() {
        return (this.project_extra.forms) ? this.project_extra.forms : [];
    },
    getFormRefsInOrder() {
        return (this.project_extra.project.forms) ? this.project_extra.project.forms : [];
    },
    hasLocation(form_ref) {
        return this.project_extra.forms[form_ref].details.has_location;
    },
    getEntriesLimit(ref) {
        const refLookUp = ref || this.getFirstFormRef();
        return this.project_extra.project.entries_limits && this.project_extra.project.entries_limits[refLookUp] ? this.project_extra.project.entries_limits[refLookUp] : null;
    },
    getLastUpdated() {
        return this.data.last_updated;
    },
    setLastUpdated(lastUpdated) {
        this.data.last_updated = lastUpdated;
    },
    getServerUrl() {
        return this.data.server_url;
    },
    getMediaQuestions(){
        const mediaQuestions = [];
        Object.values(this.project_extra.inputs).forEach((input) => {
            if (['photo', 'audio', 'video'].includes(input.data.type)) {
                mediaQuestions.push(input.data.ref);
            }
        });
        return mediaQuestions;
    }
};
