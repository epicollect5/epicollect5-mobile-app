import { defineStore } from 'pinia';
import { PARAMETERS } from '@/config';

export const useDBStore = defineStore('DBStore', {
    state: () => {
        return {
            db: {},
            dbVersion: 0,
            dbEntriesOrder: {
                field: PARAMETERS.DEFAULT_ORDERING_COLUMN,
                sortType: PARAMETERS.DEFAULT_ORDERING
            }
        };
    },
    getters: {

    },
    actions: {}
});