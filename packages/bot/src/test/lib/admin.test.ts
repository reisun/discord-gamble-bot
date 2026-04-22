import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/api', () => ({
  getGuild: vi.fn(),
}));

import { isAdminMember } from '../../lib/admin';
import { getGuild } from '../../lib/api';
import type { GuildMember } from 'discord.js';

function makeMember(roleIds: string[]): GuildMember {
  return {
    guild: { id: 'guild-001' },
    roles: {
      cache: {
        has: (id: string) => roleIds.includes(id),
      },
    },
  } as unknown as GuildMember;
}

describe('isAdminMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGuild).mockResolvedValue({
      guildId: 'guild-001',
      guildName: 'Test Guild',
      guildIconUrl: null,
      adminRoleId: 'role-admin',
    });
  });

  it('管理者ロールを持つメンバーは true', async () => {
    expect(await isAdminMember(makeMember(['role-admin']))).toBe(true);
  });

  it('管理者ロールを持たないメンバーは false', async () => {
    expect(await isAdminMember(makeMember(['role-user']))).toBe(false);
  });

  it('ロールが空でも false', async () => {
    expect(await isAdminMember(makeMember([]))).toBe(false);
  });

  it('null の場合は false', async () => {
    expect(await isAdminMember(null)).toBe(false);
  });

  it('undefined の場合は false', async () => {
    expect(await isAdminMember(undefined)).toBe(false);
  });

  it('adminRoleId が未設定の場合は false', async () => {
    vi.mocked(getGuild).mockResolvedValue({
      guildId: 'guild-001',
      guildName: 'Test Guild',
      guildIconUrl: null,
      adminRoleId: null,
    });
    expect(await isAdminMember(makeMember(['role-admin']))).toBe(false);
  });

  it('API エラーの場合は false', async () => {
    vi.mocked(getGuild).mockRejectedValue(new Error('Network error'));
    expect(await isAdminMember(makeMember(['role-admin']))).toBe(false);
  });
});
