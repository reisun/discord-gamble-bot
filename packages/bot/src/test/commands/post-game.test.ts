import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import type { Game } from '../../lib/api';

vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin'],
  },
}));

vi.mock('../../lib/api', () => ({
  getGameByNo: vi.fn(),
  extractApiMessage: vi.fn(() => 'APIエラー'),
}));

import * as api from '../../lib/api';
import { execute } from '../../commands/post-game';

function makeMember(isAdmin: boolean): GuildMember {
  return {
    roles: { cache: { has: (id: string) => isAdmin && id === 'role-admin' } },
  } as unknown as GuildMember;
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 3,
    eventId: 1,
    title: '第1試合',
    description: '説明文です',
    deadline: new Date('2024-06-01T12:00:00Z').toISOString(),
    isPublished: true,
    status: 'open',
    betType: 'single',
    requiredSelections: null,
    resultSymbols: null,
    betOptions: [
      { id: 1, symbol: 'A', label: 'チームA', order: 1 },
      { id: 2, symbol: 'B', label: 'チームB', order: 2 },
    ],
    ...overrides,
  };
}

function makeInteraction(isAdmin: boolean, gameNo: number): ChatInputCommandInteraction {
  const member = makeMember(isAdmin);
  return {
    user: { id: 'user-001' },
    guild: {
      id: 'test-guild-001',
      members: { fetch: vi.fn().mockResolvedValue(member) },
    } as unknown as Guild,
    options: {
      getInteger: (name: string) => (name === 'game' ? gameNo : null),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/post-game execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('管理者: single 方式のゲーム情報を全員向けに投稿する', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    const interaction = makeInteraction(true, 3);
    await execute(interaction);

    // deferReply は ephemeral: false
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('🎮 **ゲーム情報**');
    expect(reply).toContain('第1試合');
    expect(reply).toContain('説明文です');
    expect(reply).toContain('A: チームA');
    expect(reply).toContain('B: チームB');
    expect(reply).toContain('/bet game:3');
  });

  it('管理者: multi_ordered 方式は方式ラベルと記号数ヒントを含む', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({
        betType: 'multi_ordered',
        requiredSelections: 2,
        betOptions: [
          { id: 1, symbol: 'A', label: 'チームA', order: 1 },
          { id: 2, symbol: 'B', label: 'チームB', order: 2 },
          { id: 3, symbol: 'C', label: 'チームC', order: 3 },
        ],
      }),
    );
    const interaction = makeInteraction(true, 3);
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('複数-順番一致（重複なし）');
    expect(reply).toContain('2文字');
  });

  it('管理者ロールなし: Ephemeral エラーを返す（投稿しない）', async () => {
    const interaction = makeInteraction(false, 3);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('管理者のみ') }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(api.getGameByNo).not.toHaveBeenCalled();
  });

  it('ゲームが見つからない: エラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockRejectedValue(new Error('not found'));
    const interaction = makeInteraction(true, 999);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('ゲームが見つかりません'),
    );
  });

  it('非公開ゲームは投稿できない: エラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame({ isPublished: false }));
    const interaction = makeInteraction(true, 3);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('非公開のゲームは投稿できません'),
    );
  });

  it('description が null の場合は説明行を省略する', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame({ description: null }));
    const interaction = makeInteraction(true, 3);
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).not.toContain('説明:');
  });
});
