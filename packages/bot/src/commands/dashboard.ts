import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config';
import { isAdminMember } from '../lib/admin';
import { api } from '../lib/api';

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

  const baseUrl = `${config.webAppBaseUrl.replace(/\/$/, '')}/#/dashboard/${guildId}`;

  const member = await interaction.guild!.members
    .fetch(interaction.user.id)
    .catch(() => null);

  if (isAdminMember(member)) {
    // 管理者: editor トークンを発行して URL に付与
    let token: string;
    try {
      const res = await api.post<{ data: { token: string } }>(
        '/api/auth/token',
        { guildId, role: 'editor' },
        { headers: { Authorization: `Bearer ${config.adminToken}` } },
      );
      token = res.data.data.token;
    } catch {
      await interaction.reply({
        content: '❌ アクセストークンの生成に失敗しました。',
        ephemeral: true,
      });
      return;
    }

    const url = `${baseUrl}?token=${token}`;

    const button = new ButtonBuilder()
      .setLabel('管理者用ダッシュボード')
      .setStyle(ButtonStyle.Link)
      .setURL(url);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content: '🔑 管理者用のリンクです。このボタンは本人のみ使用してください。有効期限は12時間です。',
      components: [row],
      ephemeral: true,
    });
  } else {
    // 一般ユーザー: トークンなし URL（OAuth2 でログイン）
    const button = new ButtonBuilder()
      .setLabel('Webアプリを開く')
      .setStyle(ButtonStyle.Link)
      .setURL(baseUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({
      content: '🌐 Webアプリを開くにはDiscordアカウントでログインしてください。',
      components: [row],
      ephemeral: true,
    });
  }
}
