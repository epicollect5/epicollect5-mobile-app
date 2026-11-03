import { describe, it, expect, beforeEach, vi } from 'vitest';
import { projectModel } from '@/models/project-model.js';

vi.mock('@/stores/root-store', () => ({
    useRootStore: vi.fn(() => ({}))
}));

function seedProjectExtra() {
    projectModel.project_extra = {
        forms: {
            'form-1': {
                branch: {
                    'branch-owner': ['branch-photo', 'branch-text', 'branch-group']
                },
                group: {
                    'branch-group': ['group-audio', 'group-text']
                }
            }
        },
        inputs: {
            'branch-photo': { data: { type: 'photo', ref: 'branch-photo' } },
            'branch-text': { data: { type: 'text', ref: 'branch-text' } },
            'branch-group': { data: { type: 'group', ref: 'branch-group' } },
            'group-audio': { data: { type: 'audio', ref: 'group-audio' } },
            'group-text': { data: { type: 'text', ref: 'group-text' } }
        }
    };
}

describe('projectModel.getBranchMediaQuestions', () => {

    beforeEach(() => {
        seedProjectExtra();
    });

    it('returns direct and group-nested media refs for the branch', () => {
        expect(projectModel.getBranchMediaQuestions('form-1', 'branch-owner'))
            .toEqual(['branch-photo', 'group-audio']);
    });

    it('returns an empty array for an unknown branch', () => {
        expect(projectModel.getBranchMediaQuestions('form-1', 'no-such-branch'))
            .toEqual([]);
    });
});

describe('projectModel form refs with missing project', () => {

    beforeEach(() => {
        projectModel.project_extra = {};
    });

    it('returns empty string for first, last, next and parent form refs', () => {
        expect(projectModel.getFirstFormRef()).toBe('');
        expect(projectModel.getLastFormRef()).toBe('');
        expect(projectModel.getNextFormRef('form-1')).toBe('');
        expect(projectModel.getParentFormRef('form-1')).toBe('');
    });

    it('returns 0 for form index', () => {
        expect(projectModel.getFormIndex('form-1')).toBe(0);
    });

    it('returns empty string when project has no forms', () => {
        projectModel.project_extra = { project: {} };
        expect(projectModel.getFirstFormRef()).toBe('');
        expect(projectModel.getLastFormRef()).toBe('');
        expect(projectModel.getNextFormRef('form-1')).toBe('');
        expect(projectModel.getParentFormRef('form-1')).toBe('');
        expect(projectModel.getFormIndex('form-1')).toBe(0);
    });
});

describe('projectModel form refs in order', () => {

    beforeEach(() => {
        projectModel.project_extra = { project: { forms: ['form-1', 'form-2', 'form-3'] } };
    });

    it('resolves first, last, next, parent and index', () => {
        expect(projectModel.getFirstFormRef()).toBe('form-1');
        expect(projectModel.getLastFormRef()).toBe('form-3');
        expect(projectModel.getNextFormRef('form-1')).toBe('form-2');
        expect(projectModel.getNextFormRef('form-3')).toBe('');
        expect(projectModel.getParentFormRef('form-2')).toBe('form-1');
        expect(projectModel.getParentFormRef('form-1')).toBe('');
        expect(projectModel.getFormIndex('form-2')).toBe(1);
        expect(projectModel.getFormIndex('unknown')).toBe(0);
    });
});
