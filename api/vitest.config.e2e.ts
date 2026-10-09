import { defineConfig } from 'vitest/config';

export default defineConfig({
  // e2e usa um banco temporário (criado e apagado pelo teste); um arquivo por vez
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
