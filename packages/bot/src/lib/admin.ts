import { GuildMember } from 'discord.js';
import { getGuild } from './api';

/** Discord メンバーが管理者ロールを持っているか確認する */
export async function isAdminMember(member: GuildMember | null | undefined): Promise<boolean> {
  if (!member) return false;
  const guildId = member.guild.id;
  try {
    const guild = await getGuild(guildId);
    if (!guild.adminRoleId) return false;
    return member.roles.cache.has(guild.adminRoleId);
  } catch {
    return false;
  }
}
