import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**'],
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-console': 'off',
            'prefer-const': 'warn',
            eqeqeq: ['warn', 'always'],
        },
    },
    {
        // Dashboard front-end runs in the browser
        files: ['src/dashboard/public/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
    },
];
