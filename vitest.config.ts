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

    // Strictly include only project tests (no vendor/dependency suites)
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],

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
