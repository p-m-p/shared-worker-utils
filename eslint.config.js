import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'
import prettier from 'eslint-plugin-prettier/recommended'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
  ...tseslint.configs.recommended,
  unicorn.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Unicorn rules customization
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
        },
      ],
    },
  },
  // Prettier must be last to override other configs
  prettier
)
