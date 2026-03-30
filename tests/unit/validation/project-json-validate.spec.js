import {describe, it, expect} from 'vitest';
import {projectJsonValidate} from '@/services/validation/project-json-validate';

const BASE_PROJECT_REF = 'f73df54472684c85b4a14d07e6193060';
const FORM_SUFFIX = '5ece4797eaf5e';
const FORM_REF = `${BASE_PROJECT_REF}_${FORM_SUFFIX}`;
const makeInputRef = (index) => `${FORM_REF}_${String(index).padStart(13, '0')}`;
const makeNestedInputRef = (parentRef, index) => `${parentRef}_${String(index).padStart(13, '0')}`;

const createTextInput = (ref) => ({
    ref,
    type: 'text',
    question: 'Sample question',
    is_title: false,
    is_required: false,
    uniqueness: 'none',
    verify: false,
    jumps: [],
    possible_answers: [],
    branch: [],
    group: [],
    regex: '',
    default: '',
    max: null,
    min: null,
    datetime_format: null,
    set_to_current_datetime: false
});

const createSearchInput = (ref, answerRefSuffix) => ({
    ...createTextInput(ref),
    type: 'searchsingle',
    possible_answers: [
        {
            answer: 'Search option',
            answer_ref: String(answerRefSuffix).padStart(13, '0')
        }
    ],
    default: ''
});

const createChoiceInput = (ref, answerRefs) => ({
    ...createTextInput(ref),
    type: 'dropdown',
    possible_answers: answerRefs.map((answer_ref, index) => ({
        answer: `Choice ${index + 1}`,
        answer_ref
    }))
});

const createBranchInput = (ref, branchChildren) => ({
    ...createTextInput(ref),
    type: 'branch',
    branch: branchChildren,
    group: [],
    possible_answers: [],
    default: ''
});

const createInputWithOverrides = (ref, overrides = {}) => ({
    ...createTextInput(ref),
    ...overrides
});


const createProjectPayloadWithInputs = (inputs) => {
    const payload = createValidProjectPayload();
    payload.data.project.forms = [
        {
            ...payload.data.project.forms[0],
            inputs
        }
    ];
    return payload;
};

const createValidProjectPayload = () => ({
    data: {
        id: BASE_PROJECT_REF,
        type: 'project',
        project: {
            ref: BASE_PROJECT_REF,
            name: 'Valid Project',
            slug: 'valid-project',
            forms: [
                {
                    ref: FORM_REF,
                    name: 'Main Form',
                    slug: 'main-form',
                    type: 'hierarchy',
                    inputs: [createTextInput(makeInputRef(1))]
                }
            ],
            category: 'science',
            logo_url: '',
            description: 'Project description needs no HTML.',
            small_description: 'Short project description',
            entries_limits: [],
            visibility: 'hidden',
            access: 'public',
            status: 'active'
        }
    }
});

describe('projectJsonValidate', () => {
    describe('sanitiseAngleBrackets', () => {
        it('escapes < and > except for safely skipped keys', () => {
            const raw = {
                question: '<Do this>',
                regex: '<ignore this>',
                nested: {
                    answer: '<Nest>'
                }
            };

            const sanitized = projectJsonValidate.sanitiseAngleBrackets(raw);

            expect(sanitized.question).toBe('&lt;Do this&gt;');
            expect(sanitized.regex).toBe('<ignore this>');
            expect(sanitized.nested.answer).toBe('&lt;Nest&gt;');
        });
    });

    describe('isValidAgainstSchema', () => {
        it('accepts a well-formed project payload', () => {
            const result = projectJsonValidate.isValidAgainstSchema(createValidProjectPayload());
            expect(result.isValid).toBe(true);
        });

        it('rejects a project missing a required field', () => {
            const payload = createValidProjectPayload();
            delete payload.data.project.ref;

            const result = projectJsonValidate.isValidAgainstSchema(payload);

            expect(result.isValid).toBe(false);
            expect(result.errors?.[0]?.message).toContain('must have required property');
        });
    });

    describe('performDeepValidation', () => {
        it('passes for a clean payload', () => {
            expect(() => projectJsonValidate.performDeepValidation(createValidProjectPayload())).not.toThrow();
        });

        it('throws when data.id does not match project.ref', () => {
            const payload = createValidProjectPayload();
            payload.data.id = 'ffffffffffffffffffffffffffffffff';

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/ID Mismatch/);
        });

        it('throws when metadata contains emojis', () => {
            const payload = createValidProjectPayload();
            payload.data.project.name = 'Invalid 😊 Project';

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Emoji detected/);
        });

        it('throws when project slug length does not equal project name length', () => {
            const payload = createValidProjectPayload();
            payload.data.project.name = 'Test Project'; // 12 chars
            payload.data.project.slug = 'test'; // 4 chars

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Project slug length \(4\) must equal project name length \(12\)/);
        });

        it('enforces at most three title inputs per form, including groups', () => {
            const payload = createValidProjectPayload();
            payload.data.project.forms[0].inputs = Array.from({length: 4}, (_, idx) => ({
                ...createTextInput(makeInputRef(idx + 1)),
                is_title: true
            }));

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Form "Main Form" has 4 titles/);
        });

        it('allows each branch its own title budget', () => {
            const payload = createValidProjectPayload();
            const branchInputRef = makeInputRef(1);
            const branchChildren = ['1111111111111', '2222222222222', '3333333333333', '4444444444444'].map((suffix) => ({
                ...createTextInput(`${branchInputRef}_${suffix}`),
                is_title: true
            }));

            payload.data.project.forms[0].inputs = [
                createBranchInput(branchInputRef, branchChildren)
            ];

            let caught;

            try {
                projectJsonValidate.performDeepValidation(payload);
            } catch (error) {
                caught = /** @type {Error} */ (error);
            }

            expect(caught).toBeDefined();
            expect(caught?.message).toContain(`Branch (${branchInputRef}) has 4 titles (Max: 3)`);
        });

        describe('Media, Location, Readme, Branch, Group constraints', () => {
            const types = ['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'];
            const constraints = [
                { prop: 'verify', value: true, error: /verify must be false/ },
                { prop: 'is_title', value: true, error: /is_title must be false/ },
                { prop: 'default', value: 'some value', error: /default must be empty/ }
            ];

            types.forEach((type) => {
                constraints.forEach(({ prop, value, error }) => {
                    it(`throws if ${type} has ${prop}: ${value}`, () => {
                        const input = {
                            ...createTextInput(makeInputRef(1)),
                            type,
                            [prop]: value
                        };
                        if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                        if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                        const payload = createProjectPayloadWithInputs([input]);
                        expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(error);
                    });
                });
            });
        });

        describe('Numeric Min/Max validation', () => {
            it('sanitizes leading dots in decimal min/max', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'decimal',
                    min: '.5',
                    max: '1.5'
                };
                const payload = createProjectPayloadWithInputs([input]);
                projectJsonValidate.performDeepValidation(payload);

                expect(input.min).toBe('0.5');
            });

            it('sanitizes leading dots in negative decimal min/max', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'decimal',
                    min: '-.9',
                    max: '.1'
                };
                const payload = createProjectPayloadWithInputs([input]);
                projectJsonValidate.performDeepValidation(payload);

                expect(input.min).toBe('-0.9');
                expect(input.max).toBe('0.1');
            });

            it('throws if min >= max for integer', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'integer',
                    min: '10',
                    max: '5'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/min \(10\) must be less than max \(5\)/);
            });

            it('throws if min >= max for decimal', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'decimal',
                    min: '5.5',
                    max: '5.5'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/min \(5.5\) must be less than max \(5.5\)/);
            });

            it('throws if integer min is out of range', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'integer',
                    min: '-3000000000'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/min \(-3000000000\) is out of range for integer/);
            });

            it('throws if integer max is out of range', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'integer',
                    max: '3000000000'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/max \(3000000000\) is out of range for integer/);
            });

            it('throws if decimal min is out of range', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'decimal',
                    min: '-2e12'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/min \(-2000000000000\) is out of range for decimal/);
            });

            it('throws if decimal max is out of range', () => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type: 'decimal',
                    max: '2e12'
                };
                const payload = createProjectPayloadWithInputs([input]);

                expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/max \(2000000000000\) is out of range for decimal/);
            });
        });

        it('rejects duplicate answer_ref values', () => {
            const payload = createValidProjectPayload();
            payload.data.project.forms[0].inputs = [
                createChoiceInput(makeInputRef(1), ['0000000000001', '0000000000001'])
            ];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Duplicate answer_ref/);
        });

        it('rejects possible answer text exceeding 250 characters', () => {
            const payload = createValidProjectPayload();
            const longAnswer = 'a'.repeat(251); // 251 chars
            const choiceInput = createChoiceInput(makeInputRef(1), ['0000000000001']);
            choiceInput.possible_answers[0].answer = longAnswer;
            payload.data.project.forms[0].inputs = [choiceInput];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/exceeds 250 characters/);
        });

        it('rejects defaults that are not listed in possible_answers', () => {
            const payload = createValidProjectPayload();
            const dropdown = createChoiceInput(makeInputRef(1), ['0000000000001']);
            dropdown.default = '0000000000002';
            payload.data.project.forms[0].inputs = [dropdown];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Default value "0000000000002"/);
        });

        it('enforces the project-wide search limit', () => {
            const payload = createValidProjectPayload();
            payload.data.project.forms[0].inputs = Array.from({length: 6}, (_, idx) => createSearchInput(makeInputRef(idx + 1), idx + 1));

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/Project has 6 search inputs/);
        });

        it('rejects more than 300 inputs per form hierarchy', () => {
            const payload = createValidProjectPayload();
            payload.data.project.forms[0].inputs = Array.from({length: 301}, (_, idx) => createTextInput(makeInputRef(idx + 1)));

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/total inputs/);
        });

        it('rejects jumps that point to non-existent inputs', () => {
            const payload = createValidProjectPayload();
            const input = createTextInput(makeInputRef(1));
            input.jumps = [
                {
                    to: 'ffffffffffffffffffffffffffffffff_1111111111111',
                    when: 'ALL',
                    answer_ref: null
                }
            ];
            payload.data.project.forms[0].inputs = [input];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/non-existent input/);
        });

        it('rejects jumps that do not skip at least one question', () => {
            const payload = createValidProjectPayload();
            const input1 = createTextInput(makeInputRef(1));
            const input2 = createTextInput(makeInputRef(2));
            input1.jumps = [
                {
                    to: makeInputRef(2), // Jump to next input, should skip at least one
                    when: 'ALL',
                    answer_ref: null
                }
            ];
            payload.data.project.forms[0].inputs = [input1, input2];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/must skip at least one question/);
        });

        it('allows jumps that skip at least one question', () => {
            const payload = createValidProjectPayload();
            const input1 = createTextInput(makeInputRef(1));
            const input2 = createTextInput(makeInputRef(2));
            const input3 = createTextInput(makeInputRef(3));
            input1.jumps = [
                {
                    to: makeInputRef(3), // Jump from index 0 to index 2, skipping 1
                    when: 'ALL',
                    answer_ref: null
                }
            ];
            payload.data.project.forms[0].inputs = [input1, input2, input3];

            expect(() => projectJsonValidate.performDeepValidation(payload)).not.toThrow();
        });


        it('rejects jumps to END from the last input', () => {
            const payload = createValidProjectPayload();
            const input1 = createTextInput(makeInputRef(1));
            const input2 = createTextInput(makeInputRef(2));
            input2.jumps = [
                {
                    to: 'END', // Jump to end from last input, should fail
                    when: 'ALL',
                    answer_ref: null
                }
            ];
            payload.data.project.forms[0].inputs = [input1, input2];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/must skip at least one question/);
        });

        it('rejects uniqueness "hierarchy" for inputs inside branches', () => {
            const payload = createValidProjectPayload();
            const branchChild = createTextInput(makeNestedInputRef(makeInputRef(1), 1));
            branchChild.uniqueness = 'hierarchy'; // Invalid for branch children
            const branch = createBranchInput(makeInputRef(1), [branchChild]);
            payload.data.project.forms[0].inputs = [branch];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/cannot have uniqueness "hierarchy"/);
        });

        it('allows uniqueness "none" for inputs inside branches', () => {
            const payload = createValidProjectPayload();
            const branchChild = createTextInput(makeNestedInputRef(makeInputRef(1), 1));
            branchChild.uniqueness = 'none'; // Valid for branch children
            const branch = createBranchInput(makeInputRef(1), [branchChild]);
            payload.data.project.forms[0].inputs = [branch];

            expect(() => projectJsonValidate.performDeepValidation(payload)).not.toThrow();
        });

        it('allows uniqueness "form" for inputs inside branches', () => {
            const payload = createValidProjectPayload();
            const branchChild = createTextInput(makeNestedInputRef(makeInputRef(1), 1));
            branchChild.uniqueness = 'form'; // Valid for branch children
            const branch = createBranchInput(makeInputRef(1), [branchChild]);
            payload.data.project.forms[0].inputs = [branch];

            expect(() => projectJsonValidate.performDeepValidation(payload)).not.toThrow();
        });

        it('allows uniqueness "hierarchy" for top-level inputs', () => {
            const payload = createValidProjectPayload();
            const topLevelInput = createTextInput(makeInputRef(1));
            topLevelInput.uniqueness = 'hierarchy'; // Valid for top-level
            payload.data.project.forms[0].inputs = [topLevelInput];

            expect(() => projectJsonValidate.performDeepValidation(payload)).not.toThrow();
        });

        it('rejects readme questions exceeding 1000 decoded characters', () => {
            const payload = createValidProjectPayload();
            const readmeInput = createInputWithOverrides(makeInputRef(1), {
                type: 'readme',
                question: '&lt;' + 'a'.repeat(1000) + '&gt;' // Encoded < and >, plus 1000 'a's, decoded length > 1000
            });
            payload.data.project.forms[0].inputs = [readmeInput];

            expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/decoded question text exceeds 1000 characters/);
        });

        it('allows readme questions up to 1000 decoded characters', () => {
            const payload = createValidProjectPayload();
            const readmeInput = createInputWithOverrides(makeInputRef(1), {
                type: 'readme',
                question: 'a'.repeat(1000) // Exactly 1000 chars
            });
            payload.data.project.forms[0].inputs = [readmeInput];

            expect(() => projectJsonValidate.performDeepValidation(payload)).not.toThrow();
        });
    });
});
