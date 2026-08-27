import js from '@eslint/js';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

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
        rules: {
            'no-mixed-spaces-and-tabs': 0,
            'vue/multi-word-component-names': 0,
            'vue/no-deprecated-slot-attribute': 'off',
            'arrow-parens': 1,
            'no-var': 1,
            'prefer-const': 1,
            'no-console': 'off',
            'no-debugger': 'warn',
            'semi': ['error', 'always'],
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
