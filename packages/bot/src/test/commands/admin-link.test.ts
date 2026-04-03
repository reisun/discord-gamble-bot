import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';

// config をモック
vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin'],
    webAppBaseUrl: 'https://example.github.io/app',
    adminToken: 'secret-admin-token',
  },
}));

import { execute } from '../../commands/admin-link';

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

describe('/admin-link execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('管理者ロールあり: guild_id 付きトークン URL を返す（Ephemeral）', async () => {
    const interaction = makeInteraction(true);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining(
          `https://example.github.io/app/#/events/${TEST_GUILD_ID}?token=secret-admin-token`,
        ),
      }),
    );
    const call = vi.mocked(interaction.reply).mock.calls[0][0] as { content: string };
    expect(call.content).toContain('🔑');
    expect(call.content).toContain('共有しないでください');
  });

  it('管理者ロールなし: エラーメッセージ（Ephemeral）', async () => {
    const interaction = makeInteraction(false);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('管理者のみ'),
      }),
    );
  });

  it('guild なし（DM）: エラーメッセージ', async () => {
    const interaction = makeInteraction(true, null);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        ephemeral: true,
        content: expect.stringContaining('管理者のみ'),
      }),
    );
  });
});
