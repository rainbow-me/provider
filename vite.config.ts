import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.(ts|tsx)'],
    testTimeout: 30_000,
    watch: false,
  },
});
