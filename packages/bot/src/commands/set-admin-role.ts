import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { updateGuildAdminRole } from '../lib/api';

export const data = new SlashCommandBuilder()
  .setName('set-admin-role')
  .setDescription('gamble-bot の管理者ロールを設定します（サーバー管理者のみ）')
  .addRoleOption((opt) =>
    opt.setName('role').setDescription('管理者として設定するロール').setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: '❌ サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  const role = interaction.options.getRole('role', true);

  try {
    await updateGuildAdminRole(guild.id, guild.name, role.id);
  } catch {
    await interaction.reply({
      content: '❌ 管理者ロールの設定に失敗しました。',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `✅ 管理者ロールを **${role.name}** に設定しました。`,
    ephemeral: true,
  });
}
