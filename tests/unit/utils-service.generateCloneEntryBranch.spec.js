import {utilsService} from '@/services/utilities/utils-service';
import {PARAMETERS} from '@/config';
import {setActivePinia, createPinia} from 'pinia';
import {vi} from 'vitest';
import {projectModel} from '@/models/project-model';

describe('generateCloneEntryBranch', () => {
    beforeEach(() => {
        // creates a fresh pinia and make it active so it's automatically picked
        // up by any useStore() call without having to pass it to it:
        // `useStore(pinia)`
        setActivePinia(createPinia());
    });

    it('should generate a valid cloned branch entry', () => {

        const uuid = utilsService.uuid();
        const sourceEntry = {
            entryUuid: uuid,
            parentEntryUuid: '',
            isRemote: 0,
            synced: 0,
            canEdit: 1,
            createdAt: '2026-01-28T17:45:04.000Z',
            title: 'Mirko',
            formRef: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521',
            parentFormRef: '',
            projectRef: '71bf7f354d9149e69841432e06fed1ee',
            branchEntries: {},
            media: {},
            uniqueAnswers: {},
            syncedError: '',
            isBranch: false,
            verifyAnswers: {},
            answers: {
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a42b992b': {
                    was_jumped: false,
                    answer: 'Mirko'
                },
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c': {
                    was_jumped: false,
                    answer: utilsService.generateMediaFilename(uuid, PARAMETERS.QUESTION_TYPES.PHOTO)
                },
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d': {
                    was_jumped: false,
                    answer: utilsService.generateMediaFilename(uuid, PARAMETERS.QUESTION_TYPES.AUDIO)
                },
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e': {
                    was_jumped: false,
                    answer: utilsService.generateMediaFilename(uuid , PARAMETERS.QUESTION_TYPES.VIDEO)
                },
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f': {
                    was_jumped: false,
                    answer: ''
                }
            }
        };

        projectModel.getExtraForm = vi.fn().mockReturnValue({
            group: [],
            lists: {location_inputs: [], multiple_choice_inputs: {form: {order: []}, branch: []}},
            branch: {'71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f': ['71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a72b9930', '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a78b9931']},
            inputs: ['71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a42b992b', '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c', '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d', '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e', '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f'],
            details: {
                ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521',
                name: 'Form One',
                slug: 'form-one',
                type: 'hierarchy',
                inputs: [{
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a42b992b',
                    type: 'text',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: true,
                    question: 'Name',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }, {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c',
                    type: 'photo',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Photo Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }, {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d',
                    type: 'audio',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Audio Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }, {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e',
                    type: 'video',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Video Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }, {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f',
                    type: 'branch',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [{
                        max: null,
                        min: null,
                        ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a72b9930',
                        type: 'text',
                        group: [],
                        jumps: [],
                        regex: null,
                        branch: [],
                        verify: false,
                        default: null,
                        is_title: true,
                        question: 'Name',
                        uniqueness: 'none',
                        is_required: false,
                        datetime_format: null,
                        possible_answers: [],
                        set_to_current_datetime: false
                    }, {
                        max: '',
                        min: '',
                        ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a78b9931',
                        type: 'integer',
                        group: [],
                        jumps: [],
                        regex: '',
                        branch: [],
                        verify: false,
                        default: '',
                        is_title: true,
                        question: 'Age',
                        uniqueness: 'none',
                        is_required: false,
                        datetime_format: null,
                        possible_answers: [],
                        set_to_current_datetime: false
                    }],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Family Members',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }],
                has_location: false
            }
        });
        projectModel.getExtraInputs = vi.fn().mockReturnValue({
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a42b992b': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a42b992b',
                    type: 'text',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: true,
                    question: 'Name',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c',
                    type: 'photo',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Photo Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d',
                    type: 'audio',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Audio Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e',
                    type: 'video',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Video Question',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f',
                    type: 'branch',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: false,
                    question: 'Family Members',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a72b9930': {
                data: {
                    max: null,
                    min: null,
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a72b9930',
                    type: 'text',
                    group: [],
                    jumps: [],
                    regex: null,
                    branch: [],
                    verify: false,
                    default: null,
                    is_title: true,
                    question: 'Name',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            },
            '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a78b9931': {
                data: {
                    max: '',
                    min: '',
                    ref: '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f_697a4a78b9931',
                    type: 'integer',
                    group: [],
                    jumps: [],
                    regex: '',
                    branch: [],
                    verify: false,
                    default: '',
                    is_title: true,
                    question: 'Age',
                    uniqueness: 'none',
                    is_required: false,
                    datetime_format: null,
                    possible_answers: [],
                    set_to_current_datetime: false
                }
            }
        });
        projectModel.getProjectRef = vi.fn().mockReturnValue('71bf7f354d9149e69841432e06fed1ee');
        projectModel.getFormIndex = vi.fn().mockReturnValue(0);
        projectModel.getMediaQuestions = vi.fn().mockReturnValue(
            [
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c',
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d',
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e'
            ]);
        projectModel.getFormBranches = vi.fn().mockReturnValue(
            [
                '71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4db992f'
            ]);
        projectModel.getFormName = vi.fn().mockReturnValue('Form One');

        const clonedEntry = utilsService.generateCloneEntryBranch(sourceEntry);

        expect(clonedEntry.entryUuid).not.toEqual(sourceEntry.entryUuid);
        expect(clonedEntry.createdAt).not.toEqual(sourceEntry.createdAt);
        expect(clonedEntry.updatedAt).not.toEqual(sourceEntry.updatedAt);
        expect(clonedEntry.synced).toEqual(PARAMETERS.SYNCED_CODES.UNSYNCED);
        expect(clonedEntry.canEdit).toEqual(PARAMETERS.EDIT_CODES.CAN);
        expect(clonedEntry.isRemote).toEqual(PARAMETERS.REMOTE_CODES.ISNT);
        expect(clonedEntry.syncedError).toEqual('');

        //assert media question answers are set to empty string
        expect(clonedEntry.answers['71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a49b992c'].answer).toEqual('');
        expect(clonedEntry.answers['71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4ab992d'].answer).toEqual('');
        expect(clonedEntry.answers['71bf7f354d9149e69841432e06fed1ee_697a4a3975521_697a4a4cb992e'].answer).toEqual('');

        //assert branch entries are empty
        expect(clonedEntry.branchEntries).toEqual({});

        //assert media object is empty
        expect(clonedEntry.media).toEqual({});
    });
});
