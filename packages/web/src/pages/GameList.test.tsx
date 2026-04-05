import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GameList from './GameList';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toDashboard, toEventEdit, toHashPath } from '../routes';
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
    useParams: () => ({ guildId: 'test-guild-001', eventId: '1' }),
  };
});

function renderPage(isAdmin = false) {
  vi.mocked(useAuth).mockReturnValue({ token: isAdmin ? 'tok' : null, isAdmin, isVerifying: false, guildId: 'test-guild-001' });
  return render(<MemoryRouter><GameList /></MemoryRouter>);
}

describe('GameList', () => {
  beforeEach(() => {
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getGames).mockResolvedValue([mockGameSingle, mockGameUnpublished]);
    vi.mocked(api.deleteEvent).mockResolvedValue(undefined);
    vi.mocked(api.publishGame).mockResolvedValue(mockGameSingle);
    mockNavigate.mockClear();
  });

  it('イベント名が見出しに表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /春季大会/ })).toBeInTheDocument());
  });

  it('パンくずが設計書どおり「ホーム > イベント名」で表示される', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001'))));
    expect(screen.getByText('春季大会')).toBeInTheDocument();
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('ゲーム一覧')).not.toBeInTheDocument();
  });

  it('開催中のイベントに「開催中」バッジが表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('開催中')).toBeInTheDocument());
  });

  it('ゲームタイトルが一覧に表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('第1試合')).toBeInTheDocument());
  });

  it('管理者には「公開」列（ヘッダー・状態）が表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getAllByText('公開')).toHaveLength(2)); // table header + status span
    expect(screen.getByText('非公開')).toBeInTheDocument();
  });

  it('一般ユーザーには「公開」列が表示されない', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByText('第1試合')).toBeInTheDocument());
    expect(screen.queryByText('公開')).not.toBeInTheDocument();
    expect(screen.queryByText('非公開')).not.toBeInTheDocument();
  });

  it('非管理者は「詳細」ボタンのみ表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getAllByText('詳細')).toHaveLength(2));
    expect(screen.queryByText('編集')).not.toBeInTheDocument();
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('一般ユーザーには非公開ゲームがプレースホルダー行として表示され、詳細ボタンは押下できない', async () => {
    renderPage(false);

    await waitFor(() => expect(screen.getByText('非公開ゲーム')).toBeInTheDocument());
    expect(screen.getByText('-----/--/-- --:--')).toBeInTheDocument();
    expect(screen.queryByText('第4試合')).not.toBeInTheDocument();

    const detailButtons = screen.getAllByRole('button', { name: '詳細' });
    expect(detailButtons[0]).not.toBeDisabled();
    expect(detailButtons[1]).toBeDisabled();
  });

  it('管理者はイベントヘッダーに編集・削除、ゲーム行に公開切替ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getByText('編集')).toBeInTheDocument());
    expect(screen.getByText('削除')).toBeInTheDocument();
    expect(screen.getByText('非公開にする')).toBeInTheDocument();
    expect(screen.getByText('公開する')).toBeInTheDocument();
  });

  it('管理者がイベント編集ボタンを押すとguildId付きの編集画面URLへ遷移する', async () => {
    const user = userEvent.setup();
    renderPage(true);

    await waitFor(() => screen.getByText('編集'));
    await user.click(screen.getByText('編集'));

    expect(mockNavigate).toHaveBeenCalledWith(toEventEdit('test-guild-001', 1));
  });

  it('削除ボタンで確認ダイアログが表示され、確定で deleteEvent が呼ばれる', async () => {
    const user = userEvent.setup();
    renderPage(true);
    await waitFor(() => screen.getByText('削除'));
    await user.click(screen.getByText('削除'));
    expect(screen.getByText(/春季大会.*削除/)).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '削除' }));
    expect(api.deleteEvent).toHaveBeenCalledWith(mockEvent.id, 'tok');
  });

  it('管理者: 「+ 新規ゲーム作成」ボタンが表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getByText('+ 新規ゲーム作成')).toBeInTheDocument());
  });

  it('一般ユーザーでも結果公開中のイベントでは「ユーザー結果一覧」ボタンが表示される', async () => {
    vi.mocked(api.getEvent).mockResolvedValue({ ...mockEvent, resultsPublic: true });

    renderPage(false);

    await waitFor(() => expect(screen.getByText('ユーザー結果一覧')).toBeInTheDocument());
    expect(screen.queryByText('+ 新規ゲーム作成')).not.toBeInTheDocument();
  });

  it('一般ユーザーで結果未公開のイベントでは「ユーザー結果一覧」ボタンは表示されない', async () => {
    renderPage(false);

    await waitFor(() => expect(screen.getByText('第1試合')).toBeInTheDocument());
    expect(screen.queryByText('ユーザー結果一覧')).not.toBeInTheDocument();
  });
});
