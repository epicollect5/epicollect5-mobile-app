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
