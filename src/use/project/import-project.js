import {DB_ERRORS, PARAMETERS} from '@/config';
import {STRINGS} from '@/config/strings';
import {projectModel} from '@/models/project-model.js';
import {useRootStore} from '@/stores/root-store';
import {databaseInsertService} from '@/services/database/database-insert-service';
import {notificationService} from '@/services/notification-service';
import {projectLogoService} from '@/services/project-logo-service';
import {generateExtraStructure} from '@/services/project-extra-service';
import projectMappingService from '@/services/project-mapping-service';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import projectJSONSchema from '@/schemas/project.schema.json';
import {errorsService} from '@/services/errors-service';
import {Filesystem, Directory} from '@capacitor/filesystem';
//imp: router gets passed because is available only in setup()

export async function importProject(file, router) {

    /**
     * Normalizes input: accepts File, String, or Object.
     * Always returns { data: ... }
     */
    const _normalizeProjectData = async (input) => {
        let raw;

        if (input instanceof File || input instanceof Blob) {
            // Modern browsers: .text() is built-in and returns a promise
            raw = await input.text();
        } else {
            raw = input;
        }

        // If it's already an object, we skip parsing. If it's a string, we parse.
        const json = typeof raw === 'string' ? JSON.parse(raw) : raw;

        if (!json || typeof json !== 'object') throw new Error('Invalid JSON input');

        // Return the envelope: use .data if it exists, otherwise the whole object
        return json.data ? { data: json.data } : { data: json };
    };

    /**
     * Precision Sanitizer
     * Only targets user-facing text fields, avoiding 'regex', 'ref', and 'id'.
     */
    const _sanitiseAngleBrackets = (data) => {
        if (Array.isArray(data)) {
            return data.map((item) => _sanitiseAngleBrackets(item));
        }

        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                // SKIP sanitization for logic-heavy keys
                const skipKeys = ['regex', 'ref', 'id', 'type', 'pattern', '$schema'];

                if (skipKeys.includes(key)) {
                    result[key] = value;
                } else if (typeof value === 'string') {
                    // Sanitize only strings in allowed keys
                    result[key] = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                } else {
                    // Recurse for nested objects/arrays
                    result[key] = _sanitiseAngleBrackets(value);
                }
            }
            return result;
        }
        return data;
    };

    /**
     * Strict 2026 Emoji Detection.
     * Uses Unicode Property Escapes to catch all pictographic symbols.
     */
    /**
     * Strict Emoji Detection compatible with more JS engines.
     * Catches characters that are intended to be rendered as emojis.
     */
    const _containsEmoji = (str) => {
        if (typeof str !== 'string') return false;

        // Fallback to Emoji_Presentation if Extended_Pictographic fails
        try {
            const regex = /\p{Emoji_Presentation}/u;
            return regex.test(str);
        } catch (e) {
            // Absolute fallback for very restrictive environments:
            // A manual range that covers the bulk of modern emojis
            const fallbackRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
            return fallbackRegex.test(str);
        }
    };

    const _performDeepValidation = (projectData) => {
        const data = projectData.data;
        const project = data.project;

        // 1. Cross-Field Equality
        if (data.id !== project.ref) {
            throw new Error('<strong>Validation Error</strong><br/>ID Mismatch: data.id must be identical to project.ref.');
        }

        const validateText = (text, fieldName) => {
            if (_containsEmoji(text)) {
                throw new Error(`<strong>Validation Error</strong><br/>Emoji detected in ${fieldName}.<br/>Special icons are strictly forbidden.`);
            }
        };

        // 2. Project Meta-data Checks
        validateText(project.name, 'Project Name');
        validateText(project.slug, 'Project Slug');
        validateText(project.small_description, 'Small Description');
        validateText(project.description, 'Project Description');

        let totalSearchInputs = 0;

        /**
         * Helper to validate a specific "Collection Level" (Main Form or a Branch)
         * This ensures titles are reset for branches but summed for groups.
         */
        const validateCollection = (inputs, scopeName) => {
            let titleCount = 0;
            let inputCount = 0;

            // 1. THE "NO INPUTS" CHECK
            if (!inputs || inputs.length === 0) {
                throw new Error(`<strong>Validation Error</strong><br/>${scopeName} has no inputs. A form must contain at least one question.`);
            }

            const walk = (list) => {
                list.forEach((input) => {
                    inputCount++;

                    // Text & Emoji Checks
                    validateText(input.question, `Question (${input.ref})`);
                    if (input.default) validateText(input.default, `Default value in ${input.ref}`);
                    input.possible_answers.forEach((ans) => {
                        validateText(ans.answer, `Answer option in ${input.ref}`);
                    });

                    // Title Logic: Count for THIS scope
                    if (input.is_title) titleCount++;

                    // Search Logic: Global count across whole project
                    if (['searchsingle', 'searchmultiple'].includes(input.type)) {
                        totalSearchInputs++;
                    }

                    // RECURSION
                    if (input.type === 'branch' && input.branch?.length) {
                        // RESET: Branches are new collections, validate them independently
                        validateCollection(input.branch, `Branch (${input.ref})`);
                    } else if (input.type === 'group' && input.group?.length) {
                        // CONTINUE: Groups share the parent's title/input allowance
                        walk(input.group);
                    }
                });
            };

            walk(inputs);

            if (titleCount > 3) {
                throw new Error(`<strong>Limit Exceeded</strong><br/>${scopeName} has ${titleCount} titles (Max: 3).`);
            }
            if (inputCount > 300) {
                throw new Error(`<strong>Limit Exceeded</strong><br/>${scopeName} has ${inputCount} inputs (Max: 300).`);
            }
        };

        // 3. Start validation for each top-level form
        project.forms.forEach((form) => {
            validateText(form.name, `Form Name (${form.name})`);
            validateCollection(form.inputs, `Form "${form.name}"`);
        });

        // 4. Project-wide search limit (not scoped to branches)
        if (totalSearchInputs > 5) {
            throw new Error(`<strong>Limit Exceeded</strong><br/>Project has ${totalSearchInputs} search inputs (Max: 5).`);
        }

        return true;
    };

    const rootStore = useRootStore();

    await notificationService.showProgressDialog(
        STRINGS[rootStore.language].labels.wait,
        STRINGS[rootStore.language].labels.loading_project
    );

    return new Promise((resolve, _reject) => {
        (async () => {
            try {
                let content = await _normalizeProjectData(file);

                // Sanitize angle brackets to prevent schema validation failures due to "^[^<>]*$" pattern
                content = _sanitiseAngleBrackets(content);

                // 1. Initialize Ajv
                const ajv = new Ajv({
                    allErrors: true,
                    verbose: true,
                    // This allows AJV to recognize the $schema tag in your file
                    dynamicRef: true
                });

                addFormats(ajv);

                const validator = ajv.compile(projectJSONSchema);
                // 2. Perform Validation
                const valid = validator(content);

                if (!valid) {
                    // Ajv provides a detailed array of why it failed
                    console.error('Schema Validation Errors:', validator.errors);
                    // Throw a pretty error for the User/UI
                    const prettyError = errorsService.formatAjvError(validator.errors);
                    throw new Error(prettyError);
                }

                _performDeepValidation(content);

                // notificationService.showToast(
                //     'validation_successful' in STRINGS[rootStore.language].status_codes
                //         ? STRINGS[rootStore.language].status_codes.validation_successful
                //         : 'Validation successful. Processing project...'
                // );
                // resolve();


                const projectDefinition = content.data;
                //generate project extra structure from project data
                const projectExtra = generateExtraStructure(projectDefinition);
                //generate project mapping structure from project data
                const projectMapping = projectMappingService.createEC5AUTOMapping(projectExtra);

                //generate project extra structure
                projectDefinition.meta = {};
                projectDefinition.meta.project_extra = projectExtra;
                projectDefinition.meta.project_mapping = [projectMapping];

                // Load project extra structure into project model
                projectModel.loadExtraStructure(projectDefinition.meta.project_extra);
                // Remove project model
                projectModel.destroy();

                // Extract project metadata
                const project = projectDefinition.project;

                try {
                    //insert project to sqlite database
                    await databaseInsertService.insertProject(
                        project.slug,
                        project.name,
                        project.ref,
                        JSON.stringify(projectDefinition.meta.project_extra),
                        '', // We clear server_url for imported projects as they are local-only
                        projectDefinition.meta.project_stats?.structure_last_updated,
                        JSON.stringify(projectDefinition.meta.project_mapping)
                    );

                    try {
                        // Generate and Save Logo
                        await projectLogoService.generateLocally(project.name, project.ref);

                        window.setTimeout(function () {
                            rootStore.wasProjectImportedFromFile = true;
                            notificationService.hideProgressDialog();
                            notificationService.showToast(
                                STRINGS[rootStore.language].status_codes.ec5_112
                            );
                            router.replace({
                                name: PARAMETERS.ROUTES.PROJECTS,
                                query: {refresh: true}
                            });
                            resolve();
                        }, PARAMETERS.DELAY_MEDIUM);
                    } catch (error) {
                        // Logo download failed — continue without blocking
                        notificationService.showToast(
                            STRINGS[rootStore.language].status_codes.ec5_138
                        );

                        window.setTimeout(function () {
                            notificationService.hideProgressDialog();
                            notificationService.showToast(
                                STRINGS[rootStore.language].status_codes.ec5_112
                            );
                            router.replace({
                                name: PARAMETERS.ROUTES.PROJECTS,
                                query: {refresh: false}
                            });
                            resolve();
                        }, PARAMETERS.DELAY_MEDIUM);
                    }
                } catch (error) {
                    let errorCode = DB_ERRORS[error.code];
                    // Project already exists error
                    if (errorCode === 'ec5_109') {
                        errorCode = 'ec5_111';
                    }
                    notificationService.hideProgressDialog();
                    await notificationService.showAlert(
                        STRINGS[rootStore.language].status_codes[errorCode]
                    );
                    resolve();
                }

            } catch (error) {
                console.error('Import Project Error:', error);
                notificationService.hideProgressDialog();
                // Show a friendly message for parsing/IO errors or unexpected structure
                const msg = error?.message || error;
                await notificationService.showAlert(msg);
                resolve();
            }
        })();
    });
}
