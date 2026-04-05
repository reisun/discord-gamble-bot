import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { BetListResponse, Event, Game } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getGameByNo: vi.fn(),
  getEvents: vi.fn(),
  getEventGames: vi.fn(),
  getBetList: vi.fn(),
  getUserByDiscordId: vi.fn(),
  extractApiMessage: vi.fn(() => 'APIエラー'),
}));

import * as api from '../../lib/api';
import { execute } from '../../commands/mybet';

const DISCORD_ID = 'discord-user-001';
const USER_ID = 42;

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: 5,
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
    ],
    ...overrides,
  };
}

function makeBetList(overrides: Partial<BetListResponse> = {}): BetListResponse {
  return {
    betType: 'single',
    requiredSelections: null,
    combinations: [
      { selectedSymbols: 'A', selectedLabels: ['チームA'], odds: 2.0, totalPoints: 400, betCount: 2 },
    ],
    bets: [
      {
        userId: USER_ID,
        userName: 'TestUser',
        selectedSymbols: 'A',
        selectedLabels: ['チームA'],
        amount: 200,
        isDebt: false,
        result: null,
      },
    ],
    ...overrides,
  };
}

function makeInteraction(gameNo: number): ChatInputCommandInteraction {
  return {
    user: { id: DISCORD_ID },
    guild: { id: 'test-guild-001' },
    options: {
      getInteger: (name: string) => (name === 'game' ? gameNo : null),
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('/mybet execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getUserByDiscordId).mockResolvedValue({
      id: USER_ID,
      discordId: DISCORD_ID,
      discordName: 'TestUser',
      points: 9800,
    });
  });

  it('受付中ゲームで賭けあり: 倍率と予想獲得ポイントを表示', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.getBetList).mockResolvedValue(makeBetList());

    const interaction = makeInteraction(1);
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('第1試合');
    expect(reply).toContain('チームA');
    expect(reply).toContain('200pt');
    expect(reply).toContain('×2');
  });

  it('終了ゲームで当選: 当選マークと獲得ポイントを表示', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ status: 'finished', resultSymbols: 'A' }),
    );
    vi.mocked(api.getBetList).mockResolvedValue(
      makeBetList({
        bets: [
          {
            userId: USER_ID,
            userName: 'TestUser',
            selectedSymbols: 'A',
            selectedLabels: ['チームA'],
            amount: 200,
            isDebt: false,
            result: 'win',
            pointChange: 400,
          },
        ],
      }),
    );

    const interaction = makeInteraction(1);
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('✅ 当選');
    expect(reply).toContain('400pt');
  });

  it('終了ゲームで落選: 落選マークと獲得0ptを表示', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(
      makeGame({ status: 'finished', resultSymbols: 'B' }),
    );
    vi.mocked(api.getBetList).mockResolvedValue(
      makeBetList({
        bets: [
          {
            userId: USER_ID,
            userName: 'TestUser',
            selectedSymbols: 'A',
            selectedLabels: ['チームA'],
            amount: 200,
            isDebt: false,
            result: 'lose',
          },
        ],
      }),
    );

    const interaction = makeInteraction(1);
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('❌ 落選');
    expect(reply).toContain('+0pt');
  });

  it('ユーザー未登録: 賭けなしメッセージを返す', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.getUserByDiscordId).mockRejectedValue(new Error('not found'));

    const interaction = makeInteraction(1);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('まだ賭けていません'),
    );
  });

  it('自分の賭けが賭け一覧に存在しない: 賭けなしメッセージを返す', async () => {
    vi.mocked(api.getGameByNo).mockResolvedValue(makeGame());
    vi.mocked(api.getBetList).mockResolvedValue(makeBetList({ bets: [] }));

    const interaction = makeInteraction(1);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('まだ賭けていません'),
    );
  });

  it('ゲームが見つからない: エラーメッセージ', async () => {
    vi.mocked(api.getGameByNo).mockRejectedValue(new Error('not found'));

    const interaction = makeInteraction(999);
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('ゲームが見つかりません'),
    );
  });
});
