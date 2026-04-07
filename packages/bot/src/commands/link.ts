import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { config } from '../config';
import { isAdminMember } from '../lib/admin';
import { api } from '../lib/api';

export const data = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Webアプリへのリンクを表示します');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({ content: '❌ サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  if (!config.webAppBaseUrl || !config.apiBaseUrl || !config.serverPublicUrl) {
    await interaction.reply({ content: '❌ URL設定が不足しています。管理者に確認してください。', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  const role = isAdminMember(member) ? 'editor' : 'viewer';

  let token: string;
  try {
    const res = await api.post<{ data: { token: string } }>('/api/auth/token', { guildId, role }, {
      headers: { Authorization: `Bearer ${config.adminToken}` },
    });
    token = res.data.data.token;
  } catch {
    await interaction.reply({ content: '❌ アクセストークンの生成に失敗しました。', ephemeral: true });
    return;
  }

  const url = `${config.serverPublicUrl}/api/entrance/${guildId}?token=${token}`;

  const button = new ButtonBuilder()
    .setLabel('Webアプリを開く')
    .setStyle(ButtonStyle.Link)
    .setURL(url);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
  const label = role === 'editor' ? '🔑 管理者用' : '🌐 閲覧用';

  await interaction.reply({
    content: `${label}のリンクです。このボタンは本人のみ使用してください。有効期限は5分です。`,
    components: [row],
    ephemeral: true,
  });
}
