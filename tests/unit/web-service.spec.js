import { vi } from 'vitest';
import axios from 'axios';
import { webService } from '@/services/web-service';
import { useRootStore } from '@/stores/root-store';
import { projectModel } from '@/models/project-model';
import { useDBStore } from '@/stores/db-store';
import { setActivePinia, createPinia } from 'pinia';
import { PARAMETERS } from '@/config';

vi.mock('axios');

describe('POST requestAccountDeletion()', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
        axios.mockReset();
    });

    it('performed deletion, user with NO roles', async () => {

        const dbStore = useDBStore();
        axios.mockResolvedValue({
            data: {
                data: {
                    'id': 'account-deletion-performed',
                    'deleted': true
                }
            }
        });
        dbStore.db.transaction = vi.fn();
        projectModel.getServerUrl = vi.fn().mockReturnValue(PARAMETERS.DEFAULT_SERVER_URL);
        webService.getHeaders = vi.fn().mockResolvedValue({});

        const apiProdEndpoint = PARAMETERS.DEFAULT_SERVER_URL + PARAMETERS.API.ROUTES.ROOT;
        const postURL = apiProdEndpoint + PARAMETERS.API.ROUTES.ACCOUNT_DELETION;
        const response = await webService.requestAccountDeletion();
        expect(axios).toHaveBeenCalledTimes(1);
        console.log('response:', response);
        expect(axios).toHaveBeenCalledWith(
            {
                method: 'POST',
                url: postURL,
                headers: {}
            });
        expect(response.data.data.deleted).toBe(true);
        expect(response.data.data.id).toBe('account-deletion-performed');
    });

    // it('requested deletion, user with some roles', () => {
    //     //todo:

    //     // axios.get.mockResolvedValue({
    //     //     data: {
    //     //         data: {
    //     //             'id': 'account-deletion-requested',
    //     //             'accepted': true
    //     //         }
    //     //     }
    //     // });
    // });
});

