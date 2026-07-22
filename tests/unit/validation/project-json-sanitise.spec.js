import { describe, it, expect } from 'vitest';
import { projectJsonSanitise } from '@/services/validation/project-json-sanitise';
import { createMinimalProject } from './test-helpers';

describe('projectJsonSanitise', () => {
    describe('sanitizeDecimalValue', () => {
        it('adds leading zero for .5', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue('.5')).toBe('0.5');
        });

        it('adds leading zero for -.5', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue('-.5')).toBe('-0.5');
        });

        it('adds leading zero for -.78', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue('-.78')).toBe('-0.78');
        });

        it('preserves already correct decimals', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue('0.5')).toBe('0.5');
            expect(projectJsonSanitise.sanitizeDecimalValue('-0.5')).toBe('-0.5');
        });

        it('leaves non-string values unchanged', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue(0.5)).toBe(0.5);
            expect(projectJsonSanitise.sanitizeDecimalValue(null)).toBe(null);
        });

        it('leaves non-matching strings unchanged', () => {
            expect(projectJsonSanitise.sanitizeDecimalValue('5')).toBe('5');
            expect(projectJsonSanitise.sanitizeDecimalValue('5.5')).toBe('5.5');
        });
    });

    describe('sanitizeJumpsInInput', () => {
        it('removes has_valid_destination property', () => {
            const input = {
                jumps: [
                    {
                        to: 'END',
                        when: 'ALL',
                        answer_ref: null,
                        has_valid_destination: true
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.jumps[0]).not.toHaveProperty('has_valid_destination');
        });

        it('sets answer_ref to null for END+ALL jumps with empty answer_ref', () => {
            const input = {
                jumps: [
                    {
                        to: 'END',
                        when: 'ALL',
                        answer_ref: ''
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.jumps[0].answer_ref).toBe(null);
        });

        it('sets answer_ref to null for END+ALL jumps with missing answer_ref', () => {
            const input = {
                jumps: [
                    {
                        to: 'END',
                        when: 'ALL'
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.jumps[0].answer_ref).toBe(null);
        });

        it('preserves answer_ref for non-END jumps', () => {
            const input = {
                jumps: [
                    {
                        to: 'someref',
                        when: 'IS',
                        answer_ref: 'answer123'
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.jumps[0].answer_ref).toBe('answer123');
        });

        it('recursively sanitizes branch inputs', () => {
            const input = {
                branch: [
                    {
                        jumps: [
                            {
                                to: 'END',
                                when: 'ALL',
                                answer_ref: '',
                                has_valid_destination: true
                            }
                        ]
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.branch[0].jumps[0].answer_ref).toBe(null);
            expect(input.branch[0].jumps[0]).not.toHaveProperty('has_valid_destination');
        });

        it('recursively sanitizes group inputs', () => {
            const input = {
                group: [
                    {
                        jumps: [
                            {
                                to: 'END',
                                when: 'ALL',
                                answer_ref: ''
                            }
                        ]
                    }
                ]
            };
            projectJsonSanitise.sanitizeJumpsInInput(input);
            expect(input.group[0].jumps[0].answer_ref).toBe(null);
        });
    });

    describe('sanitizeDecimalInInput', () => {
        it('sanitizes decimal min value', () => {
            const input = {
                type: 'decimal',
                min: '.5'
            };
            projectJsonSanitise.sanitizeDecimalInInput(input);
            expect(input.min).toBe('0.5');
        });

        it('sanitizes decimal max value', () => {
            const input = {
                type: 'decimal',
                max: '-.78'
            };
            projectJsonSanitise.sanitizeDecimalInInput(input);
            expect(input.max).toBe('-0.78');
        });

        it('ignores non-decimal input types', () => {
            const input = {
                type: 'text',
                min: '.5'
            };
            projectJsonSanitise.sanitizeDecimalInInput(input);
            expect(input.min).toBe('.5');
        });

        it('recursively sanitizes branch decimal inputs', () => {
            const input = {
                branch: [
                    {
                        type: 'decimal',
                        min: '.25'
                    }
                ]
            };
            projectJsonSanitise.sanitizeDecimalInInput(input);
            expect(input.branch[0].min).toBe('0.25');
        });

        it('recursively sanitizes group decimal inputs', () => {
            const input = {
                group: [
                    {
                        type: 'decimal',
                        max: '-.5'
                    }
                ]
            };
            projectJsonSanitise.sanitizeDecimalInInput(input);
            expect(input.group[0].max).toBe('-0.5');
        });
    });

    describe('removeEndJumpsFromLastInput', () => {
        it('removes END jumps only from the last input in an input array', () => {
            const inputs = [
                {
                    jumps: [
                        {
                            to: 'END'
                        }
                    ]
                },
                {
                    jumps: [
                        {
                            to: 'END'
                        },
                        {
                            to: 'next-input'
                        }
                    ]
                }
            ];

            projectJsonSanitise.removeEndJumpsFromLastInput(inputs);

            expect(inputs[0].jumps).toEqual([{to: 'END'}]);
            expect(inputs[1].jumps).toEqual([]);
        });

        it('removes END jumps from nested last branch and group inputs on any sibling', () => {
            const inputs = [
                {
                    branch: [
                        {
                            jumps: [
                                {
                                    to: 'END'
                                }
                            ]
                        }
                    ]
                },
                {
                    group: [
                        {
                            jumps: [
                                {
                                    to: 'END'
                                }
                            ]
                        }
                    ],
                    jumps: [
                        {
                            to: 'END'
                        }
                    ]
                }
            ];

            projectJsonSanitise.removeEndJumpsFromLastInput(inputs);

            expect(inputs[0].branch[0].jumps).toEqual([]);
            expect(inputs[1].group[0].jumps).toEqual([]);
            expect(inputs[1].jumps).toEqual([]);
        });
    });

    describe('sanitiseProjectDefinitionForImport', () => {
        it('trims newlines from descriptions', () => {
            const project = createMinimalProject();
            project.data.project.small_description = '  Test  \n\n';
            project.data.project.description = '  Desc  \n';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            // After trim: "Test" (4 chars) - needs padding to 15 chars
            expect(project.data.project.small_description).toBe('Test___________');
            // After trim: "Desc" (4 chars) - stays as is
            expect(project.data.project.description).toBe('Desc');
        });

        it('handles undefined description (description is optional per schema)', () => {
            const project = createMinimalProject();
            project.data.project.small_description = '  Test  \n\n';
            delete project.data.project.description;
            expect(() => projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data)).not.toThrow();
            expect(project.data.project.description).toBe('');
            expect(project.data.project.small_description).toBe('Test___________');
        });

        it('handles null description (defensive)', () => {
            const project = createMinimalProject();
            project.data.project.description = null;
            expect(() => projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data)).not.toThrow();
            expect(project.data.project.description).toBe('');
        });

        it('pads small_description to minimum 15 chars with underscores', () => {
            const project = createMinimalProject();
            project.data.project.small_description = 'Short';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.small_description).toBe('Short__________');
            expect(project.data.project.small_description.length).toBe(15);
        });

        it('does not pad small_description if already >= 15 chars', () => {
            const project = createMinimalProject();
            project.data.project.small_description = 'This is exactly 16 chars!_';
            const original = project.data.project.small_description;
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.small_description).toBe(original);
        });

        it('replaces < and > with _ in small_description', () => {
            const project = createMinimalProject();
            project.data.project.small_description = 'Test <tag> here_';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.small_description).toBe('Test _tag_ here_');
        });

        it('normalizes multiple whitespace to single space in small_description', () => {
            const project = createMinimalProject();
            project.data.project.small_description = 'Test   multiple   spaces_';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.small_description).toBe('Test multiple spaces_');
        });

        it('normalizes multiple whitespace to single space in description', () => {
            const project = createMinimalProject();
            project.data.project.description = 'Test   multiple   spaces';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.description).toBe('Test multiple spaces');
        });

        it('sanitizes form name to remove invisible/whitespace characters', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].name = 'Form   Name   Here';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.forms[0].name).toBe('Form Name Here');
        });

        it('clears group array when input type is branch', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs[0].type = 'branch';
            project.data.project.forms[0].inputs[0].group = [{ test: 'value' }];
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.forms[0].inputs[0].group).toEqual([]);
        });

        it('does not clear group array for non-branch inputs', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs[0].type = 'group';
            project.data.project.forms[0].inputs[0].group = [{ test: 'value' }];
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.forms[0].inputs[0].group).toEqual([{ test: 'value' }]);
        });

        it('sanitizes jumps in inputs', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs[0].jumps = [
                {
                    to: 'END',
                    when: 'ALL',
                    answer_ref: '',
                    has_valid_destination: true
                }
            ];
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.forms[0].inputs[0].jumps).toEqual([]);
        });

        it('sanitizes decimal inputs', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs[0].type = 'decimal';
            project.data.project.forms[0].inputs[0].min = '.5';
            project.data.project.forms[0].inputs[0].max = '-.25';
            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);
            expect(project.data.project.forms[0].inputs[0].min).toBe('0.5');
            expect(project.data.project.forms[0].inputs[0].max).toBe('-0.25');
        });

        it('handles missing forms gracefully', () => {
            const project = createMinimalProject();
            project.data.project.forms = null;
            expect(() => projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data)).not.toThrow();
        });

        it('handles missing inputs in form gracefully', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs = null;
            expect(() => projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data)).not.toThrow();
        });

        it('applies all sanitizations in combination', () => {
            const project = createMinimalProject();
            project.data.project.small_description = '  Test  <tag>   \n  ';
            project.data.project.description = 'Desc\n\n\n';
            project.data.project.forms[0].name = 'Form    Name';
            project.data.project.forms[0].inputs[0].type = 'branch';
            project.data.project.forms[0].inputs[0].group = [{ data: 'test' }];
            project.data.project.forms[0].inputs[0].jumps = [
                {
                    to: 'END',
                    when: 'ALL',
                    answer_ref: ''
                }
            ];

            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);

            // "  Test  <tag>   \n  " -> trim -> "Test  <tag>" -> normalize spaces -> "Test _tag" (8 chars) -> pad to 15
            expect(project.data.project.small_description).toBe('Test _tag_____');
            expect(project.data.project.description).toBe('Desc');
            expect(project.data.project.forms[0].name).toBe('Form Name');
            expect(project.data.project.forms[0].inputs[0].group).toEqual([]);
            expect(project.data.project.forms[0].inputs[0].jumps).toEqual([]);
        });
    });

    describe('integration - sanitization workflows', () => {
        it('sanitizes old export with all issues', () => {
            const project = createMinimalProject();
            // noinspection HtmlRequiredLangAttribute
            project.data.project.small_description = 'Old:  <html>  \n';
            project.data.project.forms[0].name = 'Main  Form';
            project.data.project.forms[0].inputs[0].type = 'decimal';
            project.data.project.forms[0].inputs[0].min = '.5';
            project.data.project.forms[0].inputs[0].jumps = [
                {
                    to: 'END',
                    when: 'ALL',
                    answer_ref: '',
                    has_valid_destination: true
                }
            ];

            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);

            expect(project.data.project.small_description).toBe('Old: _html____');
            expect(project.data.project.forms[0].name).toBe('Main Form');
            expect(project.data.project.forms[0].inputs[0].min).toBe('0.5');
            expect(project.data.project.forms[0].inputs[0].jumps).toEqual([]);
        });

        it('handles deeply nested sanitization (branch with group with decimal)', () => {
            const project = createMinimalProject();
            project.data.project.forms[0].inputs = [
                {
                    ref: 'a'.repeat(32) + '_' + 'b'.repeat(13),
                    type: 'branch',
                    branch: [
                        {
                            ref: 'a'.repeat(32) + '_' + 'b'.repeat(13) + '_' + 'c'.repeat(13),
                            type: 'group',
                            group: [
                                {
                                    ref: 'a'.repeat(32) + '_' + 'b'.repeat(13) + '_' + 'c'.repeat(13) + '_' + 'd'.repeat(13),
                                    type: 'decimal',
                                    min: '.5',
                                    jumps: [],
                                    possible_answers: []
                                }
                            ],
                            jumps: [],
                            possible_answers: []
                        }
                    ],
                    jumps: [],
                    possible_answers: []
                }
            ];

            projectJsonSanitise.sanitiseProjectDefinitionForImport(project.data);

            expect(project.data.project.forms[0].inputs[0].branch[0].group[0].min).toBe('0.5');
        });
    });
});
