module.exports = {
  root: true,
  env: {
    node: true
  },
  globals: {
    'cordova': true
  },
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    parser: '@babel/eslint-parser'
  },
  rules: {
    // 'no-use-before-define': 'error',
    'vue/multi-word-component-names': 0,
    'vue/no-deprecated-slot-attribute': 'off',
    'arrow-parens': 1,
    'no-var': 1,
    'prefer-const': 1,
    'no-console': process.env.NODE_ENV === 'production' ? 'off' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    //this is to force a semi colon at the end, seems like vue does not want that, crazy.
    'semi': ['error', 'always'],
    'no-unused-vars': 'off',
    'quotes': ['error', 'single'],
    'comma-dangle': [1, 'never'],
    'vue/order-in-components': [1, {
      'order': [
        'el',
        'name',
        'key',
        'parent',
        'functional',
        ['delimiters', 'comments'],
        ['components', 'directives', 'filters'],
        'extends',
        'mixins',
        ['provide', 'inject'],
        'ROUTER_GUARDS',
        'layout',
        'middleware',
        'validate',
        'scrollToTop',
        'transition',
        'loading',
        'inheritAttrs',
        'model',
        ['props', 'propsData'],
        'emits',
        'setup',
        'asyncData',
        'data',
        'fetch',
        'head',
        'computed',
        'watch',
        'watchQuery',
        'LIFECYCLE_HOOKS',
        'methods',
        ['template', 'render'],
        'renderError'
      ]
    }]
  },
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)'
      ],
      env: {
        jest: true
      }
    },
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)'
      ],
      env: {
        jest: true
      }
    }
  ]
};
