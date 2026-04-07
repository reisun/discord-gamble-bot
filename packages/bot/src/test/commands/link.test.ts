import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild } from 'discord.js';

// config をモック
vi.mock('../../config', () => ({
  config: {
    webAppBaseUrl: 'https://example.github.io/app',
  },
}));

import { execute } from '../../commands/link';

const TEST_GUILD_ID = 'guild-123456789';

function makeInteraction(guildId: string | null = TEST_GUILD_ID): ChatInputCommandInteraction {
  return {
    guild: guildId
      ? ({ id: guildId } as unknown as Guild)
      : null,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/link execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guild_id 付きトークンなし URL を返す（Ephemeral）', async () => {
    const interaction = makeInteraction();
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining(
          `https://example.github.io/app/#/dashboard/${TEST_GUILD_ID}`,
        ),
      }),
    );
    const call = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string };
    expect(call.content).toContain('🌐');
    // トークンが含まれないことを確認
    expect(call.content).not.toContain('token=');
  });

  it('webAppBaseUrl 末尾スラッシュがあっても正しい URL を生成する', async () => {
    // vi.mock は巻き上げられるため動的に書き換え
    const { config } = await import('../../config.js');
    const originalUrl = config.webAppBaseUrl;
    (config as { webAppBaseUrl: string }).webAppBaseUrl = 'https://example.github.io/app/';

    const interaction = makeInteraction();
    await execute(interaction);

    const call = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string };
    expect(call.content).toContain(`https://example.github.io/app/#/dashboard/${TEST_GUILD_ID}`);
    expect(call.content).not.toContain('//#/');

    (config as { webAppBaseUrl: string }).webAppBaseUrl = originalUrl;
  });

  it('guild なし（DM）: エラーメッセージ（Ephemeral）', async () => {
    const interaction = makeInteraction(null);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('サーバー内'),
      }),
    );
  });

  it('webAppBaseUrl 未設定: エラーメッセージ（Ephemeral）', async () => {
    const { config } = await import('../../config.js');
    const originalUrl = config.webAppBaseUrl;
    (config as { webAppBaseUrl: string }).webAppBaseUrl = '';

    const interaction = makeInteraction();
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('URL が設定されていません'),
      }),
    );

    (config as { webAppBaseUrl: string }).webAppBaseUrl = originalUrl;
  });
});
