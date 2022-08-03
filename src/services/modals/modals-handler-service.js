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
    dismissAll () {
        Object.values(this.modals).forEach((modal) => {

            if (modal) {
                modal.dismiss();
            }
        });
    }
};
