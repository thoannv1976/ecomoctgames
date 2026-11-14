import { defineConfig } from 'vitest/config';

// The integration tests each start a Fastify app, generate an RSA key pair and talk to the
// Firestore emulator. With one file per game they now run a dozen at a time, and the default
// 5-second timeout is no longer enough on a cold emulator.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
