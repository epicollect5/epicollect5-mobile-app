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
                            // Add image url
                            project.logo = webService.getProjectImageUrl(project.slug);
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
