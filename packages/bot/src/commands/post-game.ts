import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { extractApiMessage, getEventGames, getEvents, getGameByNo } from '../lib/api';
import { isAdminMember } from '../lib/admin';
import { betTypeLabel, fmtDeadline } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('post-game')
  .setDescription('ゲーム情報をチャンネルに投稿します（管理者のみ）')
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

  const gameNo = interaction.options.getInteger('game', true);
  const guildId = interaction.guild?.id;

  if (!guildId) {
    await interaction.editReply('❌ サーバー情報が取得できませんでした。');
    return;
  }

  let game;
  try {
    game = await getGameByNo(guildId, gameNo);
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
      `賭けるには \`/bet game:${gameNo} option:<記号> amount:<ポイント>\` を使ってください。`,
    );
    const exSymbol = game.betOptions[0]?.symbol ?? 'A';
    lines.push(`例: \`/bet game:${gameNo} option:${exSymbol} amount:100\``);
  } else {
    lines.push(
      `賭けるには \`/bet game:${gameNo} option:<記号を${n}文字> amount:<ポイント>\` を使ってください。`,
    );
    const exSymbols = game.betOptions
      .slice(0, n)
      .map((o) => o.symbol)
      .join('');
    lines.push(`例: \`/bet game:${gameNo} option:${exSymbols} amount:100\``);
  }

  await interaction.editReply(lines.join('\n'));
}
