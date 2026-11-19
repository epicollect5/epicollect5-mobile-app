import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

//one property or method per line inside multi-line object literals: inline
//objects ({type: 'image/jpeg'}) stay allowed, the rule only fires once an
//object spans lines. That is the shape a formatter collapses — several
//properties on one line between multi-line braces, or a method merged onto
//the previous closing brace (`}, async foo(`) — which churns a file's diff
//and hides the real change. Exported for its spec.
export const objectOnePropertyPerLine = {
    meta: {
        type: 'layout',
        docs: {
            description: 'enforce one property or method per line in multi-line object literals'
        },
        schema: [],
        messages: {
            sameLine: 'Object properties and methods must be on separate lines in a multi-line object literal.'
        }
    },
    create(context) {
        return {
            ObjectExpression(node) {
                if (node.properties.length < 2) {
                    return;
                }
                const first = node.properties[0];
                const last = node.properties[node.properties.length - 1];
                //single-line object: leave it alone
                if (first.loc.start.line === last.loc.end.line) {
                    return;
                }
                node.properties.forEach((property, index) => {
                    if (index === 0) {
                        return;
                    }
                    const previous = node.properties[index - 1];
                    if (previous.loc.end.line === property.loc.start.line) {
                        context.report({
                            node: property,
                            messageId: 'sameLine'
                        });
                    }
                });
            }
        };
    }
};

export default [
    js.configs.recommended,
    ...vue.configs['flat/essential'],
    {
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                cordova: 'readonly'
            }
        },
        plugins: {
            local: {
                rules: {
                    'object-one-property-per-line': objectOnePropertyPerLine
                }
            }
        },
        rules: {
            'local/object-one-property-per-line': 'error',
            'no-mixed-spaces-and-tabs': 0,
            'vue/multi-word-component-names': 0,
            'vue/no-deprecated-slot-attribute': 'off',
            'arrow-parens': 1,
            'no-var': 1,
            'prefer-const': 1,
            'no-console': 'off',
            'no-debugger': 'warn',
            'semi': ['error', 'always'],
            'curly': ['error', 'all'],
            'no-unused-vars': 'off',
            'quotes': ['error', 'single'],
            // not active in the previous .eslintrc.js (plugin:vue/essential);
            // keep parity so pre-existing '@vue/reactivity' imports don't error
            'vue/prefer-import-from-vue': 'off',
            'comma-dangle': [1, 'never'],
            // not active in the previous .eslintrc.js (plugin:vue/essential);
            // keep parity so pre-existing v-html usage doesn't error
            'vue/no-v-text-v-html-on-component': 'off',
            'vue/order-in-components': [1, {
                order: [
                    'el', 'name', 'key', 'parent', 'functional',
                    ['delimiters', 'comments'],
                    ['components', 'directives', 'filters'],
                    'extends', 'mixins', ['provide', 'inject'],
                    'ROUTER_GUARDS', 'layout', 'middleware', 'validate', 'scrollToTop',
                    'transition', 'loading', 'inheritAttrs', 'model',
                    ['props', 'propsData'], 'emits', 'setup', 'asyncData', 'data', 'fetch',
                    'head', 'computed', 'watch', 'watchQuery', 'LIFECYCLE_HOOKS', 'methods',
                    ['template', 'render'], 'renderError'
                ]
            }]
        }
    },
    {
        // vitest globals (it, describe, expect, beforeEach, vi, ...) for the test suite
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.vitest
            }
        }
    },
    {
        ignores: ['dist/', 'android/', 'ios/', 'node_modules/', 'public/']
    }
];
