import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Game } from '../../lib/api';

// API モジュールをモック
vi.mock('../../lib/api', () => ({
  getGameByNo: vi.fn(),
  placeBet: vi.fn(),
  getUserByDiscordId: vi.fn(),
  extractApiMessage: vi.fn(() => 'APIエラーが発生しました'),
}));

import * as api from '../../lib/api';
import { execute } from '../../commands/bet';

const DISCORD_ID = 'discord-user-001';

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 1,
    eventId: 10,
    title: '第1試合',
    description: null,
    deadline: new Date(Date.now() + 3600 * 1000).toISOString(),
    isPublished: true,
    status: 'open',
    betType: 'single',
    requiredSelections: null,
    resultSymbols: null,
    betOptions: [
      { id: 1, symbol: 'A', label: 'チームA', order: 1 },
      { id: 2, symbol: 'B', label: 'チームB', order: 2 },
      { id: 3, symbol: 'C', label: 'チームC', order: 3 },
    ],
    ...overrides,
  };
}

function makeInteraction(
  gameNo: number,
  option: string,
  amount: number,
  borrow = false,
  nickname: string | null = 'TestNick',
): ChatInputCommandInteraction {
  return {
    user: { id: DISCORD_ID, username: 'testuser', displayName: 'TestUser', displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/test/avatar.png' },
    member: { nickname },
    guild: { id: 'test-guild-001' },
    options: {
      getInteger: (name: string) => (name === 'game' ? gameNo : name === 'amount' ? amount : null),
      getString: (name: string) => (name === 'option' ? option : null),
      getBoolean: (name: string) => (name === 'borrow' ? borrow : null),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/bet execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getUserByDiscordId).mockResolvedValue({
      id: 1,
      discordId: DISCORD_ID,
      discordName: 'TestUser',
      points: 10000,
    });
  });

  it('single 方式: 正常に賭けを登録できる', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 100,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      amount: 500,
      isDebt: false,
      debtAmount: 0,
      isUpdated: false,
    });

    const interaction = makeInteraction(1, 'A', 500);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('✅ 賭けを受け付けました'),
    );
    expect(api.placeBet).toHaveBeenCalledWith(1, DISCORD_ID, 'TestNick', 'A', 500, false, 'https://cdn.discordapp.com/avatars/test/avatar.png');
  });

  it('multi_unordered: option を昇順ソートして API に送信する', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ betType: 'multi_unordered', requiredSelections: 3 }),
    );
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 101,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'ABC',
      selectedLabels: ['チームA', 'チームB', 'チームC'],
      amount: 100,
      isDebt: false,
      debtAmount: 0,
      isUpdated: false,
    });

    const interaction = makeInteraction(1, 'CAB', 100);
    await execute(interaction);

    // ソートされた 'ABC' が API に渡されているか
    expect(api.placeBet).toHaveBeenCalledWith(1, DISCORD_ID, 'TestNick', 'ABC', 100, false, 'https://cdn.discordapp.com/avatars/test/avatar.png');
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('✅ 賭けを受け付けました'),
    );
  });

  it('賭けの上書き: 🔄 変更メッセージが表示される', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 100,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'B',
      selectedLabels: ['チームB'],
      amount: 300,
      isDebt: false,
      debtAmount: 0,
      isUpdated: true,
    });

    const interaction = makeInteraction(1, 'B', 300);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('🔄 賭けを変更しました'),
    );
  });

  it('借金賭け: isDebt=true の場合は借金メッセージ', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 102,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      amount: 200,
      isDebt: true,
      debtAmount: 200,
      isUpdated: false,
    });

    const interaction = makeInteraction(1, 'A', 200, true);
    await execute(interaction);

    expect(api.placeBet).toHaveBeenCalledWith(1, DISCORD_ID, 'TestNick', 'A', 200, true, 'https://cdn.discordapp.com/avatars/test/avatar.png');
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('借金'),
    );
  });

  it('ゲームが見つからない場合はエラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockRejectedValue(new Error('not found'));

    const interaction = makeInteraction(999, 'A', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('指定されたゲームが見つかりません'),
    );
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  it('ゲームが非公開の場合はエラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame({ isPublished: false }));

    const interaction = makeInteraction(1, 'A', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('受け付けていません'),
    );
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  it('締め切り済みゲームはエラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame({ status: 'closed' }));

    const interaction = makeInteraction(1, 'A', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('受け付けていません'),
    );
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  it('single 方式: 文字数が不正な場合はエラー', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame({ betType: 'single' }));

    const interaction = makeInteraction(1, 'AB', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringMatching(/1文字で入力/),
    );
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  it('multi_ordered: 文字数が不正な場合はエラー', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ betType: 'multi_ordered', requiredSelections: 3 }),
    );

    const interaction = makeInteraction(1, 'AB', 100); // 2文字（必要: 3文字）
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringMatching(/3文字で入力/),
    );
  });

  it('存在しない記号を含む場合はエラー', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());

    const interaction = makeInteraction(1, 'Z', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('記号が見つかりません'),
    );
  });

  it('multi_ordered: 重複記号はエラー', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ betType: 'multi_ordered', requiredSelections: 2 }),
    );

    const interaction = makeInteraction(1, 'AA', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('同じ記号を複数回'),
    );
  });

  it('multi_ordered_dup: 重複記号でもエラーにならない', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ betType: 'multi_ordered_dup', requiredSelections: 2 }),
    );
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 103,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'AA',
      selectedLabels: ['チームA', 'チームA'],
      amount: 100,
      isDebt: false,
      debtAmount: 0,
      isUpdated: false,
    });

    const interaction = makeInteraction(1, 'AA', 100);
    await execute(interaction);

    expect(api.placeBet).toHaveBeenCalledWith(1, DISCORD_ID, 'TestNick', 'AA', 100, false, 'https://cdn.discordapp.com/avatars/test/avatar.png');
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('✅'),
    );
  });

  it('borrow=false でポイント不足の場合はエラー', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.getUserByDiscordId).mockResolvedValue({
      id: 1,
      discordId: DISCORD_ID,
      discordName: 'TestUser',
      points: 50,
    });

    const interaction = makeInteraction(1, 'A', 1000); // 所持50ptで1000pt賭け
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('所持ポイントが足りません'),
    );
    expect(api.placeBet).not.toHaveBeenCalled();
  });

  it('サーバーニックネームがない場合は displayName を使う', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.placeBet).mockResolvedValue({
      id: 100,
      gameId: 1,
      userId: 1,
      selectedSymbols: 'A',
      selectedLabels: ['チームA'],
      amount: 100,
      isDebt: false,
      debtAmount: 0,
      isUpdated: false,
    });

    const interaction = makeInteraction(1, 'A', 100, false, null); // nickname = null
    await execute(interaction);

    // nickname が null の場合は displayName ('TestUser') が渡される
    expect(api.placeBet).toHaveBeenCalledWith(1, DISCORD_ID, 'TestUser', 'A', 100, false, 'https://cdn.discordapp.com/avatars/test/avatar.png');
  });

  it('API エラー時はエラーメッセージを表示', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.placeBet).mockRejectedValue(new Error('conflict'));

    const interaction = makeInteraction(1, 'A', 100);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('賭けに失敗しました'),
    );
  });
});
