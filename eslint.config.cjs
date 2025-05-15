module.exports = {
  ignores: [
    '**/ui/**',
    '**/*.stories.*',
    '**/config/**',
    '**/.eslintrc.*',
    '**/.eslintignore',
    '**/dist/**',
    '**/build/**',
    '**/node_modules/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/.output/**',
    '**/.cache/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/.git/**',
  ],
  plugins: {
    '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
  },
  rules: {
    'no-unused-vars': 'error',
    'no-undef': 'error',
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
  }
};
