export const formModel = {
    formStructure: {},
    inputs: {},
    formRef: '',

    initialise (form) {
        this.formStructure = form;
        this.formRef = this.formStructure.details.ref;
    },

    /**
     * Remove the form model by resetting the attributes
     */
    destroy () {
        this.formStructure = {};
        this.formRef = '';
        this.inputs = {};
        this.formRef = '';
        this.numInputsThisForm = 0;
    },
    addInputs (inputs) {
        this.inputs = inputs;
    },
    getFormRef () {
        return this.formRef;
    },
    getInputs () {
        return this.inputs;
    },
    getName () {
        return this.formStructure.details.name;
    },
    getBranchHeader (ownerInputRef) {

        let header = '';

        this.inputs.every((input) => {
            if (input.ref === ownerInputRef) {
                header = input.question;
                return false;
            }
            return true;
        });

        return header;
    }
};