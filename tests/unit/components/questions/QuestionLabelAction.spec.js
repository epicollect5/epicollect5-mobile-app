import {mount} from '@vue/test-utils';
import {describe, it, expect, beforeEach} from 'vitest';
import {setActivePinia, createPinia} from 'pinia';
import {useRootStore} from '@/stores/root-store';
import QuestionLabelAction from '@/components/QuestionLabelAction.vue';
import {ellipsisVertical, search, filter, helpCircle, create, copyOutline} from 'ionicons/icons';

describe('QuestionLabelAction.vue - Action Visibility & Icons', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    const factory = (props = {}, isPWAValue = false) => {
        const rootStore = useRootStore();
        rootStore.isPWA = isPWAValue;

        return mount(QuestionLabelAction, {
            props: {
                questionText: 'Test Label',
                action: 'help',
                disabled: false,
                ...props
            },
            global: {
                // KEEP these to keep tests fast and quiet
                stubs: {
                    'ion-grid': true,
                    'ion-row': true,
                    'ion-col': true,
                    'ion-icon': true,
                    'ion-ripple-effect': true
                }
            }
        });
    };

    describe('PWA Visibility Logic', () => {

        // Scenario 1: Not a PWA (Button should ALWAYS show)
        it('shows the button for any action when isPWA is false', () => {
            const actions = [
                'search',
                'filter',
                'media',
                'edit',
                'clipboard',
                'location',
                'help'
            ];
            actions.forEach((action) => {
                const wrapper = factory({action}, false);
                expect(wrapper.find('.question-label-button').exists(), `Action ${action} should be visible`).toBe(true);
            });
        });

        // Scenario 2: Is a PWA, but action is "help" (Exception rule)
        it('shows the button in PWA mode ONLY if action is "help"', () => {
            const wrapper = factory({action: 'help'}, true);
            expect(wrapper.find('.question-label-button').exists()).toBe(true);
        });

        // Scenario 3: Is a PWA, other actions (Should be hidden)
        it('hides the button in PWA mode for non-help actions', () => {
            const hiddenActions = ['search', 'filter', 'media', 'location', 'edit', 'clipboard'];
            hiddenActions.forEach((action) => {
                const wrapper = factory({action}, true);
                expect(wrapper.find('.question-label-button').exists(), `Action ${action} should be hidden`).toBe(false);
            });
        });
    });

    describe('Icon Assignment', () => {
        const iconCases = [
            {action: 'media', expected: ellipsisVertical},
            {action: 'search', expected: search},
            {action: 'filter', expected: filter},
            {action: 'help', expected: helpCircle},
            {action: 'edit', expected: create},
            {action: 'clipboard', expected: copyOutline}
        ];

        iconCases.forEach(({action, expected}) => {
            it(`assigns the correct icon for action: ${action}`, () => {
                // FORCE isPWA to false so the v-if always resolves to true
                const wrapper = factory({action}, false);

                const icon = wrapper.find('ion-icon');

                // Verification: Check if it exists first to avoid the "empty DOMWrapper" error
                expect(icon.exists()).toBe(true);
                expect(icon.attributes('icon')).toBeDefined();
                expect(wrapper.vm.actionIcon).toBe(expected);
            });
        });
    });
});
