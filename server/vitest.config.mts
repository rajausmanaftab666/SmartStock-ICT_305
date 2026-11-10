import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSrc = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors the `paths` entries in tsconfig.json. Vitest resolves modules
    // through Vite, which does not read tsconfig paths on its own.
    alias: [
      { find: /^@shared$/, replacement: `${sharedSrc}/index.ts` },
      { find: /^@shared\//, replacement: `${sharedSrc}/` },
    ],
  },
  test: {
    environment: 'node',
    // The API tests share one seeded database, so they must not race.
    fileParallelism: false,
    sequence: { concurrent: false },
    // Generous because the suite may run against a hosted database. Locally a
    // test takes milliseconds; over the internet the receiving tests make a
    // dozen sequential round trips and 20s was not enough.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
