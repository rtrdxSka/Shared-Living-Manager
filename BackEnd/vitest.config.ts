import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Each test file gets its own worker; setupFiles re-runs per file → fresh seed per file.
    fileParallelism: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Cap concurrent workers so the test Mongo container isn't overwhelmed by
        // ~30 simultaneous seed/drop cycles. Each worker still owns its own DB
        // via VITEST_POOL_ID (see tests/helpers/db.ts).
        minForks: 1,
        maxForks: 2,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/instrument.ts',
        // Batch 4 will add scheduler tests — when that lands, REMOVE the next line
        // so coverage reflects scheduler code.
        'src/scheduler/**',
        'src/types/**',
        'src/**/*.d.ts',
      ],
      reporter: ['text', 'html'],
    },
  },
});
