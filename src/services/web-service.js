import { PARAMETERS } from '@/config';
import { databaseSelectService } from '@/services/database/database-select-service';
import { projectModel } from '@/models/project-model.js';
import axios from 'axios';

import { useRootStore } from '@/stores/root-store';

export const webService = {

    //jwt auth
    getProject (slug) {

        const self = this;

        return new Promise((resolve, reject) => {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {
                const url = self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PROJECT + slug;
                axios({
                    method: 'GET',
                    url,
                    headers,
                    timeout: 30000
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },
    //session auth (private projects only within laravel, checking cookie)
    getProjectPWA (slug) {

        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {
            const url = rootStore.serverUrl + PARAMETERS.API.ROUTES.PWA.ROOT + PARAMETERS.API.ROUTES.PWA.PROJECT + slug;
            axios({
                method: 'GET',
                url,
                timeout: 30000
            }).then(function (response) {
                //last updated is not needed on pWA, set it to current moment
                let lastUpdated = (new Date()).toISOString().replace('T', ' ');
                lastUpdated = lastUpdated.split('.')[0];
                console.log(lastUpdated);
                const data = {
                    id: 0,
                    name: response.data.data.project.name,
                    slug,
                    logo_thumb: null,
                    project_ref: response.data.data.project.ref,
                    server_url: rootStore.serverUrl,
                    json_extra: response.data.meta.project_extra,
                    mapping: response.data.meta.project_mapping,
                    last_updated: lastUpdated
                };


                console.log(JSON.stringify(data));

                resolve(data);
            }, function (error) {
                reject(error.response);
            });
        });
    },

    //Search for a project
    searchForProject (searchTerm) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            console.log('api projects endpoint: ', self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PROJECTS + searchTerm);

            self.getHeaders().then(function (headers) {
                axios({
                    method: 'GET',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PROJECTS + searchTerm,
                    headers
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Upload an entry to the server
     */
    uploadEntry (slug, data) {

        const self = this;
        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {

                if (rootStore.device.platform !== PARAMETERS.WEB && PARAMETERS.MOBILE_DEBUG === 1) {
                    console.log(JSON.stringify(
                        {
                            method: 'POST',
                            url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                            headers: headers,
                            data: { data: data }
                        }
                    ));
                    //do not remove, useful for debugging in the browser
                }

                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                    headers: headers,
                    data: { data: data }
                }).then(function (response) {

                    resolve(response);
                }, function (error) {
                    console.log(error);

                    reject(error.response);
                });
            });
        });
    },

    uploadEntryPWA (slug, data) {

        const self = this;
        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {
            // Attempt to retrieve the jwt token

            if (rootStore.device.platform === PARAMETERS.PWA && PARAMETERS.MOBILE_DEBUG === 1) {
                console.log(JSON.stringify(
                    {
                        method: 'POST',
                        url: self.getServerUrl() + PARAMETERS.API.ROUTES.PWA.ROOT + PARAMETERS.API.ROUTES.PWA.UPLOAD + slug,
                        data: { data: data }
                    }
                ));

                //do not remove, useful for debugging in the browser

            }

            axios({
                method: 'POST',
                url: self.getServerUrl() + PARAMETERS.API.ROUTES.PWA.ROOT + PARAMETERS.API.ROUTES.PWA.UPLOAD + slug,
                data: { data: data }
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    /**
     * Download entries for a form from the server
     */
    downloadEntries (slug, formRef, url) {

        const self = this;
        // Use either the url passed in or construct manually
        const entriesUrl = url ? url : self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.ENTRIES + slug + '?form_ref=' + formRef + '&per_page=' + PARAMETERS.ENTRIES_REMOTE_PER_PAGE;

        return new Promise(function (resolve, reject) {

            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {

                axios({
                    method: 'GET',
                    url: entriesUrl,
                    headers: headers
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Upload a media entry to the server
     */
    uploadMediaEntry (slug, data) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {
                return axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                    headers: headers,
                    data: { data: data }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Upload an entry to the serve
     */
    login (data, type) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.LOGIN + type,
                    headers: headers,
                    data: { username: data.email, password: data.password }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Authorise google user
     */
    authGoogleUser (code) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.getHeaders().then(function (headers) {

                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.HANDLE_GOOGLE,
                    headers: headers,
                    data: {
                        code: code,
                        grant_type: 'authorization_code'
                    }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    authAppleUser (identityToken, user) {
        const self = this;

        return new Promise(function (resolve, reject) {

            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.HANDLE_APPLE,
                    headers: headers,
                    data: {
                        identityToken: identityToken,
                        user: user
                    }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Get login methods from server
     */
    getLoginMethods () {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.getHeaders().then(function (headers) {
                axios({
                    method: 'GET',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.GET_LOGIN,
                    headers
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Get the project version
     */
    getProjectVersion (projectSlug) {

        const self = this;

        return new Promise(function (resolve, reject) {

            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {

                axios({
                    method: 'GET',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PROJECT_VERSION + projectSlug,
                    headers: headers
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    /**
     * Get header information
     * Specify whether you want to send the jwt token in the request or not
     */
    //imp: a jwt token is valid for a SINGLE device/browser at a time.
    //imp: when logging in on one device/browser, the other token is invalidated.
    //imp: be careful when debugging with multiple tabs or between old/new app.
    //imp: to be sure, test on postman with different jwt tokens:
    //imp: only the latest is valid, all the others do not work anymore.
    getHeaders (getJwt) {

        const headers = { 'Content-Type': 'application/vnd.api+json' };

        return new Promise(function (resolve, reject) {

            if (getJwt) {
                databaseSelectService.getUser().then(function (res) {

                    let jwt;

                    // Check if we have one
                    if (res.rows.length > 0) {
                        jwt = res.rows.item(0).jwt;
                    }

                    if (jwt) {
                        headers.Authorization = 'Bearer ' + jwt;
                    }
                    resolve(headers);
                });
            } else {
                resolve(headers);
            }
        });
    },

    /**
     * If we have a project model that has been initialised, we will use the project server url
     * Otherwise, return the server url from the rootscope (defined in the settings page)
     *
     * @returns {*}
     */
    getServerUrl () {
        const rootStore = useRootStore();
        return projectModel.getServerUrl() ? projectModel.getServerUrl() : rootStore.serverUrl;
    },

    /**
     * Get the mobile project image
     */
    getProjectImageUrl (slug) {
        return this.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.MEDIA + slug + PARAMETERS.API.PARAMS.PROJECT_LOGO_QUERY_STRING;
    },

    passwordlessLogin (credentials) {

        const self = this;

        return new Promise(function (resolve, reject) {

            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                //for ajax only request
                // headers['X-Requested-With'] = 'XMLHttpRequest';
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.LOGIN + 'passwordless',
                    headers: headers,
                    data: { email: credentials.email, code: credentials.code }
                }).then(function (response) {

                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    getPasswordlessCode (email) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PASSWORDLESS_CODE,
                    headers: headers,
                    data: { email }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    getEmailConfirmationCode (email) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PASSWORDLESS_CODE,
                    headers: headers,
                    data: { email: email }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    verifyUserEmail (credentials) {

        const self = this;
        const provider = credentials.provider.toUpperCase();
        const apiRootEndpoint = self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT;
        const verifyEndpoint = apiRootEndpoint + PARAMETERS.API.ROUTES.VERIFY[provider];

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                //for ajax only request
                // headers['X-Requested-With'] = 'XMLHttpRequest';
                axios({
                    method: 'POST',
                    url: verifyEndpoint,
                    headers: headers,
                    data: {
                        email: credentials.email,
                        code: credentials.code,
                        user: credentials.user
                    }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    }
};