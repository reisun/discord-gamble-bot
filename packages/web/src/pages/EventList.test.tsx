import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(screen.getByText('ー')).toBeInTheDocument();
  });

  it('非管理者は「ゲーム一覧」ボタンのみ表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getAllByText('ゲーム一覧')).toHaveLength(2));
    expect(screen.queryByText('編集')).not.toBeInTheDocument();
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('管理者は編集・削除・開催中切替・公開ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('編集')).toHaveLength(2));
    expect(screen.getAllByText('削除')).toHaveLength(2);
    expect(screen.getAllByText('開催中切替')).toHaveLength(2);
  });

  it('管理者には公開状態が表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('公開').length).toBeGreaterThan(0));
    expect(screen.getByText('非公開')).toBeInTheDocument();
  });

  it('開催中切替ボタンは開催中でも押下可能', async () => {
    renderPage(true);
    await waitFor(() => screen.getAllByText('開催中切替'));
    const buttons = screen.getAllByText('開催中切替');
    // 開催中イベント（mockEvent）の開催中切替ボタンも disabled でない
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it('開催中のイベントの「非公開にする」ボタンは disabled', async () => {
    renderPage(true);
    await waitFor(() => screen.getByText('非公開にする'));
    // mockEvent は isActive=true なので非公開にするボタンは disabled
    const publishBtn = screen.getByText('非公開にする');
    expect(publishBtn).toBeDisabled();
  });

  it('削除ボタンをクリックすると確認ダイアログが表示される', async () => {
    const user = userEvent.setup();
    renderPage(true);
    await waitFor(() => screen.getAllByText('削除'));
    await user.click(screen.getAllByText('削除')[0]);
    expect(screen.getByText(/春季大会.*削除/)).toBeInTheDocument();
  });

  it('確認ダイアログで「削除」を押すと deleteEvent が呼ばれる', async () => {
    vi.mocked(api.deleteEvent).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage(true);
    await waitFor(() => screen.getAllByText('削除'));
    await user.click(screen.getAllByText('削除')[0]);
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '削除' }));
    expect(api.deleteEvent).toHaveBeenCalledWith(mockEvent.id, 'tok');
  });

  it('API エラー時にエラーメッセージが表示される', async () => {
    vi.mocked(api.getEvents).mockRejectedValue(new Error('サーバーエラー'));
    renderPage();
    await waitFor(() => expect(screen.getByText('サーバーエラー')).toBeInTheDocument());
  });
});
