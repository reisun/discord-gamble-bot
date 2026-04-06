import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction, Guild, GuildMember } from 'discord.js';
import type { EmbedBuilder } from 'discord.js';
import type { Event, Game } from '../../lib/api';

vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin'],
  },
}));

vi.mock('../../lib/api', () => ({
  getEvents: vi.fn(),
  getEventGamesAdmin: vi.fn(),
  publishGame: vi.fn(),
  extractApiMessage: vi.fn(() => 'APIエラー'),
}));

import * as api from '../../lib/api';
import { execute } from '../../commands/post-game';

function makeMember(isAdmin: boolean): GuildMember {
  return {
    roles: { cache: { has: (id: string) => isAdmin && id === 'role-admin' } },
  } as unknown as GuildMember;
}

function makeEvent(): Event {
  return { id: 1, guildId: 'test-guild-001', name: 'テストイベント', isActive: true, initialPoints: 1000, resultsPublic: false };
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

/** editReply に渡された embeds[0] の data を返すヘルパー */
function getEmbedData(interaction: ChatInputCommandInteraction) {
  const arg = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: EmbedBuilder[] };
  return arg.embeds[0].data;
}

describe('/post-game execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEvents).mockResolvedValue([makeEvent()]);
    vi.mocked(api.publishGame).mockResolvedValue(undefined);
  });

  it('管理者: single 方式のゲーム情報を Embed で全員向けに投稿する', async () => {
    vi.mocked(api.getEventGamesAdmin).mockResolvedValue([makeGame()]);
    const interaction = makeInteraction(true, 1);
    await execute(interaction);

    // deferReply は ephemeral: false
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });

    const embed = getEmbedData(interaction);
    expect(embed.title).toContain('第1試合');
    expect(embed.title).toContain('#1');
    expect(embed.description).toBe('説明文です');

    const fieldValues = embed.fields?.map((f) => f.value) ?? [];
    expect(fieldValues).toContain('2024-06-01 21:00');
    expect(fieldValues.some((v) => v.includes('チームA'))).toBe(true);
    expect(fieldValues.some((v) => v.includes('チームB'))).toBe(true);
    expect(fieldValues.some((v) => v.includes('/bet game:1'))).toBe(true);
  });

  it('管理者: multi_ordered 方式は賭け方式フィールドと記号数ヒントを含む', async () => {
    vi.mocked(api.getEventGamesAdmin).mockResolvedValue([
      makeGame({
        betType: 'multi_ordered',
        requiredSelections: 2,
        betOptions: [
          { id: 1, symbol: 'A', label: 'チームA', order: 1 },
          { id: 2, symbol: 'B', label: 'チームB', order: 2 },
          { id: 3, symbol: 'C', label: 'チームC', order: 3 },
        ],
      }),
    ]);
    const interaction = makeInteraction(true, 1);
    await execute(interaction);

    const embed = getEmbedData(interaction);
    const fieldValues = embed.fields?.map((f) => f.value) ?? [];
    expect(fieldValues.some((v) => v.includes('複数-順番一致（重複なし）'))).toBe(true);
    expect(fieldValues.some((v) => v.includes('2文字'))).toBe(true);
  });

  it('管理者ロールなし: Ephemeral エラーを返す（投稿しない）', async () => {
    const interaction = makeInteraction(false, 1);
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true, content: expect.stringContaining('管理者のみ') }),
    );
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(api.getEventGamesAdmin).not.toHaveBeenCalled();
  });

  it('ゲームが見つからない: エラーメッセージ', async () => {
    vi.mocked(api.getEventGamesAdmin).mockResolvedValue([]);
    const interaction = makeInteraction(true, 999);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('ゲームが見つかりません'),
    );
  });

  it('非公開ゲームは自動で公開してから投稿する', async () => {
    vi.mocked(api.getEventGamesAdmin).mockResolvedValue([makeGame({ isPublished: false })]);
    const interaction = makeInteraction(true, 1);
    await execute(interaction);

    expect(api.publishGame).toHaveBeenCalledWith(3);
    // Embed が投稿されていること
    const embed = getEmbedData(interaction);
    expect(embed.title).toContain('第1試合');
  });

  it('description が null の場合は Embed の description が設定されない', async () => {
    vi.mocked(api.getEventGamesAdmin).mockResolvedValue([makeGame({ description: null })]);
    const interaction = makeInteraction(true, 1);
    await execute(interaction);

    const embed = getEmbedData(interaction);
    expect(embed.description).toBeUndefined();
  });
});
