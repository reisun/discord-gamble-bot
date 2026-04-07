import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GameEdit from './GameEdit';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toDashboard, toEvent, toGame, toHashPath } from '../routes';
import { mockEvent, mockGameSingle, mockGameMultiOrdered } from '../test/fixtures';

vi.mock('../api/client');
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

function renderNew() {
  vi.mocked(useAuth).mockReturnValue({ isEditor: true, isVerifying: false, guildId: 'test-guild-001' });
  mockUseParams.mockReturnValue({ guildId: 'test-guild-001', eventId: '1' });
  vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
  return render(<MemoryRouter><GameEdit /></MemoryRouter>);
}

function renderEdit(game = mockGameSingle) {
  vi.mocked(useAuth).mockReturnValue({ isEditor: true, isVerifying: false, guildId: 'test-guild-001' });
  mockUseParams.mockReturnValue({
    guildId: 'test-guild-001',
    eventId: String(game.eventId),
    gameId: String(game.id),
  });
  vi.mocked(api.getGame).mockResolvedValue(game);
  vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
  return render(<MemoryRouter><GameEdit /></MemoryRouter>);
}

describe('GameEdit', () => {
  beforeEach(() => {
    vi.mocked(api.createGame).mockResolvedValue(mockGameSingle);
    vi.mocked(api.updateGame).mockResolvedValue(mockGameSingle);
    mockNavigate.mockClear();
  });

  it('新規作成: タイトル入力欄が表示される', () => {
    renderNew();
    expect(screen.getByLabelText(/ゲームタイトル/)).toBeInTheDocument();
  });

  it('新規作成: パンくずが設計書どおり「ホーム > イベント名 > 新規作成」で表示される', async () => {
    renderNew();

    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001')));
    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toHaveAttribute('href', toHashPath(toEvent('test-guild-001', 1))));
    expect(screen.getByText('新規作成')).toBeInTheDocument();
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('ゲーム一覧')).not.toBeInTheDocument();
  });

  it('賭け方式「単数」の説明文が表示される', () => {
    renderNew();
    expect(screen.getByText(/記号を1つ選ぶ賭け方式/)).toBeInTheDocument();
  });

  it('「単数」選択時は選択数フィールドが非表示', () => {
    renderNew();
    expect(screen.queryByLabelText(/選択数/)).not.toBeInTheDocument();
  });

  it('「複数-選択一致」選択時に選択数フィールドと説明文が表示される', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.selectOptions(screen.getByLabelText(/賭け方式/), 'multi_unordered');
    expect(screen.getByLabelText(/選択数/)).toBeInTheDocument();
    expect(screen.getByText(/順序に関わらず/)).toBeInTheDocument();
  });

  it('公開済みゲーム編集: 公開後の締め切り分数は disabled になる', async () => {
    const publishedGame = { ...mockGameSingle, isPublished: true };
    renderEdit(publishedGame);
    await waitFor(() => screen.getByDisplayValue('第1試合'));
    expect(screen.getByLabelText(/公開後の何分後に締め切るか/)).toBeDisabled();
  });

  it('公開済みゲーム編集: 賭け方式が disabled になる', async () => {
    const publishedGame = { ...mockGameSingle, isPublished: true };
    renderEdit(publishedGame);
    await waitFor(() => screen.getByDisplayValue('第1試合'));
    expect(screen.getByLabelText(/賭け方式/)).toBeDisabled();
  });

  it('公開済みゲーム: 警告メッセージが表示される', async () => {
    renderEdit({ ...mockGameSingle, isPublished: true });
    await waitFor(() => expect(screen.getByText(/公開済みです/)).toBeInTheDocument());
  });

  it('非公開ゲーム: 「項目追加」ボタンが表示される', async () => {
    renderEdit({ ...mockGameSingle, isPublished: false });
    await waitFor(() => expect(screen.getByText('+ 項目追加')).toBeInTheDocument());
  });

  it('公開済みゲーム: 「項目追加」ボタンが非表示', async () => {
    renderEdit({ ...mockGameSingle, isPublished: true });
    await waitFor(() => screen.getByDisplayValue('第1試合'));
    expect(screen.queryByText('+ 項目追加')).not.toBeInTheDocument();
  });

  it('新規作成: タイトル入力後に保存すると createGame が呼ばれる', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText(/ゲームタイトル/), '第5試合');
    fireEvent.change(screen.getByLabelText(/公開後の何分後に締め切るか/), { target: { value: '12' } });
    const symbolInputs = screen.getAllByPlaceholderText('A');
    const labelInputs = screen.getAllByPlaceholderText('チームA');
    await user.type(symbolInputs[0], 'A');
    await user.type(labelInputs[0], 'チームA');
    await user.type(symbolInputs[1], 'B');
    await user.type(labelInputs[1], 'チームB');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.createGame).toHaveBeenCalled());
  });

  it('編集: 既存データが表示される', async () => {
    renderEdit(mockGameMultiOrdered);
    await waitFor(() => expect(screen.getByDisplayValue('第2試合')).toBeInTheDocument());
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('編集: パンくずが設計書どおり「ホーム > イベント名 > ゲームタイトル > 編集」で表示される', async () => {
    renderEdit(mockGameSingle);

    await waitFor(() => expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001'))));
    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toHaveAttribute('href', toHashPath(toEvent('test-guild-001', 1))));
    expect(screen.getByRole('link', { name: '第1試合' })).toHaveAttribute('href', toHashPath(toGame('test-guild-001', 1, 1)));
    expect(screen.getByText('編集')).toBeInTheDocument();
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('ゲーム一覧')).not.toBeInTheDocument();
  });

  it('新規作成: キャンセルでゲーム一覧（イベント画面）に戻る', async () => {
    renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(mockNavigate).toHaveBeenCalledWith(toEvent('test-guild-001', 1));
  });

  it('編集: キャンセルでゲーム状況画面に戻る', async () => {
    renderEdit(mockGameSingle);
    await waitFor(() => screen.getByDisplayValue('第1試合'));
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(mockNavigate).toHaveBeenCalledWith(toGame('test-guild-001', 1, 1));
  });

  it('新規作成: 保存後はイベント画面（ゲーム一覧）に遷移する', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText(/ゲームタイトル/), '第5試合');
    fireEvent.change(screen.getByLabelText(/公開後の何分後に締め切るか/), { target: { value: '12' } });
    const symbolInputs = screen.getAllByPlaceholderText('A');
    const labelInputs = screen.getAllByPlaceholderText('チームA');
    await user.type(symbolInputs[0], 'A');
    await user.type(labelInputs[0], 'チームA');
    await user.type(symbolInputs[1], 'B');
    await user.type(labelInputs[1], 'チームB');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(toEvent('test-guild-001', 1)));
  });

  it('編集: 保存後はゲーム状況画面に遷移する', async () => {
    renderEdit(mockGameSingle);
    await waitFor(() => screen.getByDisplayValue('第1試合'));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(toGame('test-guild-001', mockGameSingle.eventId, mockGameSingle.id)),
    );
  });
});
