import * as services from '@/services';
import { PARAMETERS } from '@/config';
import { STRINGS } from '@/config/strings';
import { projectModel } from '@/models/project-model.js';
import { useRootStore } from '@/stores/root-store';

export function setupPWAEntry () {
    let formRef;
    let parentFormRef;
    let parentEntryUuid;
    const rootStore = useRootStore();
    const searchParams = rootStore.searchParams;

    if (searchParams.has('form_ref') && searchParams.has('parent_form_ref') && searchParams.has('parent_uuid')) {
        formRef = searchParams.get('form_ref');
        parentFormRef = searchParams.get('parent_form_ref');
        parentEntryUuid = searchParams.get('parent_uuid');
    }
    else {
        formRef = projectModel.getFirstFormRef();
        parentFormRef = '';
        parentEntryUuid = '';
    }

    services.entryService.setUpNew(formRef, parentEntryUuid, parentFormRef);

    return formRef;
}
