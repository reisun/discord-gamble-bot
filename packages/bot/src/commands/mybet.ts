import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { extractApiMessage, getBetList, getGame, getUserByDiscordId } from '../lib/api';
import { betTypeLabel, buildOptMap, fmtDeadline, fmtPt, formatSelection } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('mybet')
  .setDescription('指定ゲームにおける自分の賭け状況を確認します')
  .addIntegerOption((opt) =>
    opt.setName('game').setDescription('ゲームID').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const gameId = interaction.options.getInteger('game', true);
  const discordId = interaction.user.id;

  // ゲーム取得
  let game;
  try {
    game = await getGame(gameId);
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
    betList = await getBetList(gameId);
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
