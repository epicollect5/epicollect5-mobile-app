import { utilsService } from '@/services/utilities/utils-service';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model';
import { setActivePinia, createPinia } from 'pinia';
import { answerService } from '@/services/entry/answer-service';
import { questionCommonService } from '@/services/entry/question-common-service';
import { useRootStore } from '@/stores/root-store';
import { vi } from 'vitest';



//mock nested modules until it fixes "Failed to load /src/components/HeaderModal"
vi.mock('@/services/errors-service', () => {
    const errorsService = vi.fn();
    return { errorsService };
});

vi.mock('@/models/project-model', () => {
    const projectModel = vi.fn();
    projectModel.getExtraInputs = vi.fn();
    projectModel.getFormGroups = vi.fn();
    projectModel.getProjectRef = vi.fn();
    projectModel.getInputIndexFromRef = vi.fn();
    return { projectModel };
});

const projectRef = 'a8a6536ead2a43fbb64a43b95c5425fe';
const formRef = 'a8a6536ead2a43fbb64a43b95c5425fe_6399fd6ad9115';
const entryService = {};
entryService.entry = {};
entryService.entry.formRef = formRef;

const entryUuid = 'b692302d-5d5e-4a77-9b15-1dc01fb196eb';
const parentEntryUuid = '85acd4b8-5a59-48e6-b8c1-7d0486865f97';
const ownerEntryUuid = '3010f06f-2dec-48ea-8ec6-e467e8827594';
const ownerInputRef = 'a8a6536ead2a43fbb64a43b95c5425fe_6399fd6ad9115_639a03e677826';
const inputIndex = 3;


describe('getNavigationParams (app)', () => {

    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it(PARAMETERS.ENTRY_EDIT + ' hierarchy parent app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_EDIT;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_VIEW,
            routeParams: {
                entryUuid,
                formRef,
                projectRef,
                parentEntryUuid: ''
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' hierarchy parent pwa', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        entryService.action = PARAMETERS.ENTRY_EDIT;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.PWA_QUIT,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' hierarchy parent app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        console.log(questionCommonService.getNavigationParams(entryService));
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' hierarchy parent pwa', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        console.log(questionCommonService.getNavigationParams(entryService));
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.PWA_QUIT,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' hierarchy child app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        console.log(questionCommonService.getNavigationParams(entryService));
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' hierarchy child pwa', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        console.log(questionCommonService.getNavigationParams(entryService));
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.PWA_QUIT,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' hierarchy child app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_EDIT;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = parentEntryUuid;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_VIEW,
            routeParams: {
                entryUuid,
                formRef,
                projectRef,
                parentEntryUuid
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' hierarchy child pwa', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_EDIT;
        entryService.entry.isBranch = false;
        entryService.entry.parentEntryUuid = parentEntryUuid;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_VIEW,
            routeParams: {
                entryUuid,
                formRef,
                projectRef,
                parentEntryUuid
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' branch app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);
        console.log(questionCommonService.getNavigationParams(entryService));


        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_ADD,
            routeParams: {
                formRef,
                projectRef,
                inputRef: ownerInputRef,
                inputIndex,
                isBranch: false
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' branch pwa local', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_LOCAL;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);
        console.log(questionCommonService.getNavigationParams(entryService));


        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_ADD,
            routeParams: {
                formRef,
                projectRef,
                inputRef: ownerInputRef,
                inputIndex,
                isBranch: false
            }
        });
    });

    it(PARAMETERS.ENTRY_ADD + ' branch pwa remote', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);

        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.PWA_QUIT,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' branch app', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = false;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);
        console.log(questionCommonService.getNavigationParams(entryService));

        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_ADD,
            routeParams: {
                formRef,
                projectRef,
                inputRef: ownerInputRef,
                inputIndex,
                isBranch: false
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' branch pwa local', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_LOCAL;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);
        console.log(questionCommonService.getNavigationParams(entryService));

        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.ENTRIES_ADD,
            routeParams: {
                formRef,
                projectRef,
                inputRef: ownerInputRef,
                inputIndex,
                isBranch: false
            }
        });
    });

    it(PARAMETERS.ENTRY_EDIT + ' branch pwa remote', () => {

        const rootStore = useRootStore();
        rootStore.isPWA = true;
        rootStore.branchEditType = PARAMETERS.PWA_BRANCH_REMOTE;
        entryService.action = PARAMETERS.ENTRY_ADD;
        entryService.entry.isBranch = true;
        entryService.entry.parentEntryUuid = '';
        entryService.entry.ownerInputRef = ownerInputRef;
        entryService.entry.entryUuid = entryUuid;

        projectModel.getProjectRef.mockReturnValue(projectRef);
        projectModel.getInputIndexFromRef.mockReturnValue(inputIndex);
        console.log(questionCommonService.getNavigationParams(entryService));

        expect(questionCommonService.getNavigationParams(entryService)).toMatchObject({
            routeName: PARAMETERS.ROUTES.PWA_QUIT,
            routeParams: {
                formRef,
                projectRef
            }
        });
    });
});