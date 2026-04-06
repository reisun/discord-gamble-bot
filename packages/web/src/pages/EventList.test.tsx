import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ guildId: 'test-guild-001' }),
  };
});

function renderPage(isEditor = false) {
  vi.mocked(useAuth).mockReturnValue({ isEditor, isVerifying: false, guildId: 'test-guild-001' });
  return render(<MemoryRouter><EventList /></MemoryRouter>);
}

describe('EventList', () => {
  beforeEach(() => {
    vi.mocked(api.getEvents).mockResolvedValue([mockEvent, mockEventInactive]);
  });

  it('ローディング中のスピナーが表示される', () => {
    vi.mocked(api.getEvents).mockReturnValue(new Promise(() => {}));
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
    expect(screen.getByText('ー 非開催')).toBeInTheDocument();
  });

  it('���開催イベントの開催状態には丸アイコンが表示されない', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('ー 非開催')).toBeInTheDocument());

    const inactiveBadge = screen.getByText('ー 非開催').closest('span');
    expect(inactiveBadge?.querySelector('svg')).toBeNull();
  });

  it('非管理者は「詳細」ボタンのみ表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getAllByText('詳細')).toHaveLength(2));
    expect(screen.queryByText('編集')).not.toBeInTheDocument();
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('管理者は開催中切替・公開ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('詳細')).toHaveLength(2));
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
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it('開催中のイベントの「非公開にする」ボタンは disabled', async () => {
    renderPage(true);
    await waitFor(() => screen.getByText('非公開にする'));
    const publishBtn = screen.getByText('非公開にする');
    expect(publishBtn).toBeDisabled();
  });

  it('開催中切替ボタンをクリックすると activateEvent が呼ばれる', async () => {
    vi.mocked(api.activateEvent).mockResolvedValue(undefined as never);

    renderPage(true);
    await waitFor(() => screen.getAllByText('開催中切替'));
    const buttons = screen.getAllByText('開催中切替');
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(api.activateEvent).toHaveBeenCalledWith(mockEvent.id));
  });

  it('イベント名がリンクとして表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toBeInTheDocument());
  });

  it('API エラー時にエラーメッセージが表示される', async () => {
    vi.mocked(api.getEvents).mockRejectedValue(new Error('サーバーエラー'));
    renderPage();
    await waitFor(() => expect(screen.getByText('サーバーエラー')).toBeInTheDocument());
  });
});
