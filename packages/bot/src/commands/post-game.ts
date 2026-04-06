import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getEventGamesAdmin, getEvents, publishGame } from '../lib/api';
import { isAdminMember } from '../lib/admin';
import { betTypeLabel, fmtDeadline, fmtRemaining } from '../lib/format';

export const data = new SlashCommandBuilder()
  .setName('post-game')
  .setDescription('ゲーム情報をチャンネルに投稿します（管理者のみ）')
  .addIntegerOption((opt) =>
    opt
      .setName('game')
      .setDescription('ゲーム番号（未公開のゲームも候補に表示されます）')
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
    const allGames = await getEventGamesAdmin(activeEvent.id);

    const query = focused.value.toString().toLowerCase();
    const choices = allGames
      .filter((g) => {
        const gameNo = allGames.findIndex((ag) => ag.id === g.id) + 1;
        if (!query) return true;
        return String(gameNo).includes(query) || g.title.toLowerCase().includes(query);
      })
      .slice(0, 25)
      .map((g) => {
        const gameNo = allGames.findIndex((ag) => ag.id === g.id) + 1;
        const label = g.isPublished ? `#${gameNo} ${g.title}` : `#${gameNo} ${g.title} [非公開]`;
        return { name: label, value: gameNo };
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
    const events = await getEvents(guildId);
    const activeEvent = events.find((e) => e.isActive);
    if (!activeEvent) throw new Error('no active event');
    const allGames = await getEventGamesAdmin(activeEvent.id);
    game = allGames[gameNo - 1];
    if (!game) throw new Error('not found');
  } catch {
    await interaction.editReply('❌ 指定されたゲームが見つかりません。');
    return;
  }

  // 非公開の場合は自動で公開する
  if (!game.isPublished) {
    try {
      await publishGame(game.id);
    } catch {
      await interaction.editReply('❌ ゲームの公開に失敗しました。');
      return;
    }
  }

  const isSingle = game.betType === 'single';
  const n = game.requiredSelections ?? 1;

  const embed = new EmbedBuilder()
    .setTitle(`🎮 #${gameNo} ${game.title}`)
    .setColor(0x5865f2); // Discord Blurple

  if (game.description) {
    embed.setDescription(game.description);
  }

  if (!isSingle) {
    embed.addFields({
      name: '賭け方式',
      value: betTypeLabel(game.betType, game.requiredSelections),
      inline: true,
    });
  }

  embed.addFields(
    {
      name: '締め切り',
      value: [fmtDeadline(game.deadline), fmtRemaining(game.deadline)].filter(Boolean).join(' '),
      inline: true,
    },
    {
      name: '賭け項目',
      value: game.betOptions.map((o) => `\`${o.symbol}\` ${o.label}`).join('\n'),
    },
  );

  const exSymbols = isSingle
    ? (game.betOptions[0]?.symbol ?? 'A')
    : game.betOptions.slice(0, n).map((o) => o.symbol).join('');
  const usageHint = isSingle
    ? `\`/bet game:${gameNo} option:<記号> amount:<ポイント>\``
    : `\`/bet game:${gameNo} option:<記号を${n}文字> amount:<ポイント>\``;
  const exampleLine = `/bet game:${gameNo} option:${exSymbols} amount:100`;

  embed.addFields({
    name: '賭け方法',
    value: `${usageHint}\n例: \`${exampleLine}\``,
  });

  await interaction.editReply({ embeds: [embed] });
}
