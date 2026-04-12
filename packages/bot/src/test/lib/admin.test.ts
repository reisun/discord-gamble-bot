import { describe, it, expect, vi } from 'vitest';

// config モジュールをモック
vi.mock('../../config', () => ({
  config: {
    discordAdminRoleIds: ['role-admin', 'role-superadmin'],
  },
}));

import { isAdminMember } from '../../lib/admin';
import type { GuildMember } from 'discord.js';

function makeMember(roleIds: string[]): GuildMember {
  return {
    roles: {
      cache: {
        has: (id: string) => roleIds.includes(id),
      },
    },
  } as unknown as GuildMember;
}

describe('isAdminMember', () => {
  it('管理者ロールを持つメンバーは true', () => {
    expect(isAdminMember(makeMember(['role-admin']))).toBe(true);
  });

  it('複数ロールのうちいずれかが一致すれば true', () => {
    expect(isAdminMember(makeMember(['role-user', 'role-superadmin']))).toBe(true);
  });

  it('管理者ロールを持たないメンバーは false', () => {
    expect(isAdminMember(makeMember(['role-user']))).toBe(false);
  });

  it('ロールが空でも false', () => {
    expect(isAdminMember(makeMember([]))).toBe(false);
  });

  it('null の場合は false', () => {
    expect(isAdminMember(null)).toBe(false);
  });

  it('undefined の場合は false', () => {
    expect(isAdminMember(undefined)).toBe(false);
  });
});
