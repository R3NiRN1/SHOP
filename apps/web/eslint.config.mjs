import tsParser from '@typescript-eslint/parser';
import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  ...nextConfig,
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: '19.2' },
    },
  },
];
