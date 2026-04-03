import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';
import { isAdminMember } from '../lib/admin';

export const data = new SlashCommandBuilder()
  .setName('admin-link')
  .setDescription('管理者用 WebアプリのURLを表示します（管理者のみ）');

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

  if (!config.webAppBaseUrl || !config.adminToken) {
    await interaction.reply({
      content: '❌ Webアプリの URL またはトークンが設定されていません。管理者に確認してください。',
      ephemeral: true,
    });
    return;
  }

  // ハッシュフラグメントにトークンを埋め込む（サーバーログに残らないように）
  const url = `${config.webAppBaseUrl.replace(/\/$/, '')}/#/?token=${config.adminToken}`;

  await interaction.reply({
    content: `🔑 管理者用URLです。他の人に共有しないでください。\n\n${url}`,
    ephemeral: true,
  });
}
