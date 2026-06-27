import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'dist/',
        'build/',
        'coverage/',
        '.kilo/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mocks/**',
        '**/__tests__/**',
      ],
      reportsDirectory: './coverage',
    },

    // Include project tests from both src/ and tests/ directories
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],

    // Explicitly exclude everything outside the project scope
    exclude: [
      'node_modules',
      '.kilo',
      'dist',
      'build',
      'coverage',
      '.next',
    ],

    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
