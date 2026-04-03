import { GuildMember } from 'discord.js';
import { config } from '../config';

/** Discord メンバーが管理者ロールを持っているか確認する */
export function isAdminMember(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  if (config.discordAdminRoleIds.length === 0) return false;
  return config.discordAdminRoleIds.some((roleId) => member.roles.cache.has(roleId));
}
