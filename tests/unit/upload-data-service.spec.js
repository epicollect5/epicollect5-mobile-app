import { vi } from 'vitest';
import axios from 'axios';
import { useDBStore } from '@/stores/db-store';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';
import { uploadDataService } from '@/services/upload-data-service';
import { utilsService } from '@/services/utilities/utils-service';
import { databaseUpdateService } from '@/services/database/database-update-service';

vi.mock('axios');

vi.mock('@/services/database/database-update-service', () => {
    const databaseUpdateService = vi.fn();
    return { databaseUpdateService };
});

describe('uploadDataService.handleUploadError()', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        axios.mockReset();
    });

    it('catches unknown upload error', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();

        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {};

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toBeUndefined();
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;
        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toBeUndefined();
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();


    });

    it('ec5_11 project does not exist', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_11',
                    source: 'upload-controller',
                    title: 'Project does not exist.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_50 Could not generate JWT.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_50',
                    source: 'upload-controller',
                    title: 'Could not generate JWT.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_51 Could not verify JWT.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_51',
                    source: 'upload-controller',
                    title: 'Could not verify JWT.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_70 Please log in to access this project.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_70',
                    source: 'upload-controller',
                    title: 'Please log in to access this project.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_71 You need permission to view this project from the project manager.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_71',
                    source: 'upload-controller',
                    title: 'You need permission to view this project from the project manager.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_77 You need permission to view this project from the project manager.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_77',
                    source: 'upload-controller',
                    title: 'This project is private. Please log in.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_78 This project is private. You need permission to access it from the project manager.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_78',
                    source: 'upload-controller',
                    title: 'This project is private. You need permission to access it from the project manager.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_116 Server error, please try again later.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_116',
                    source: 'upload-controller',
                    title: 'Server error, please try again later.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_103 Unknown error', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_103',
                    source: 'upload-controller',
                    title: 'Unknown error.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_201 Project version out of date', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_201',
                    source: 'upload-controller',
                    title: 'Project version out of date.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_202 project locked', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_202',
                    source: 'upload-controller',
                    title: 'This project is locked.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });

    it('ec5_255 Too many requests have been made. Please try again later.', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn();


        const entryUuid = utilsService.uuid();
        let type = PARAMETERS.ENTRY;
        const errorResponse = {
            data: {
                errors: [{
                    code: 'ec5_255',
                    source: 'upload-controller',
                    title: 'Too many requests have been made. Please try again later.'
                }]
            }
        };

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();

        type = PARAMETERS.BRANCH_ENTRY;

        expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
            .rejects.toEqual(
                { data: errorResponse.data }
            );
        expect(databaseUpdateService.updateSynced).not.toHaveBeenCalled();
    });


    it('Any other errors', async () => {

        const dbStore = useDBStore();
        dbStore.db.transaction = vi.fn();
        databaseUpdateService.updateSynced = vi.fn().mockResolvedValue();

        for (let i = 12; i < 300; i++) {

            if (PARAMETERS.UPLOAD_STOPPING_ERROR_CODES.indexOf('ec5_' + i) === -1) {

                const entryUuid = utilsService.uuid();
                let type = PARAMETERS.ENTRY;
                const errorResponse = {
                    data: {
                        errors: [{
                            code: 'ec5_' + i,
                            source: 'upload-controller',
                            title: 'ec5_xxx error'
                        }]
                    }
                };

                await expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
                    .resolves.toBeUndefined();

                expect(databaseUpdateService.updateSynced).toHaveBeenCalled();
                expect(databaseUpdateService.updateSynced).toHaveBeenCalledWith(
                    PARAMETERS.ENTRY, entryUuid, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, errorResponse.data
                );

                type = PARAMETERS.BRANCH_ENTRY;

                await expect(uploadDataService.handleUploadError(type, errorResponse, entryUuid))
                    .resolves.toBeUndefined();
                expect(databaseUpdateService.updateSynced).toHaveBeenCalledWith(
                    PARAMETERS.BRANCH_ENTRY, entryUuid, PARAMETERS.SYNCED_CODES.SYNCED_WITH_ERROR, errorResponse.data
                );
            }
        }
    });


});

