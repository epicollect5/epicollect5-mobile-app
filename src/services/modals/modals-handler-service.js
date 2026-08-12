export const modalsHandlerService = {

    modals: {
        login: null,
        passwordlessSend: null,
        passwordlessLogin: null,
        confirmPassword: null,
        confirmEmail: null
    },
    //Order in which the modals were presented, used to dismiss them from the topmost (last presented) down
    _presentationOrder: [],
    _track(key, modal) {
        this.modals[key] = modal;
        //a modal re-created for the same key replaces its previous slot
        this._presentationOrder = this._presentationOrder.filter((presentedKey) => presentedKey !== key);
        this._presentationOrder.push(key);
    },
    set login (modal) {
        this._track('login', modal);
    },
    get login () {
        return this.modals.login;
    },
    set passwordlessSend (modal) {
        this._track('passwordlessSend', modal);
    },
    get passwordlessSend () {
        return this.modals.passwordlessSend;
    },
    set passwordlessLogin (modal) {
        this._track('passwordlessLogin', modal);
    },
    get passwordlessLogin () {
        return this.modals.passwordlessLogin;
    },
    set confirmPassword (modal) {
        this._track('confirmPassword', modal);
    },
    get confirmPassword () {
        return this.modals.confirmPassword;
    },
    set confirmEmail (modal) {
        this._track('confirmEmail', modal);
    },
    get confirmEmail () {
        return this.modals.confirmEmail;
    },
    //dismiss all modals
    //imp: dismiss stacked modals from the topmost (last presented) to the bottom one,
    //imp: waiting for each to be fully removed. Dismissing all of them at once
    //imp: causes a DOM unmount race in the Ionic/Vue overlay (teleport) teardown,
    //imp: resulting in "Cannot read properties of null (reading 'nextSibling')".
    async dismissAll () {
        while (this._presentationOrder.length > 0) {
            const key = this._presentationOrder.pop();
            const modal = this.modals[key];
            if (modal) {
                try {
                    await modal.dismiss();
                } catch (error) {
                    console.warn('Failed to dismiss modal:', key, error);
                }
            }
            this.modals[key] = null;
        }
    }
};
