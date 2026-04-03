import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: './src/test/globalSetup.ts',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/**/*.test.ts'],
    testTimeout: 15000,
    // テストは直列実行（DBの状態を確実に管理するため）
    maxWorkers: 1,
    // モジュールロード前に環境変数をセット
    env: {
      DATABASE_URL: 'postgresql://gamble_user:reisun0101@127.0.0.1:5432/gamble_bot_test',
      ADMIN_TOKEN: 'test-admin-token',
    },
  },
});
