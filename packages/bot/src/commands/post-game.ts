import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { extractApiMessage, getGame } from '../lib/api';
import { isAdminMember } from '../lib/admin';
import { betTypeLabel, fmtDeadline } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('post-game')
  .setDescription('ゲーム情報をチャンネルに投稿します（管理者のみ）')
  .addIntegerOption((opt) =>
    opt.setName('game').setDescription('ゲームID').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // 管理者ロールチェック
  const member = interaction.guild
    ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    : null;

  if (!isAdminMember(member)) {
    await interaction.reply({
      content: '❌ このコマンドは管理者のみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const gameId = interaction.options.getInteger('game', true);

  let game;
  try {
    game = await getGame(gameId);
  } catch {
    await interaction.editReply('❌ 指定されたゲームが見つかりません。');
    return;
  }

  if (!game.isPublished) {
    await interaction.editReply('❌ 非公開のゲームは投稿できません。');
    return;
  }

  const isSingle = game.betType === 'single';
  const typeLabel = isSingle ? '' : `  [${betTypeLabel(game.betType, game.requiredSelections)}]`;
  const n = game.requiredSelections ?? 1;

  const lines: string[] = [];
  lines.push(`🎮 **ゲーム情報** - ${game.title}${typeLabel}`);

  if (game.description) {
    lines.push('');
    lines.push(`説明: ${game.description}`);
  }

  lines.push('');
  lines.push('賭け項目:');
  for (const opt of game.betOptions) {
    lines.push(`  ${opt.symbol}: ${opt.label}`);
  }

  lines.push('');
  lines.push(`締め切り: ${fmtDeadline(game.deadline)}`);
  lines.push('');

  if (isSingle) {
    lines.push(
      `賭けるには \`/bet game:${game.id} option:<記号> amount:<ポイント>\` を使ってください。`,
    );
    const exSymbol = game.betOptions[0]?.symbol ?? 'A';
    lines.push(`例: \`/bet game:${game.id} option:${exSymbol} amount:100\``);
  } else {
    lines.push(
      `賭けるには \`/bet game:${game.id} option:<記号を${n}文字> amount:<ポイント>\` を使ってください。`,
    );
    const exSymbols = game.betOptions
      .slice(0, n)
      .map((o) => o.symbol)
      .join('');
    lines.push(`例: \`/bet game:${game.id} option:${exSymbols} amount:100\``);
  }

  await interaction.editReply(lines.join('\n'));
}
