import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    files: ['next.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
