import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { extractApiMessage, getEventBets, getEvents, getUserByDiscordId } from '../lib/api';
import { betTypeLabel, fmtPt, formatSelection } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('mybets')
  .setDescription('開催中イベントで自分が賭けた全ゲームの状況を確認します');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;

  // 開催中イベント取得
  let activeEvent;
  try {
    const guildId = interaction.guild?.id;
    if (!guildId) {
      await interaction.editReply('❌ サーバー内でのみ使用できます。');
      return;
    }
    const events = await getEvents(guildId);
    activeEvent = events.find((e) => e.isActive);
  } catch (err) {
    await interaction.editReply(
      `❌ イベント情報の取得に失敗しました。\n理由: ${extractApiMessage(err)}`
    );
    return;
  }

  if (!activeEvent) {
    await interaction.editReply('❌ 現在開催中のイベントがありません。');
    return;
  }

  // ユーザー取得
  let userInfo;
  try {
    userInfo = await getUserByDiscordId(discordId, activeEvent.id);
  } catch {
    await interaction.editReply('❌ ユーザー情報が見つかりません。先に /bet を実行してください。');
    return;
  }

  // イベント内の全賭け取得
  let eventBets;
  try {
    eventBets = await getEventBets(userInfo.id, activeEvent.id);
  } catch (err) {
    await interaction.editReply(
      `❌ 賭け情報の取得に失敗しました。\n理由: ${extractApiMessage(err)}`
    );
    return;
  }

  const lines: string[] = [];
  lines.push(`📋 **${eventBets.eventName}** - あなたの賭け一覧`);

  if (eventBets.bets.length === 0) {
    lines.push('このイベントにはまだ賭けていません。');
    lines.push('');
    lines.push(`現在の所持ポイント: ${fmtPt(eventBets.currentPoints)}`);
    await interaction.editReply(lines.join('\n'));
    return;
  }

  let wins = 0;
  let losses = 0;

  for (const bet of eventBets.bets) {
    const typeLabel = betTypeLabel(bet.betType, bet.requiredSelections);

    // 選択項目を文字列化するために optMap を構成
    // API は selectedLabels を返すが、formatSelection のために optMap が必要
    // selectedLabels と selectedSymbols から簡易 optMap を構築する
    const chars = bet.selectedSymbols.split('');
    const optMap = new Map<string, string>(chars.map((c, i) => [c, bet.selectedLabels[i] ?? c]));
    const selectionStr = formatSelection(bet.selectedSymbols, optMap, bet.betType);
    const debtMark = bet.isDebt ? '（借金）' : '';

    if (bet.gameStatus === 'finished') {
      if (bet.result === 'win') {
        wins++;
        const gained = bet.pointChange ?? 0;
        lines.push('');
        lines.push(`**${bet.gameTitle}** ✅ 当選  [${typeLabel}]`);
        lines.push(
          `  ${selectionStr} に ${fmtPt(bet.amount)}${debtMark} | 獲得: +${fmtPt(gained)}`
        );
      } else {
        losses++;
        lines.push('');
        lines.push(`**${bet.gameTitle}** ❌ 落選  [${typeLabel}]`);
        lines.push(`  ${selectionStr} に ${fmtPt(bet.amount)}${debtMark} | 獲得: +0pt`);
      }
    } else {
      const statusMark = bet.gameStatus === 'open' ? '⏰ 受付中' : '🔒 締切済';
      const oddsStr =
        bet.odds !== null && bet.estimatedPayout !== null
          ? `現在倍率: ×${bet.odds}倍（当選時: +${fmtPt(bet.estimatedPayout)} 予定）`
          : '倍率: 計算中';
      lines.push('');
      lines.push(`**${bet.gameTitle}** ${statusMark}  [${typeLabel}]`);
      lines.push(`  ${selectionStr} に ${fmtPt(bet.amount)}${debtMark} | ${oddsStr}`);
    }
  }

  lines.push('');
  const totalGames = eventBets.bets.length;
  const finishedGames = eventBets.bets.filter((b) => b.gameStatus === 'finished').length;
  const summary =
    finishedGames > 0
      ? `合計 ${totalGames}ゲーム | ${wins}勝 ${losses}敗 | 現在の所持ポイント: ${fmtPt(eventBets.currentPoints)}`
      : `合計 ${totalGames}ゲーム | 現在の所持ポイント: ${fmtPt(eventBets.currentPoints)}`;
  lines.push(summary);

  // Discord メッセージは 2000 文字制限があるため、超過した場合は省略
  const content = lines.join('\n');
  if (content.length > 1900) {
    await interaction.editReply(content.slice(0, 1900) + '\n…（省略）');
  } else {
    await interaction.editReply(content);
  }
}
