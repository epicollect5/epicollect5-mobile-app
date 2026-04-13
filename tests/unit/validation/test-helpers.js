/**
 * Test Helper: Creates a minimal valid project structure for testing
 */
export const createMinimalProject = () => ({
    data: {
        id: 'a'.repeat(32),
        type: 'project',
        project: {
            ref: 'a'.repeat(32),
            name: 'Test Project',
            slug: 'test-project',
            category: 'general',
            access: 'public',
            visibility: 'listed',
            status: 'active',
            small_description: 'This is a test description for the project',
            description: 'Longer description of the project',
            forms: [
                {
                    ref: 'a'.repeat(32) + '_' + 'b'.repeat(13),
                    name: 'Test Form',
                    slug: 'test-form',
                    type: 'hierarchy',
                    inputs: [
                        {
                            ref: 'a'.repeat(32) + '_' + 'b'.repeat(13),
                            type: 'text',
                            question: 'Test question',
                            default: '',
                            is_title: false,
                            verify: true,
                            regex: '',
                            jumps: [],
                            possible_answers: []
                        }
                    ]
                }
            ]
        }
    }
});

