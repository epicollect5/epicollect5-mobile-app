import { describe, it, expect } from 'vitest';
import projectExtraService from '@/services/project-extra-service';

describe('Project Extra Service', () => {
    const mockProject = {
        data: {
            project: {
                ref: 'pro_123',
                name: 'Test Project',
                slug: 'test-project',
                access: 'public',
                status: 'active',
                visibility: 'listed',
                category: 'social',
                forms: [
                    {
                        ref: 'for_123',
                        name: 'Form 1',
                        slug: 'form-1',
                        inputs: [
                            {
                                ref: 'inp_1',
                                type: 'text',
                                question: 'Question 1',
                                group: [],
                                branch: []
                            },
                            {
                                ref: 'inp_2',
                                type: 'location',
                                question: 'Location 1',
                                group: [],
                                branch: []
                            },
                            {
                                ref: 'inp_3',
                                type: 'radio',
                                question: 'Radio 1',
                                possible_answers: [
                                    { answer: 'Yes', answer_ref: 'ans_1' },
                                    { answer: 'No', answer_ref: 'ans_2' }
                                ],
                                group: [],
                                branch: []
                            }
                        ]
                    }
                ]
            }
        }
    };

    it('should generate extra structure correctly for a simple project', () => {
        const result = projectExtraService.generateExtraStructure(mockProject);

        expect(result.project.details.ref).toBe('pro_123');
        expect(result.forms['for_123']).toBeDefined();
        expect(result.forms['for_123'].inputs).toContain('inp_1');
        expect(result.forms['for_123'].inputs).toContain('inp_2');
        expect(result.forms['for_123'].inputs).toContain('inp_3');

        // Check location inputs
        expect(result.forms['for_123'].lists.location_inputs).toHaveLength(1);
        expect(result.forms['for_123'].lists.location_inputs[0].input_ref).toBe('inp_2');

        // Check multiple choice inputs
        expect(result.forms['for_123'].lists.multiple_choice_inputs.form.order).toContain('inp_3');
        expect(result.forms['for_123'].lists.multiple_choice_inputs.form['inp_3'].possible_answers['ans_1']).toBe('Yes');

        // Check inputs extra
        expect(result.inputs['inp_1'].data.question).toBe('Question 1');
    });

    it('should handle unwrapped project definition', () => {
        const unwrapped = {
            project: mockProject.data.project
        };
        const result = projectExtraService.generateExtraStructure(unwrapped);
        expect(result.project.details.ref).toBe('pro_123');
    });

    it('should handle groups and nested location/MC inputs', () => {
        const projectWithGroup = {
            project: {
                ...mockProject.data.project,
                forms: [
                    {
                        ref: 'for_123',
                        name: 'Form 1',
                        slug: 'form-1',
                        inputs: [
                            {
                                ref: 'grp_1',
                                type: 'group',
                                question: 'Group 1',
                                group: [
                                    {
                                        ref: 'inp_g1',
                                        type: 'location',
                                        question: 'Group Location',
                                        group: [],
                                        branch: []
                                    },
                                    {
                                        ref: 'inp_g2',
                                        type: 'checkbox',
                                        question: 'Group Checkbox',
                                        possible_answers: [
                                            { answer: 'A', answer_ref: 'ans_a' }
                                        ],
                                        group: [],
                                        branch: []
                                    }
                                ],
                                branch: []
                            }
                        ]
                    }
                ]
            }
        };

        const result = projectExtraService.generateExtraStructure(projectWithGroup);

        expect(result.forms['for_123'].group['grp_1']).toEqual(['inp_g1', 'inp_g2']);
        expect(result.forms['for_123'].lists.location_inputs).toHaveLength(1);
        expect(result.forms['for_123'].lists.location_inputs[0].input_ref).toBe('inp_g1');

        // MC inputs in a top-level group go into the *form* bucket
        expect(result.forms['for_123'].lists.multiple_choice_inputs.form.order).toContain('inp_g2');
        expect(result.forms['for_123'].lists.multiple_choice_inputs.form['inp_g2']).toBeDefined();
    });

    it('should handle branches and nested inputs', () => {
        const projectWithBranch = {
            project: {
                ...mockProject.data.project,
                forms: [
                    {
                        ref: 'for_123',
                        name: 'Form 1',
                        slug: 'form-1',
                        inputs: [
                            {
                                ref: 'bra_1',
                                type: 'branch',
                                question: 'Branch 1',
                                branch: [
                                    {
                                        ref: 'inp_b1',
                                        type: 'location',
                                        question: 'Branch Location',
                                        group: [],
                                        branch: []
                                    },
                                    {
                                        ref: 'inp_b2',
                                        type: 'dropdown',
                                        question: 'Branch Dropdown',
                                        possible_answers: [
                                            { answer: 'Opt 1', answer_ref: 'ans_o1' }
                                        ],
                                        group: [],
                                        branch: []
                                    }
                                ],
                                group: []
                            }
                        ]
                    }
                ]
            }
        };

        const result = projectExtraService.generateExtraStructure(projectWithBranch);

        expect(result.forms['for_123'].branch['bra_1']).toEqual(['inp_b1', 'inp_b2']);

        // Location in branch: PHP uses parent branch ref as input_ref, and location ref as branch_ref
        expect(result.forms['for_123'].lists.location_inputs).toHaveLength(1);
        expect(result.forms['for_123'].lists.location_inputs[0].input_ref).toBe('bra_1');
        expect(result.forms['for_123'].lists.location_inputs[0].branch_ref).toBe('inp_b1');

        // MC in branch goes to branch bucket keyed by branch ref
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_1']).toBeDefined();
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_1'].order).toContain('inp_b2');
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_1']['inp_b2'].question).toBe('Branch Dropdown');
    });

    it('should handle group inside branch', () => {
        const projectWithGroupInBranch = {
            project: {
                ...mockProject.data.project,
                forms: [
                    {
                        ref: 'for_123',
                        name: 'Form 1',
                        slug: 'form-1',
                        inputs: [
                            {
                                ref: 'bra_1',
                                type: 'branch',
                                question: 'Branch 1',
                                branch: [
                                    {
                                        ref: 'grp_1',
                                        type: 'group',
                                        question: 'Group in Branch',
                                        group: [
                                            {
                                                ref: 'inp_bg1',
                                                type: 'location',
                                                question: 'BG Location',
                                                group: [],
                                                branch: []
                                            }
                                        ],
                                        branch: []
                                    }
                                ],
                                group: []
                            }
                        ]
                    }
                ]
            }
        };

        const result = projectExtraService.generateExtraStructure(projectWithGroupInBranch);

        expect(result.forms['for_123'].branch['bra_1']).toContain('grp_1');
        expect(result.forms['for_123'].group['grp_1']).toContain('inp_bg1');

        // Location in group in branch
        expect(result.forms['for_123'].lists.location_inputs).toHaveLength(1);
        expect(result.forms['for_123'].lists.location_inputs[0].input_ref).toBe('inp_bg1');
        expect(result.forms['for_123'].lists.location_inputs[0].branch_ref).toBe('grp_1');
    });

    it('should handle branch inside group (form[*][group][*][branch][*])', () => {
        const projectWithBranchInGroup = {
            project: {
                ...mockProject.data.project,
                forms: [
                    {
                        ref: 'for_123',
                        name: 'Form 1',
                        slug: 'form-1',
                        inputs: [
                            {
                                ref: 'grp_1',
                                type: 'group',
                                question: 'Group 1',
                                group: [
                                    {
                                        ref: 'bra_g1',
                                        type: 'branch',
                                        question: 'Branch in Group',
                                        branch: [
                                            {
                                                ref: 'inp_gb1',
                                                type: 'location',
                                                question: 'GB Location',
                                                group: [],
                                                branch: []
                                            },
                                            {
                                                ref: 'inp_gb2',
                                                type: 'radio',
                                                question: 'GB Radio',
                                                possible_answers: [
                                                    { answer: 'Yes', answer_ref: 'ans_y' },
                                                    { answer: 'No', answer_ref: 'ans_n' }
                                                ],
                                                group: [],
                                                branch: []
                                            }
                                        ],
                                        group: []
                                    }
                                ],
                                branch: []
                            }
                        ]
                    }
                ]
            }
        };

        const result = projectExtraService.generateExtraStructure(projectWithBranchInGroup);

        // The branch ref should appear in the parent group's children
        expect(result.forms['for_123'].group['grp_1']).toContain('bra_g1');

        // The branch's child refs should be registered under branches
        expect(result.forms['for_123'].branch['bra_g1']).toEqual(['inp_gb1', 'inp_gb2']);

        // Branch children should be in inputsExtra
        expect(result.inputs['inp_gb1']).toBeDefined();
        expect(result.inputs['inp_gb2']).toBeDefined();

        // Location inside branch inside group: input_ref = parent branch ref, branch_ref = location ref
        expect(result.forms['for_123'].lists.location_inputs).toHaveLength(1);
        expect(result.forms['for_123'].lists.location_inputs[0].input_ref).toBe('bra_g1');
        expect(result.forms['for_123'].lists.location_inputs[0].branch_ref).toBe('inp_gb1');

        // MC input inside branch inside group goes to branch MC bucket
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_g1']).toBeDefined();
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_g1'].order).toContain('inp_gb2');
        expect(result.forms['for_123'].lists.multiple_choice_inputs.branch['bra_g1']['inp_gb2'].question).toBe('GB Radio');
    });
});

