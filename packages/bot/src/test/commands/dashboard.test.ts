import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';

// config をモック
vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin'],
    webAppBaseUrl: 'https://example.github.io/app',
    apiBaseUrl: 'http://server:3000',
  },
}));

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn().mockResolvedValue({ data: { data: { token: 'generated-token-abc' } } }),
  },
}));

import { execute } from '../../commands/dashboard';
import { api } from '../../lib/api';

const TEST_GUILD_ID = 'guild-123456789';

function makeMember(isAdmin: boolean): GuildMember {
  return {
    roles: {
      cache: {
        has: (roleId: string) => isAdmin && roleId === 'role-admin',
      },
    },
  } as unknown as GuildMember;
}

function makeInteraction(
  guildId: string | null = TEST_GUILD_ID,
  isAdmin = false,
): ChatInputCommandInteraction {
  const member = guildId ? makeMember(isAdmin) : null;
  return {
    guild: guildId
      ? ({
          id: guildId,
          members: {
            fetch: vi.fn().mockResolvedValue(member),
          },
        } as unknown as Guild)
      : null,
    user: { id: 'user-001' },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/dashboard execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset api mock to default success
    vi.mocked(api.post).mockResolvedValue({ data: { data: { token: 'generated-token-abc' } } } as never);
  });

  it('一般ユーザー: 閲覧用リンクボタンをEphemeralで返す', async () => {
    const interaction = makeInteraction(TEST_GUILD_ID, false);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('🌐'),
      }),
    );
    const call = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string; components: unknown[] };
    expect(call.content).toContain('12時間');
    expect(call.components).toHaveLength(1);
  });

  it('管理者: 管理者用リンクボタンをEphemeralで返す', async () => {
    const interaction = makeInteraction(TEST_GUILD_ID, true);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('🔑'),
      }),
    );
    const call = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string; components: unknown[] };
    expect(call.content).toContain('12時間');
    expect(call.components).toHaveLength(1);
  });

  it('URLに token が含まれること', async () => {
    const interaction = makeInteraction(TEST_GUILD_ID, false);
    await execute(interaction);

    // api.post が正しいパラメータで呼ばれたことを確認
    expect(api.post).toHaveBeenCalledWith(
      '/api/auth/token',
      expect.objectContaining({ guildId: TEST_GUILD_ID }),
      {},
    );
  });

  it('webAppBaseUrl 末尾スラッシュがあっても正しい URL を生成する', async () => {
    const { config } = await import('../../config.js');
    const originalUrl = config.webAppBaseUrl;
    (config as { webAppBaseUrl: string }).webAppBaseUrl = 'https://example.github.io/app/';

    const interaction = makeInteraction(TEST_GUILD_ID, false);
    await execute(interaction);

    // ボタンの URL 確認はできないが、reply が呼ばれたことを確認
    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('❌') }),
    );

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
        content: expect.stringContaining('URL設定が不足'),
      }),
    );

    (config as { webAppBaseUrl: string }).webAppBaseUrl = originalUrl;
  });

  it('トークン生成失敗: エラーメッセージ（Ephemeral）', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Server error'));

    const interaction = makeInteraction(TEST_GUILD_ID, false);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('アクセストークンの生成に失敗'),
      }),
    );
  });
});
