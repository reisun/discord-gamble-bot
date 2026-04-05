import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import {
  extractApiMessage,
  getBetList,
  getEventGames,
  getEvents,
  getGameByNo,
  getUserByDiscordId,
} from '../lib/api';
import { betTypeLabel, buildOptMap, fmtDeadline, fmtPt, formatSelection } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('mybet')
  .setDescription('指定ゲームにおける自分の賭け状況を確認します')
  .addIntegerOption((opt) =>
    opt
      .setName('game')
      .setDescription('ゲーム番号（公開中のゲームが候補に表示されます）')
      .setRequired(true)
      .setAutocomplete(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'game') return;

  try {
    const guildId = interaction.guild?.id;
    if (!guildId) { await interaction.respond([]); return; }
    const events = await getEvents(guildId);
    const activeEvent = events.find((e) => e.isActive);
    if (!activeEvent) { await interaction.respond([]); return; }
    const allGames = await getEventGames(activeEvent.id);
    const publishedGames = allGames.filter((g) => g.isPublished);

    const query = focused.value.toString().toLowerCase();
    const choices = publishedGames
      .filter((g) => {
        const gameNo = allGames.findIndex((ag) => ag.id === g.id) + 1;
        if (!query) return true;
        return String(gameNo).includes(query) || g.title.toLowerCase().includes(query);
      })
      .slice(0, 25)
      .map((g) => {
        const gameNo = allGames.findIndex((ag) => ag.id === g.id) + 1;
        return { name: `#${gameNo} ${g.title}`, value: gameNo };
      });

    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const gameNo = interaction.options.getInteger('game', true);
  const discordId = interaction.user.id;
  const guildId = interaction.guild?.id;

  if (!guildId) {
    await interaction.editReply('❌ サーバー情報が取得できませんでした。');
    return;
  }

  // ゲーム取得（gameNo → game）
  let game;
  try {
    game = await getGameByNo(guildId, gameNo);
  } catch {
    await interaction.editReply('❌ 指定されたゲームが見つかりません。');
    return;
  }

  // ユーザー取得
  let userInfo;
  try {
    userInfo = await getUserByDiscordId(discordId);
  } catch {
    await interaction.editReply('このゲームにはまだ賭けていません。');
    return;
  }

  // 賭け一覧取得
  let betList;
  try {
    betList = await getBetList(game.id);
  } catch (err) {
    await interaction.editReply(`❌ 賭け情報の取得に失敗しました。\n理由: ${extractApiMessage(err)}`);
    return;
  }

  // 自分の賭けを検索
  const myBet = betList.bets.find((b) => b.userId === userInfo.id);
  if (!myBet) {
    await interaction.editReply('このゲームにはまだ賭けていません。');
    return;
  }

  const optMap = buildOptMap(game);
  const typeLabel = betTypeLabel(game.betType, game.requiredSelections);
  const isFinished = game.status === 'finished';

  const lines: string[] = [];

  if (isFinished) {
    lines.push(`📋 ゲーム: ${game.title}（結果確定）  [${typeLabel}]`);
  } else {
    lines.push(`📋 ゲーム: ${game.title}  [${typeLabel}]`);
    lines.push(`締め切り: ${fmtDeadline(game.deadline)}`);
  }

  lines.push('');
  lines.push('あなたの賭け:');

  const selectionStr = formatSelection(myBet.selectedSymbols, optMap, game.betType);

  if (isFinished) {
    const isWin = myBet.result === 'win';
    const resultMark = isWin ? '✅ 当選' : '❌ 落選';
    lines.push(`  賭けた項目: ${selectionStr} ${resultMark}`);
    lines.push(`  賭けたポイント: ${fmtPt(myBet.amount)}`);
    if (isWin) {
      const gained = myBet.pointChange ?? 0;
      lines.push(`  獲得ポイント: +${fmtPt(gained)}`);
    } else {
      lines.push('  獲得ポイント: +0pt');
    }
  } else {
    lines.push(`  賭けた項目: ${selectionStr}`);
    lines.push(`  賭けたポイント: ${fmtPt(myBet.amount)}`);

    // 現在の倍率を自前計算（API が odds=null を返す場合があるため組み合わせから計算）
    const myComb = betList.combinations.find(
      (c) => c.selectedSymbols === myBet.selectedSymbols,
    );
    if (myComb && myComb.odds !== null) {
      const estimated = Math.floor(myBet.amount * myComb.odds);
      lines.push(
        `  現在の倍率: ×${myComb.odds}倍（当選時: +${fmtPt(estimated)} 予定）`,
      );
    }
  }

  await interaction.editReply(lines.join('\n'));
}
