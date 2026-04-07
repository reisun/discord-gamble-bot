import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';

// config をモック
vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin'],
    webAppBaseUrl: 'https://example.github.io/app',
    apiBaseUrl: 'http://server:3000',
    adminToken: 'secret-admin-token',
  },
}));

// api をモック
vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { data: { token: 'generated-token-abc' } } }),
  },
}));

import { execute } from '../../commands/link';

const TEST_GUILD_ID = 'guild-123456789';

function makeMember(isAdmin: boolean): GuildMember {
  return {
    roles: {
      cache: {
        has: (id: string) => isAdmin && id === 'role-admin',
      },
    },
  } as unknown as GuildMember;
}

function makeInteraction(isAdmin: boolean, guildId: string | null = TEST_GUILD_ID): ChatInputCommandInteraction {
  const member = makeMember(isAdmin);
  return {
    user: { id: 'user-001' },
    guild: guildId
      ? {
          id: guildId,
          members: {
            fetch: vi.fn().mockResolvedValue(member),
          },
        } as unknown as Guild
      : null,
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/link execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('管理者: ボタンコンポーネントで応答する（Ephemeral）', async () => {
    const interaction = makeInteraction(true);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('🔑 管理者用'),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  label: 'Webアプリを開く',
                  url: expect.stringContaining(`/${TEST_GUILD_ID}?token=generated-token-abc`),
                }),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('一般ユーザー: ボタンコンポーネントで閲覧用リンクを応答する', async () => {
    const interaction = makeInteraction(false);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('🌐 閲覧用'),
        components: expect.any(Array),
      }),
    );
  });

  it('guild なし（DM）: エラーメッセージ（Ephemeral）', async () => {
    const interaction = makeInteraction(true, null);
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

    const interaction = makeInteraction(true);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('URL設定が不足'),
      }),
    );

    (config as { webAppBaseUrl: string }).webAppBaseUrl = originalUrl;
  });
});
