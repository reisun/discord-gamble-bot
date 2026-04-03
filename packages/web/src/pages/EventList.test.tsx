import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';
import EventList from './EventList';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { mockEvent, mockEventInactive } from '../test/fixtures';

vi.mock('../api/client');
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../hooks/useTokenSearch', () => ({ useTokenSearch: () => '' }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderPage(isAdmin = false) {
  vi.mocked(useAuth).mockReturnValue({ token: isAdmin ? 'tok' : null, isAdmin, isVerifying: false });
  return render(<MemoryRouter><EventList /></MemoryRouter>);
}

describe('EventList', () => {
  beforeEach(() => {
    vi.mocked(api.getEvents).mockResolvedValue([mockEvent, mockEventInactive]);
  });

  it('ローディング中のスピナーが表示される', () => {
    vi.mocked(api.getEvents).mockReturnValue(new Promise(() => {})); // 永遠に pending
    renderPage();
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('イベント名が一覧に表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('春季大会')).toBeInTheDocument());
    expect(screen.getByText('夏季カップ')).toBeInTheDocument();
  });

  it('開催中イベントに「開催中」テキストが表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('開催中')).toBeInTheDocument());
    expect(screen.getByText('終了')).toBeInTheDocument();
  });

  it('非管理者は「詳細」ボタンのみ表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getAllByText('詳細')).toHaveLength(2));
    expect(screen.queryByText('編集')).not.toBeInTheDocument();
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('管理者は「開催中切替」ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('詳細')).toHaveLength(2));
    expect(screen.getAllByText('開催中切替')).toHaveLength(2);
  });

  it('API エラー時にエラーメッセージが表示される', async () => {
    vi.mocked(api.getEvents).mockRejectedValue(new Error('サーバーエラー'));
    renderPage();
    await waitFor(() => expect(screen.getByText('サーバーエラー')).toBeInTheDocument());
  });
});
