import {PARAMETERS} from '@/config';
import {databaseSelectService} from '@/services/database/database-select-service';
import {projectModel} from '@/models/project-model';
import axios from 'axios';

import {useRootStore} from '@/stores/root-store';

export const webService = {

    // Get XSRF token from cookie
    getXsrfToken() {

        const cookies = document.cookie.split(';');
        let token = '';

        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].split('=');
            if (cookie[0].trim() === 'XSRF-TOKEN') {
                token = decodeURIComponent(cookie[1]);
            }
        }
        return token;
    },
    //jwt auth
    getProject(slug) {

        const self = this;

        return new Promise((resolve, reject) => {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {

                let url = self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PROJECT + slug;
                if (PARAMETERS.DEBUG) {
                    url += '?XDEBUG_SESSION_START=phpstorm';
                }

                axios({
                    method: 'GET',
                    url,
                    headers,
                    timeout: PARAMETERS.DEFAULT_TIMEOUT
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },
    //session auth (private projects only within laravel, checking cookie)
    getProjectPWA(slug) {

        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {

            let url = '';
            if (process.env.NODE_ENV === 'production') {
                url = rootStore.serverUrl + PARAMETERS.API.ROUTES.PWA.ROOT + PARAMETERS.API.ROUTES.PWA.PROJECT + slug;
            } else {
                //in development mode use open endpoint
                url = rootStore.serverUrl + PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG + PARAMETERS.API.ROUTES.PWA.PROJECT + slug;
            }

            axios({
                method: 'GET',
                url,
                timeout: PARAMETERS.DEFAULT_TIMEOUT
            }).then(function (response) {
                const data = {
                    id: 0,
                    name: response.data.data.project.name,
                    slug,
                    logo_thumb: null,
                    project_ref: response.data.data.project.ref,
                    server_url: rootStore.serverUrl,
                    json_extra: response.data.meta.project_extra,
                    mapping: response.data.meta.project_mapping,
                    last_updated: response.data.meta.project_stats.structure_last_updated
                };

                resolve(data);
            }, function (error) {
                reject(error.response);
            });
        });
    },

    //Search for a project
    searchForProject(searchTerm) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token

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
    uploadEntry(slug, payload) {

        const self = this;
        const rootStore = useRootStore();

        return new Promise((resolve, reject) => {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {

                if (rootStore.device.platform !== PARAMETERS.WEB && parseInt(PARAMETERS.DEBUG) === 1) {
                    console.log(JSON.stringify(
                        {
                            method: 'POST',
                            url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                            headers: headers,
                            data: {data: payload}
                        }
                    ));
                    //do not remove, useful for debugging in the browser
                }

                const params = {
                    XDEBUG_SESSION: 'phpstorm'
                };

                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                    headers: headers,
                    params: PARAMETERS.DEBUG ? params : {},
                    data: {
                        data: payload
                    }
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    console.log(error);
                    reject(error.response);
                });
            });
        });
    },

    uploadEntryPWA(slug, payload) {

        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let postURL = self.getServerUrl();

            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                postURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.UPLOAD_DEBUG + slug;
                console.log('post data', JSON.stringify(payload));
            } else {
                postURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.UPLOAD + slug;
            }

            axios({
                method: 'POST',
                url: postURL,
                data: {data: payload}
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    downloadEntryPWA(slug, formRef, entryUuid, branchRef, branchOwnerUuid) {

        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let getURL = self.getServerUrl();

            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                getURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.ENTRIES_DEBUG + slug;
            } else {
                getURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.ENTRIES + slug;
            }

            getURL += '?form_ref=' + formRef + '&uuid=' + entryUuid;

            //add extra params to fetch a single branch (for editing)
            if (branchRef && branchOwnerUuid) {
                getURL += '&branch_ref=' + branchRef;
                getURL += '&branch_owner_uuid=' + branchOwnerUuid;
            }

            axios({
                method: 'GET',
                url: getURL
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    fetchSavedAnswersPWA(slug, formRef, branchRef, offset, inputRef) {

        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let getURL = self.getServerUrl();

            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                getURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.ANSWERS_DEBUG + slug;
            } else {
                getURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.ANSWERS + slug;
            }

            getURL += '?form_ref=' + formRef;
            getURL += '&input_ref=' + inputRef;
            getURL += '&page=' + (offset + 1) + '&per_page=' + PARAMETERS.MAX_SAVED_ANSWERS;

            //add extra params to fetch branch entries
            if (branchRef) {
                getURL += '&branch_ref=' + branchRef;
            }

            axios({
                method: 'GET',
                url: getURL
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    uploadFilePWA(slug, formData) {

        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let postURL = self.getServerUrl();

            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                postURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.UPLOAD_FILE_DEBUG + slug;
                console.log('post data', JSON.stringify(formData));
            } else {
                postURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.UPLOAD_FILE + slug;
            }

            //todo: check -> data: formData 
            axios({
                method: 'POST',
                url: postURL,
                data: formData
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    deleteTempMediaFile(projectSlug, entryUuid, mediaType, filename) {
        return new Promise((resolve, reject) => {
            const payload = {
                data: {
                    type: 'delete',
                    id: entryUuid,
                    delete: {
                        filetype: mediaType,
                        filename
                    }
                }
            };

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let postURL = projectModel.getServerUrl();
            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                postURL +=
                    apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA_DELETE_DEBUG + projectSlug;
                console.log('post data', JSON.stringify(payload));
            } else {
                postURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.TEMP_MEDIA_DELETE + projectSlug;
            }

            //post request to remove temp file from server
            axios({
                method: 'POST',
                url: postURL,
                data: payload
            })
                .then(
                    function (response) {
                        resolve(response);
                    },
                    function (error) {
                        reject(error);
                        console.log(error);
                    }
                );
        });
    },

    checkUniquenessPWA(slug, data) {
        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let postURL = self.getServerUrl();
            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                postURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.UNIQUE_ANSWER_DEBUG + slug;
                console.log('post data', JSON.stringify(data));
            } else {
                postURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.UNIQUE_ANSWER + slug;
            }
            axios({
                method: 'POST',
                url: postURL,
                data: {data: data}
            }).then(function (response) {
                resolve(response);
            }, function (error) {
                console.log(error);
                reject(error.response);
            });
        });
    },

    requestAccountDeletion() {
        const self = this;
        return new Promise((resolve, reject) => {
            const apiProdEndpoint = self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT;
            const postURL = apiProdEndpoint + PARAMETERS.API.ROUTES.ACCOUNT_DELETION;

            self.getHeaders(true).then(function (headers) {
                console.log(headers);
                axios({
                    method: 'POST',
                    url: postURL,
                    headers
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    geocodeAddressPWA(address) {

        const self = this;

        return new Promise((resolve, reject) => {

            const apiProdEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT;
            const apiDebugEndpoint = PARAMETERS.API.ROUTES.PWA.ROOT_DEBUG;
            let getURL = self.getServerUrl();

            if (PARAMETERS.DEBUG) {
                //use debug endpoint (no csrf)
                getURL += apiDebugEndpoint + PARAMETERS.API.ROUTES.PWA.OPENCAGE_DEBUG;
            } else {
                getURL += apiProdEndpoint + PARAMETERS.API.ROUTES.PWA.OPENCAGE;
            }

            getURL += address;

            axios({
                method: 'GET',
                url: getURL
            }).then(function (response) {
                //see api here https://geocoder.opencagedata.com/api#forward-resp
                const data = response.data;
                if (data.status.code === 200 && data.results.length > 0) {
                    const coords = {
                        longitude: data.results[0].geometry.lng.toFixed(6),
                        latitude: data.results[0].geometry.lat.toFixed(6),
                        accuracy: PARAMETERS.GEOLOCATION_DEFAULT_ACCURACY
                    };
                    resolve(coords);
                } else {
                    reject();
                }
            }, function (error) {
                console.log(error);
                reject();
            });
        });
    },

    /**
     * Download entries for a form from the server
     */
    downloadEntries(slug, formRef, url) {

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
    uploadMediaEntry(slug, payload) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders(true).then(function (headers) {
                return axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.UPLOAD + slug,
                    headers: headers,
                    data: {data: payload}
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
    login(data, type) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.LOGIN + type,
                    headers: headers,
                    data: {username: data.email, password: data.password}
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
    authGoogleUser(code) {

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

    authAppleUser(identityToken, user) {
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
    getLoginMethods() {

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
    getProjectVersion(projectSlug) {

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
    getHeaders(getJwt) {

        const headers = {

            'Content-Type': 'application/vnd.api+json'
        };


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

    getJWT() {
        return new Promise(function (resolve) {
            databaseSelectService.getUser().then(function (res) {
                let jwt;
                // Check if we have one
                if (res.rows.length > 0) {
                    jwt = res.rows.item(0).jwt;
                }
                resolve(jwt ?? null);
            });
        });
    },

    /**
     * If we have a project model that has been initialised, we will use the project server url
     * Otherwise, return the server url from the rootscope (defined in the settings page)
     *
     * @returns {*}
     */
    getServerUrl() {
        const rootStore = useRootStore();
        return projectModel.getServerUrl() ? projectModel.getServerUrl() : rootStore.serverUrl;
    },

    /**
     * Get the mobile project image
     */
    getProjectImageUrl(slug) {
        return this.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.MEDIA + slug + PARAMETERS.API.PARAMS.PROJECT_LOGO_QUERY_STRING;
    },

    passwordlessLogin(credentials) {

        const self = this;

        return new Promise(function (resolve, reject) {

            const params = {
                XDEBUG_SESSION: 'phpstorm'
            }; // URL parameter to start Xdebug session

            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                //for ajax only request
                // headers['X-Requested-With'] = 'XMLHttpRequest';
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.LOGIN + 'passwordless',
                    headers: headers,
                    params: PARAMETERS.DEBUG ? params : {},
                    data: {email: credentials.email, code: credentials.code}
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    getPasswordlessCode(email) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {

                const params = {};

                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PASSWORDLESS_CODE,
                    headers: headers,
                    data: {email},
                    params: PARAMETERS.DEBUG ? params : {}
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    getEmailConfirmationCode(email) {

        const self = this;

        return new Promise(function (resolve, reject) {
            // Attempt to retrieve the jwt token
            self.getHeaders().then(function (headers) {
                axios({
                    method: 'POST',
                    url: self.getServerUrl() + PARAMETERS.API.ROUTES.ROOT + PARAMETERS.API.ROUTES.PASSWORDLESS_CODE,
                    headers: headers,
                    data: {email}
                }).then(function (response) {
                    resolve(response);
                }, function (error) {
                    reject(error.response);
                });
            });
        });
    },

    verifyUserEmail(credentials) {

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