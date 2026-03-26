import { describe, it, expect } from 'vitest';
import projectMappingService from '@/services/project-mapping-service';

describe('Project Mapping Service', () => {
    const mockProjectExtra = {
        forms: {
            for_123: {
                inputs: ['inp_1', 'inp_2', 'inp_3', 'inp_4'],
                group: {
                    inp_4: ['inp_g1', 'inp_g2']
                },
                branch: {
                    inp_g2: ['inp_b1', 'inp_b2']
                }
            }
        },
        inputs: {
            inp_1: { data: { ref: 'inp_1', type: 'text', question: 'What is your name?' } },
            inp_2: { data: { ref: 'inp_2', type: 'readme', question: 'Information only' } },
            inp_3: { data: { ref: 'inp_3', type: 'radio', question: 'Pick one', possible_answers: [{ answer: 'A', answer_ref: 'ans_a' }] } },
            inp_4: { data: { ref: 'inp_4', type: 'group', question: 'A group' } },
            inp_g1: { data: { ref: 'inp_g1', type: 'text', question: 'Inside group text' } },
            inp_g2: { data: { ref: 'inp_g2', type: 'branch', question: 'A branch' } },
            inp_b1: { data: { ref: 'inp_b1', type: 'text', question: 'Inside branch text' } },
            inp_b2: { data: { ref: 'inp_b2', type: 'checkbox', question: 'Multi pick', possible_answers: [{ answer: 'B', answer_ref: 'ans_b' }] } }
        }
    };

    it('should create EC5_AUTO mapping correctly', () => {
        const mapping = projectMappingService.createEC5AUTOMapping(mockProjectExtra);

        expect(mapping.name).toBe('EC5_AUTO');
        expect(mapping.is_default).toBe(true);
        expect(mapping.forms['for_123']).toBeDefined();

        const formMapping = mapping.forms['for_123'];

        // inp_1: What is your name? -> index 1
        expect(formMapping['inp_1'].map_to).toBe('1_What_is_your_name'); // truncated to 20

        // inp_2: readme -> should be excluded
        expect(formMapping['inp_2']).toBeUndefined();

        // inp_3: Pick one -> index 2 (inp_2 excluded, but counter still increments? Let me check code)
        // Wait, looking at the code:
        // if (EXCLUDE_FROM_MAPPING.has(inputData.type)) { continue; }
        // counter.value++;
        // So readme IS skipped before increment.
        expect(formMapping['inp_3'].map_to).toBe('2_Pick_one');
        expect(formMapping['inp_3'].possible_answers['ans_a'].map_to).toBe('A');

        // inp_4: A group -> index 3
        expect(formMapping['inp_4'].map_to).toBe('3_A_group');
        expect(formMapping['inp_4'].group['inp_g1'].map_to).toBe('4_Inside_group_text');

        // Nested branch in group
        expect(formMapping['inp_4'].group['inp_g2'].map_to).toBe('5_A_branch');
        expect(formMapping['inp_4'].group['inp_g2'].branch['inp_b1'].map_to).toBe('6_Inside_branch_text');
        expect(formMapping['inp_4'].group['inp_g2'].branch['inp_b2'].map_to).toBe('7_Multi_pick');
    });

    it('should handle map_to generation edge cases', () => {
        // Test generateMapTo logic more thoroughly
        // We can't easily test private generateMapTo directly unless we export it or test via public API
        // Let's use public API
        const projectExtraShort = {
            forms: { for_1: { inputs: ['i1', 'i2', 'i3'] } },
            inputs: {
                i1: { data: { ref: 'i1', type: 'text', question: '  Trim Me  ' } },
                i2: { data: { ref: 'i2', type: 'text', question: 'Question with   spaces' } },
                i3: { data: { ref: 'i3', type: 'text', question: 'Question with $ymbols & _ underscore' } }
            }
        };

        const map = projectMappingService.createEC5AUTOMapping(projectExtraShort).forms['for_1'];
        expect(map['i1'].map_to).toBe('1_Trim_Me');
        expect(map['i2'].map_to).toBe('2_Question_with_spac');
        expect(map['i3'].map_to).toBe('3_Question_with_ymbo');
    });
});

