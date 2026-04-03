import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('WebアプリのURLを表示します');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!config.webAppBaseUrl) {
    await interaction.reply({
      content: '❌ Webアプリの URL が設定されていません。管理者に確認してください。',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({
      content: '❌ サーバー内でのみ使用できます。',
      ephemeral: true,
    });
    return;
  }

  // 一般ユーザー向けURL（トークンなし）
  const url = `${config.webAppBaseUrl.replace(/\/$/, '')}/#/events/${guildId}`;

  await interaction.reply({
    content: `🌐 WebアプリのURLです。\n\n${url}`,
    ephemeral: true,
  });
}
