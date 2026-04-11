import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config';

export const data = new SlashCommandBuilder()
  .setName('dashboard')
  .setDescription('Webアプリへのリンクを表示します');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({
      content: '❌ サーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  if (!config.webAppBaseUrl) {
    await interaction.reply({
      content: '❌ URL設定が不足しています。管理者に確認してください。',
      ephemeral: true,
    });
    return;
  }

  const url = `${config.webAppBaseUrl.replace(/\/$/, '')}/#/dashboard/${guildId}`;

  const button = new ButtonBuilder()
    .setLabel('Webアプリを開く')
    .setStyle(ButtonStyle.Link)
    .setURL(url);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.reply({
    content: '🌐 Webアプリを開くにはDiscordアカウントでログインしてください。',
    components: [row],
    ephemeral: true,
  });
}
