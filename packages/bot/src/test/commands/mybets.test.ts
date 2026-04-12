import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { EventBetsResponse } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  getEvents: vi.fn(),
  getUserByDiscordId: vi.fn(),
  getEventBets: vi.fn(),
  extractApiMessage: vi.fn(() => 'APIエラー'),
}));

import * as api from '../../lib/api';
import { execute } from '../../commands/mybets';

const DISCORD_ID = 'discord-user-001';
const USER_ID = 42;
const EVENT_ID = 1;

const GUILD_ID = 'test-guild-001';

function makeInteraction(): ChatInputCommandInteraction {
  return {
    user: { id: DISCORD_ID },
    guild: { id: GUILD_ID },
    options: {},
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

function makeEventBets(overrides: Partial<EventBetsResponse> = {}): EventBetsResponse {
  return {
    eventId: EVENT_ID,
    eventName: 'テスト大会',
    currentPoints: 9500,
    bets: [],
    ...overrides,
  };
}

describe('/mybets execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getEvents).mockResolvedValue([
      {
        id: EVENT_ID,
        guildId: GUILD_ID,
        name: 'テスト大会',
        isActive: true,
        initialPoints: 10000,
        resultsPublic: false,
      },
    ]);
    vi.mocked(api.getUserByDiscordId).mockResolvedValue({
      id: USER_ID,
      discordId: DISCORD_ID,
      discordName: 'TestUser',
      points: 9500,
    });
    vi.mocked(api.getEventBets).mockResolvedValue(makeEventBets());
  });

  it('開催中イベントがない場合はエラー', async () => {
    vi.mocked(api.getEvents).mockResolvedValue([
      {
        id: 2,
        guildId: GUILD_ID,
        name: '終了大会',
        isActive: false,
        initialPoints: 10000,
        resultsPublic: true,
      },
    ]);

    const interaction = makeInteraction();
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('開催中のイベントがありません')
    );
  });

  it('ユーザー未登録の場合はエラー', async () => {
    vi.mocked(api.getUserByDiscordId).mockRejectedValue(new Error('not found'));

    const interaction = makeInteraction();
    await execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('ユーザー情報が見つかりません')
    );
  });

  it('賭けが0件の場合は「まだ賭けていません」と所持ポイントを表示', async () => {
    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('テスト大会');
    expect(reply).toContain('まだ賭けていません');
    expect(reply).toContain('9,500pt');
  });

  it('受付中ゲームの賭けを表示（⏰マーク・倍率）', async () => {
    vi.mocked(api.getEventBets).mockResolvedValue(
      makeEventBets({
        bets: [
          {
            gameId: 1,
            gameTitle: '第1試合',
            gameStatus: 'open',
            betType: 'single',
            requiredSelections: null,
            deadline: new Date(Date.now() + 3600 * 1000).toISOString(),
            selectedSymbols: 'A',
            selectedLabels: ['チームA'],
            amount: 300,
            isDebt: false,
            odds: 1.5,
            estimatedPayout: 450,
            result: null,
            pointChange: null,
          },
        ],
      })
    );

    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('第1試合');
    expect(reply).toContain('⏰ 受付中');
    expect(reply).toContain('300pt');
    expect(reply).toContain('×1.5倍');
  });

  it('当選ゲームを表示（✅マーク・獲得ポイント）', async () => {
    vi.mocked(api.getEventBets).mockResolvedValue(
      makeEventBets({
        bets: [
          {
            gameId: 2,
            gameTitle: '第2試合',
            gameStatus: 'finished',
            betType: 'single',
            requiredSelections: null,
            deadline: new Date(Date.now() - 3600 * 1000).toISOString(),
            selectedSymbols: 'B',
            selectedLabels: ['チームB'],
            amount: 500,
            isDebt: false,
            odds: null,
            estimatedPayout: null,
            result: 'win',
            pointChange: 750,
          },
        ],
      })
    );

    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('✅ 当選');
    expect(reply).toContain('+750pt');
    expect(reply).toContain('1勝 0敗');
  });

  it('落選ゲームを表示（❌マーク）', async () => {
    vi.mocked(api.getEventBets).mockResolvedValue(
      makeEventBets({
        bets: [
          {
            gameId: 3,
            gameTitle: '第3試合',
            gameStatus: 'finished',
            betType: 'single',
            requiredSelections: null,
            deadline: new Date(Date.now() - 3600 * 1000).toISOString(),
            selectedSymbols: 'A',
            selectedLabels: ['チームA'],
            amount: 200,
            isDebt: false,
            odds: null,
            estimatedPayout: null,
            result: 'lose',
            pointChange: 0,
          },
        ],
      })
    );

    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('❌ 落選');
    expect(reply).toContain('+0pt');
    expect(reply).toContain('0勝 1敗');
  });

  it('締切済みゲームを表示（🔒マーク）', async () => {
    vi.mocked(api.getEventBets).mockResolvedValue(
      makeEventBets({
        bets: [
          {
            gameId: 4,
            gameTitle: '第4試合',
            gameStatus: 'closed',
            betType: 'single',
            requiredSelections: null,
            deadline: new Date(Date.now() - 60 * 1000).toISOString(),
            selectedSymbols: 'C',
            selectedLabels: ['チームC'],
            amount: 100,
            isDebt: true,
            odds: 3.0,
            estimatedPayout: 300,
            result: null,
            pointChange: null,
          },
        ],
      })
    );

    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('🔒 締切済');
    expect(reply).toContain('借金');
    expect(reply).toContain('×3倍');
  });

  it('賭けありの場合、現在の所持ポイントをサマリーに表示', async () => {
    vi.mocked(api.getEventBets).mockResolvedValue(
      makeEventBets({
        currentPoints: 9500,
        bets: [
          {
            gameId: 1,
            gameTitle: '第1試合',
            gameStatus: 'open',
            betType: 'single',
            requiredSelections: null,
            deadline: new Date(Date.now() + 3600 * 1000).toISOString(),
            selectedSymbols: 'A',
            selectedLabels: ['チームA'],
            amount: 500,
            isDebt: false,
            odds: 2.0,
            estimatedPayout: 1000,
            result: null,
            pointChange: null,
          },
        ],
      })
    );

    const interaction = makeInteraction();
    await execute(interaction);

    const reply = vi.mocked(interaction.editReply).mock.calls[0][0] as string;
    expect(reply).toContain('9,500pt');
  });
});
