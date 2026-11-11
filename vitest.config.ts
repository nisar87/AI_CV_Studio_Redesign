import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Server-only marker: allowed in unit tests (they run on the server side).
      'server-only': path.resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
