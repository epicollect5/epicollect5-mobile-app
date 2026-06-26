import { PARAMETERS } from '@/config';
import { utilsService } from '@/services/utilities/utils-service';
import { webService } from '@/services/web-service';

export function fetchServerProjects (searchTerm) {

    let request_timeout;

    return new Promise((resolve, reject) => {

        // Throttle requests
        clearTimeout(request_timeout);
        request_timeout = window.setTimeout(function () {
            // Reset projects array for each search
            let projects = [];

            // Search for project
            webService.searchForProject(searchTerm, false).then(
                function (response) {
                    // Loop round and add to projects array
                    if (response.data.data.length > 0) {
                        response.data.data.forEach((projectData) => {
                            const project = projectData.project;
                            if (project.logo_base64) {
                                // Server feature flag on: use the embedded
                                // base64 data URI (avoids one HTTP request
                                // per hit). Private projects also enter this
                                // branch only when the field is a non-empty
                                // string, which the server does not return
                                // for them; private hits land in the `else`
                                // branch below.
                                project.logo = project.logo_base64;
                            } else if (!('logo_base64' in project)) {
                                // Key absent in payload: server feature flag
                                // is off. Fall back to the legacy client-
                                // side URL so the app keeps working without
                                // the flag enabled. The consumer decides
                                // what to display based on `access`, so this
                                // is harmless for private hits (the locked
                                // placeholder is shown regardless).
                                project.logo = webService.getProjectImageUrl(project.slug);
                            } else {
                                // logo_base64 is explicitly null or empty
                                // in the payload. The consumer renders the
                                // appropriate placeholder (locked for
                                // private, generic for public) based on
                                // `access`.
                                project.logo = project.logo_base64;
                            }
                            projects.push(project);
                        });
                        //on slow devices, sometimes projects gets duplicated, so we take care of it here
                        projects = utilsService.filterObjectsByUniqueKey(projects, 'ref');
                        resolve(projects);
                    } else {
                        resolve([]);
                    }
                },
                function (error) {
                    reject(error);
                }
            );
        }, PARAMETERS.DELAY_LONG);
    });
}
