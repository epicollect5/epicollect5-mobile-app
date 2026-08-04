export const modalsHandlerService = {

    modals: {
        login: null,
        passwordlessSend: null,
        passwordlessLogin: null,
        confirmPassword: null,
        confirmEmail: null
    },
    set login (modal) {
        this.modals.login = modal;
    },
    get login () {
        return this.modals.login;
    },
    set passwordlessSend (modal) {
        this.modals.passwordlessSend = modal;
    },
    get passwordlessSend () {
        return this.modals.passwordlessSend;
    },
    set passwordlessLogin (modal) {
        this.modals.passwordlessLogin = modal;
    },
    get passwordlessLogin () {
        return this.modals.passwordlessLogin;
    },
    set confirmPassword (modal) {
        this.modals.confirmPassword = modal;
    },
    get confirmPassword () {
        return this.modals.confirmPassword;
    },
    set confirmEmail (modal) {
        this.modals.confirmEmail = modal;
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
        const ordered = ['login', 'passwordlessSend', 'passwordlessLogin', 'confirmPassword', 'confirmEmail'];
        for (let i = ordered.length - 1; i >= 0; i--) {
            const modal = this.modals[ordered[i]];
            if (modal) {
                await modal.dismiss();
            }
        }
    }
};
