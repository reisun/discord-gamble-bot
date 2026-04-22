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

  if (!config.webAppBaseUrl || !config.apiBaseUrl) {
    await interaction.reply({
      content: '❌ URL設定が不足しています。管理者に確認してください。',
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);

  const role = (await isAdminMember(member)) ? 'editor' : 'viewer';

  let token: string;
  try {
    const res = await api.post<{ data: { token: string } }>('/api/auth/token', { guildId, role });
    token = res.data.data.token;
  } catch {
    await interaction.reply({
      content: '❌ アクセストークンの生成に失敗しました。',
      ephemeral: true,
    });
    return;
  }

  const url = `${config.webAppBaseUrl.replace(/\/$/, '')}/#/dashboard/${guildId}?token=${token}`;

  const button = new ButtonBuilder()
    .setLabel('Webアプリを開く')
    .setStyle(ButtonStyle.Link)
    .setURL(url);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  const content =
    role === 'editor'
      ? '🔑 管理者用のリンクです。このボタンは本人のみ使用してください。有効期限は12時間です。'
      : '🌐 閲覧用のリンクです。このボタンは本人のみ使用してください。有効期限は12時間です。';

  await interaction.reply({
    content,
    components: [row],
    ephemeral: true,
  });
}
