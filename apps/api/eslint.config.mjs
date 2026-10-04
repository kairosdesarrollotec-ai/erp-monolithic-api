// E1 — eslint.config.mjs para NestJS + TypeScript (TDD-00 §8.1, audit 2026-10-04)
// Requiere: npm install (dependencias añadidas en package.json: eslint, typescript-eslint, @typescript-eslint/*)
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Evitar @nestjs/common en capa domain/ (hallazgo E2 audit estructural)
      '@typescript-eslint/no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@nestjs/*'],
              message: 'No importar @nestjs/* en la capa domain/. Mover a application/ o infrastructure/.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    // La restricción de NestJS solo aplica dentro de domain/
    files: ['src/**/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*'],
              message: 'Capa domain/ no puede importar @nestjs/*. Usa errores base de DomainError.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests: relajar reglas de any y floating-promises
    files: ['src/**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
);
