import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GameStatus from './GameStatus';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toDashboard, toEvent, toHashPath } from '../routes';
import {
  mockEvent,
  mockGameSingle,
  mockGameMultiOrdered,
  mockGameFinished,
  mockBetsData,
  mockBetsFinished,
} from '../test/fixtures';

vi.mock('../api/client');
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../hooks/useTokenSearch', () => ({ useTokenSearch: () => '' }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ guildId: 'test-guild-001', eventId: '1', gameId: '1' }) };
});

function renderPage(isAdmin = false) {
  vi.mocked(useAuth).mockReturnValue({ token: isAdmin ? 'tok' : null, isAdmin, isVerifying: false, guildId: 'test-guild-001' });
  return render(<MemoryRouter><GameStatus /></MemoryRouter>);
}

describe('GameStatus', () => {
  beforeEach(() => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameSingle);
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getBets).mockResolvedValue(mockBetsData);
    vi.mocked(api.setGameResult).mockResolvedValue({ ...mockGameSingle, resultSymbols: 'A', status: 'finished' });
  });

  it('ゲームタイトルが表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '第1試合' })).toBeInTheDocument());
  });

  it('パンくずが設計書どおり「ホーム > イベント名 > ゲームタイトル」で表示される', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001'))));
    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toHaveAttribute('href', toHashPath(toEvent('test-guild-001', 1))));
    expect(screen.getAllByText('第1試合')).toHaveLength(2);
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('ゲーム一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('状況')).not.toBeInTheDocument();
  });

  it('単数方式: 賭け方式バッジが表示されない', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('heading', { level: 1, name: '第1試合' }));
    expect(screen.queryByText(/複数/)).not.toBeInTheDocument();
  });

  it('複数方式: 賭け方式バッジが表示される', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameMultiOrdered);
    renderPage();
    await waitFor(() => expect(screen.getByText(/複数-順番一致/)).toBeInTheDocument());
  });

  it('賭け項目リストがゲーム情報エリアに表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/A: チームA/)).toHaveLength(2)); // 賭け項目 + 組み合わせ
    expect(screen.getAllByText(/B: チームB/)).toHaveLength(2);
  });

  it('組み合わせ一覧が表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/A: チームA/)[0]).toBeInTheDocument());
    expect(screen.getAllByText(/B: チームB/)[0]).toBeInTheDocument();
  });

  it('非管理者・受付中: 倍率が数値で表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByText('×1.67倍')).toBeInTheDocument());
    expect(screen.getByText('×2.50倍')).toBeInTheDocument();
  });

  it('非管理者・受付中: 賭け総数と参加人数は表示されない', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByText('×1.67倍')).toBeInTheDocument());
    expect(screen.queryByText('(800pt / 2人)')).not.toBeInTheDocument();
  });

  it('odds が null の組み合わせが返ってきてもクラッシュせずプレースホルダー表示になる', async () => {
    vi.mocked(api.getBets).mockResolvedValue({
      ...mockBetsData,
      combinations: [
        {
          ...mockBetsData.combinations[0],
          odds: null,
        },
      ],
    });

    renderPage(false);

    await waitFor(() => expect(screen.getByText('×--倍')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: '第1試合' })).toBeInTheDocument();
  });

  it('管理者: 倍率が数値で表示される', async () => {
    renderPage(true);
    await waitFor(() => expect(screen.getByText('×1.67倍')).toBeInTheDocument());
    expect(screen.getByText('×2.50倍')).toBeInTheDocument();
  });

  it('結果確定後: 当選テキストが表示される', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameFinished);
    vi.mocked(api.getBets).mockResolvedValue(mockBetsFinished);
    renderPage(false);
    await waitFor(() => expect(screen.getByText(/当選: A/)).toBeInTheDocument());
  });

  it('結果未確定: 「結果未確定」が表示される', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByText('結果未確定')).toBeInTheDocument());
  });

  it('管理者・締切済ゲーム: 結果確定フォームが表示される', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameMultiOrdered); // status: 'closed'
    renderPage(true);
    await waitFor(() => expect(screen.getByText('結果を確定する')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '確定' })).toBeInTheDocument();
  });

  it('非管理者: 結果確定フォームが表示されない', async () => {
    vi.mocked(api.getGame).mockResolvedValue(mockGameMultiOrdered);
    renderPage(false);
    await waitFor(() => screen.getByRole('heading', { level: 1, name: '第2試合' }));
    expect(screen.queryByText('結果を確定する')).not.toBeInTheDocument();
  });

  it('管理者・単数方式: 結果確定ドロップダウンで選択し確定できる', async () => {
    vi.mocked(api.getGame).mockResolvedValue({ ...mockGameSingle, status: 'closed' });
    const user = userEvent.setup();
    renderPage(true);
    await waitFor(() => screen.getByText('結果を確定する'));
    await user.selectOptions(screen.getByRole('combobox'), 'A');
    await user.click(screen.getByRole('button', { name: '確定' }));
    await waitFor(() => expect(api.setGameResult).toHaveBeenCalledWith(mockGameSingle.id, 'A', 'tok'));
  });
});
