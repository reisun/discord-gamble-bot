import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../api/client';
import { toDashboard, toHashPath } from '../routes';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../api/client');

function renderHeader({ isEditor = false, guildId = null as string | null } = {}) {
  vi.mocked(useAuth).mockReturnValue({ isEditor, isVerifying: false, guildId });
  vi.mocked(api.getGuild).mockResolvedValue({ guildId: guildId ?? '', guildName: 'テストサーバー', guildIconUrl: null });
  return render(<MemoryRouter><Header /></MemoryRouter>);
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ロゴ・タイトルが表示される', () => {
    renderHeader();
    expect(screen.getByText('賭けダッシュボード')).toBeInTheDocument();
    expect(screen.getByRole('link').querySelector('svg')).toBeInTheDocument();
  });

  it('管理者バッジが表示される', () => {
    renderHeader({ isEditor: true });
    expect(screen.getByText('管理者')).toBeInTheDocument();
  });

  it('一般ユーザーバッジが表示される', () => {
    renderHeader({ isEditor: false });
    expect(screen.getByText('一般ユーザー')).toBeInTheDocument();
  });

  it('guildId がある場合、タイトルリンクに guildId が含まれる', () => {
    renderHeader({ guildId: 'guild-123' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('guild-123'));
  });

  it('タイトルリンクの href にトークンが含まれない', () => {
    renderHeader({ guildId: 'guild-123' });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', toHashPath(toDashboard('guild-123')));
    expect(link.getAttribute('href')).not.toContain('token');
  });

  it('サーバーアイコンURLが取得できた場合、img タグが表示される', async () => {
    vi.mocked(useAuth).mockReturnValue({ isEditor: false, isVerifying: false, guildId: 'guild-123' });
    vi.mocked(api.getGuild).mockResolvedValue({ guildId: 'guild-123', guildName: 'テストサーバー', guildIconUrl: 'https://cdn.discordapp.com/icons/guild-123/abcdef.png' });
    render(<MemoryRouter><Header /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.discordapp.com/icons/guild-123/abcdef.png');
    expect(screen.getByRole('link').querySelector('svg')).not.toBeInTheDocument();
  });

});
