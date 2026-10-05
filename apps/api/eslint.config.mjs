// E1 — eslint.config.mjs para NestJS + TypeScript (TDD-00 §8.1, audit 2026-10-04)
// Requiere: npm install (dependencias añadidas en package.json: eslint, typescript-eslint, @typescript-eslint/*)
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Type-aware linting solo para src/ — tsconfig.json + tsconfig.spec.json
    // cubren todos los archivos de src (incluidos *.spec.ts).
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        // tsconfig.json (producción) + tsconfig.spec.json (spec files excluidos de producción)
        project: ['tsconfig.json', 'tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      // Parámetros con prefijo _ son ignorados (overrides de interfaces, etc.)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
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
    // Spec files y helpers de test en src/: relajar reglas type-aware
    files: ['src/**/*.spec.ts', 'src/**/testing/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Tests de integración en test/: usan ESM/bundler (distinto tsconfig),
    // no participan en type-aware linting.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
