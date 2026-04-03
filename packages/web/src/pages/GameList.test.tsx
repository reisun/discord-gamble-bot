import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GameList from './GameList';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { mockEvent, mockGameSingle, mockGameUnpublished } from '../test/fixtures';

vi.mock('../api/client');
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../hooks/useTokenSearch', () => ({ useTokenSearch: () => '' }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: '1' }),
  };
});

function renderPage(isAdmin = false) {
  vi.mocked(useAuth).mockReturnValue({ token: isAdmin ? 'tok' : null, isAdmin, isVerifying: false });
  return render(<MemoryRouter><GameList /></MemoryRouter>);
}

describe('GameList', () => {
  beforeEach(() => {
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getGames).mockResolvedValue([mockGameSingle, mockGameUnpublished]);
    vi.mocked(api.deleteGame).mockResolvedValue(undefined);
    vi.mocked(api.publishGame).mockResolvedValue(mockGameSingle);
    mockNavigate.mockClear();
  });

  it('イベント名が見出しに表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /春季大会/ })).toBeInTheDocument());
  });

  it('開催中のイベントに「開催中」バッジが表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('開催中')).toBeInTheDocument());
  });

  it('ゲームタイトルが一覧に表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('第1試合')).toBeInTheDocument());
    expect(screen.getByText('第4試合')).toBeInTheDocument();
  });

  it('公開/非公開の状態が表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('公開')).toHaveLength(2)); // table header + status span
    expect(screen.getByText('非公開')).toBeInTheDocument();
  });

  it('非管理者は「状況」ボタンのみ表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getAllByText('状況')).toHaveLength(2));
    expect(screen.queryByText('編集')).not.toBeInTheDocument();
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('管理者は編集・削除・公開切替ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('編集')).toHaveLength(2));
    expect(screen.getAllByText('削除')).toHaveLength(2);
    expect(screen.getByText('非公開にする')).toBeInTheDocument();
    expect(screen.getByText('公開する')).toBeInTheDocument();
  });

  it('削除ボタンで確認ダイアログが表示され、確定で deleteGame が呼ばれる', async () => {
    const user = userEvent.setup();
    renderPage(true);
    await waitFor(() => screen.getAllByText('削除'));
    await user.click(screen.getAllByText('削除')[0]);
    expect(screen.getByText(/第1試合.*削除/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '削除' }));
    expect(api.deleteGame).toHaveBeenCalledWith(mockGameSingle.id, 'tok');
  });

  it('管理者: 「+ 新規ゲーム作成」ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getByText('+ 新規ゲーム作成')).toBeInTheDocument());
  });
});
