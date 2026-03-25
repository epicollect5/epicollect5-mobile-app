import {describe, it, expect} from 'vitest';
import {projectJsonValidate} from '@/services/validation/project-json-validate';

const BASE_PROJECT_REF = '0123456789abcdef0123456789abcdef';
const FORM_SUFFIX = 'bbbbbbbbbbbbb';
const FORM_REF = `${BASE_PROJECT_REF}_${FORM_SUFFIX}`;
const makeInputRef = (index) => `${FORM_REF}_${String(index).padStart(13, '0')}`;

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

const createGroupInput = (ref, groupChildren) => ({
    ...createTextInput(ref),
    type: 'group',
    group: groupChildren,
    branch: [],
    possible_answers: [],
    default: ''
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

            types.forEach((type) => {
                it(`throws if ${type} has verify: true`, () => {
                    const input = {
                        ...createTextInput(makeInputRef(1)),
                        type,
                        verify: true
                    };
                    if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                    if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                    const payload = createProjectPayloadWithInputs([input]);
                    expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/verify must be false/);
                });

                it(`throws if ${type} has is_title: true`, () => {
                    const input = {
                        ...createTextInput(makeInputRef(1)),
                        type,
                        is_title: true
                    };
                    if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                    if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                    const payload = createProjectPayloadWithInputs([input]);
                    expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/is_title must be false/);
                });

                it(`throws if ${type} has non-empty default`, () => {
                    const input = {
                        ...createTextInput(makeInputRef(1)),
                        type,
                        default: 'some value'
                    };
                    if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                    if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                    const payload = createProjectPayloadWithInputs([input]);
                    expect(() => projectJsonValidate.performDeepValidation(payload)).toThrow(/default must be empty/);
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
    });

    describe('project.schema.json allOf constraints', () => {
        const validateSchema = (input) => projectJsonValidate.isValidAgainstSchema(
            createProjectPayloadWithInputs([input])
        );

        it('requires readme inputs to keep is_required false', () => {
            const input = createInputWithOverrides(makeInputRef(1), {
                type: 'readme',
                is_required: true
            });

            expect(validateSchema(input).isValid).toBe(false);
        });

        it('rejects location defaults that are not valid coordinates', () => {
            const input = createInputWithOverrides(makeInputRef(1), {
                type: 'location',
                default: 'invalid-coordinate'
            });

            expect(validateSchema(input).isValid).toBe(false);
        });

        const expectDefaultLengthViolation = (type, lengthLimit) => {
            const longValue = 'a'.repeat(lengthLimit + 1);
            const input = createInputWithOverrides(makeInputRef(lengthLimit), {
                type,
                default: longValue
            });

            expect(validateSchema(input).isValid).toBe(false);
        };

        it('enforces text defaults to 255 chars', () => expectDefaultLengthViolation('text', 255));
        it('enforces phone defaults to 255 chars', () => expectDefaultLengthViolation('phone', 255));
        it('enforces integer defaults to 255 chars', () => expectDefaultLengthViolation('integer', 255));
        it('enforces decimal defaults to 255 chars', () => expectDefaultLengthViolation('decimal', 255));
        it('enforces textarea defaults to 1000 chars', () => expectDefaultLengthViolation('textarea', 1000));
        it('enforces date defaults to 25 chars', () => expectDefaultLengthViolation('date', 25));
        it('enforces time defaults to 25 chars', () => expectDefaultLengthViolation('time', 25));

        it('rejects dropdown defaults that are not valid answer_refs', () => {
            const dropdown = createChoiceInput(makeInputRef(1), ['0000000000001']);
            dropdown.default = 'short';

            expect(validateSchema(dropdown).isValid).toBe(false);
        });

        it('rejects radio defaults that are not valid answer_refs', () => {
            const radio = {...createChoiceInput(makeInputRef(2), ['0000000000002']), type: 'radio'};
            radio.default = 'short';

            expect(validateSchema(radio).isValid).toBe(false);
        });

        it('rejects checkbox defaults that are not valid answer_refs', () => {
            const checkbox = {...createChoiceInput(makeInputRef(3), ['0000000000003']), type: 'checkbox'};
            checkbox.default = 'short';

            expect(validateSchema(checkbox).isValid).toBe(false);
        });

        it('enforces searchsingle to have at least one possible answer', () => {
            const single = {...createSearchInput(makeInputRef(4), 4), possible_answers: []};

            expect(validateSchema(single).isValid).toBe(false);
        });

        it('enforces searchsingle to not own branch children', () => {
            const single = {...createSearchInput(makeInputRef(5), 5), branch: [createTextInput(makeInputRef(6))]};

            expect(validateSchema(single).isValid).toBe(false);
        });

        const createSearchMultipleInput = (ref, answerRefSuffix) => ({
            ...createSearchInput(ref, answerRefSuffix),
            type: 'searchmultiple'
        });

        it('enforces searchmultiple to have at least one possible answer', () => {
            const multi = {...createSearchMultipleInput(makeInputRef(6), 6), possible_answers: []};

            expect(validateSchema(multi).isValid).toBe(false);
        });

        it('enforces searchmultiple to not own group children', () => {
            const multi = {
                ...createSearchMultipleInput(makeInputRef(7), 7),
                group: [createTextInput(makeInputRef(8))]
            };

            expect(validateSchema(multi).isValid).toBe(false);
        });

        it('enforces photo defaults to 52 chars', () => expectDefaultLengthViolation('photo', 52));
        it('enforces audio defaults to 51 chars', () => expectDefaultLengthViolation('audio', 51));
        it('enforces video defaults to 51 chars', () => expectDefaultLengthViolation('video', 51));
        it('enforces barcode defaults to 255 chars', () => expectDefaultLengthViolation('barcode', 255));

        it('requires at least one child within branches', () => {
            const branch = createBranchInput(makeInputRef(9), []);

            expect(validateSchema(branch).isValid).toBe(false);
        });

        it('requires branches to keep possible_answers empty', () => {
            const branch = createBranchInput(makeInputRef(10), [createTextInput(makeInputRef(11))]);
            branch.possible_answers = [
                {
                    answer: 'Invalid',
                    answer_ref: 'aaaaaaaaaaaaa'
                }
            ];

            expect(validateSchema(branch).isValid).toBe(false);
        });

        it('requires groups to have at least one child', () => {
            const group = createGroupInput(makeInputRef(12), []);

            expect(validateSchema(group).isValid).toBe(false);
        });

        it('prevents jumps inside group children', () => {
            const child = createInputWithOverrides(makeInputRef(13), {
                jumps: [
                    {
                        to: 'END',
                        when: 'ALL',
                        answer_ref: null
                    }
                ]
            });
            const group = createGroupInput(makeInputRef(14), [child]);

            expect(validateSchema(group).isValid).toBe(false);
        });

        it('enforces non-branch/group inputs to keep branch/group empty', () => {
            const input = createTextInput(makeInputRef(15));
            input.branch = [createTextInput(makeInputRef(16))];

            expect(validateSchema(input).isValid).toBe(false);
        });

        it('enforces question length for non-readme inputs', () => {
            const input = createInputWithOverrides(makeInputRef(17), {
                type: 'text',
                question: 'a'.repeat(256)
            });

            expect(validateSchema(input).isValid).toBe(false);
        });

        it('requires location inputs to have is_required false', () => {
            const input = createInputWithOverrides(makeInputRef(18), {
                type: 'location',
                is_required: true
            });

            expect(validateSchema(input).isValid).toBe(false);
        });

        it('enforces verify: false for media, location, readme, branch, group', () => {
            ['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'].forEach((type) => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type,
                    verify: true
                };
                if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                expect(validateSchema(input).isValid).toBe(false);
            });
        });

        it('enforces is_title: false for media, location, readme, branch, group', () => {
            ['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'].forEach((type) => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type,
                    is_title: true
                };
                if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                expect(validateSchema(input).isValid).toBe(false);
            });
        });

        it('enforces empty default for media, location, readme, branch, group', () => {
            ['photo', 'audio', 'video', 'location', 'readme', 'branch', 'group'].forEach((type) => {
                const input = {
                    ...createTextInput(makeInputRef(1)),
                    type,
                    default: 'invalid'
                };
                if (type === 'branch') input.branch = [createTextInput(makeInputRef(2))];
                if (type === 'group') input.group = [createTextInput(makeInputRef(2))];

                expect(validateSchema(input).isValid).toBe(false);
            });
        });

        it('restricts jumps for non-choice inputs to when=ALL', () => {
            const input = createInputWithOverrides(makeInputRef(19), {
                jumps: [
                    {
                        to: 'END',
                        when: 'IS',
                        answer_ref: '0000000000001'
                    }
                ]
            });

            expect(validateSchema(input).isValid).toBe(false);
        });
    });
});
