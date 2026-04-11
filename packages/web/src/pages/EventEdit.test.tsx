import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EventEdit from './EventEdit';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { toDashboard, toEvent, toHashPath } from '../routes';
import { mockEvent } from '../test/fixtures';

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
    useParams: vi.fn(),
  };
});

import { useParams } from 'react-router-dom';

function renderNew() {
  vi.mocked(useAuth).mockReturnValue({ token: 'tok', isAdmin: true, isVerifying: false, guildId: 'test-guild-001', isTokenExpired: false, isSessionExpired: false, loginUrl: null });
  vi.mocked(useParams).mockReturnValue({ guildId: 'test-guild-001' });
  return render(<MemoryRouter><EventEdit /></MemoryRouter>);
}

function renderEdit(eventId = '1') {
  vi.mocked(useAuth).mockReturnValue({ token: 'tok', isAdmin: true, isVerifying: false, guildId: 'test-guild-001', isTokenExpired: false, isSessionExpired: false, loginUrl: null });
  vi.mocked(useParams).mockReturnValue({ guildId: 'test-guild-001', eventId });
  vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
  return render(<MemoryRouter><EventEdit /></MemoryRouter>);
}

describe('EventEdit', () => {
  beforeEach(() => {
    vi.mocked(api.createEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.updateEvent).mockResolvedValue(mockEvent);
    mockNavigate.mockClear();
  });

  it('新規作成: フォームが空の状態で表示される', () => {
    renderNew();
    expect(screen.getByText('新規イベント作成')).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/イベント名/);
    expect(nameInput).toHaveValue('');
  });

  it('新規作成: パンくずが設計書どおり「ホーム > 新規作成」で表示される', () => {
    renderNew();

    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001')));
    expect(screen.getByText('新規作成')).toBeInTheDocument();
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
  });

  it('編集: 既存データが入力済みで表示される', async () => {
    renderEdit();
    await waitFor(() => expect(screen.getByDisplayValue('春季大会')).toBeInTheDocument());
    expect(screen.getByDisplayValue('10000')).toBeInTheDocument();
  });

  it('編集: パンくずが設計書どおり「ホーム > イベント名 > 編集」で表示される', async () => {
    renderEdit();

    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toHaveAttribute('href', toHashPath(toEvent('test-guild-001', 1))));
    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', toHashPath(toDashboard('test-guild-001')));
    expect(screen.getByText('編集')).toBeInTheDocument();
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
  });

  it('イベント名が空のまま保存するとエラーが表示される', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(screen.getByText(/1〜100文字/)).toBeInTheDocument());
  });

  it('新規作成: 正常送信で createEvent が呼ばれ、一覧に遷移する', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText(/イベント名/), '秋季大会');
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: '秋季大会', guildId: 'test-guild-001' }),
      'tok',
    ));
    expect(mockNavigate).toHaveBeenCalledWith(toDashboard('test-guild-001'));
  });

  it('編集: 正常送信で updateEvent が呼ばれる', async () => {
    const user = userEvent.setup();
    renderEdit();
    await waitFor(() => screen.getByDisplayValue('春季大会'));
    await user.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(api.updateEvent).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: '春季大会' }),
      'tok',
    ));
  });

  it('キャンセルボタンで一覧に戻る', async () => {
    const user = userEvent.setup();
    renderNew();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(mockNavigate).toHaveBeenCalledWith(toDashboard('test-guild-001'));
  });

  it('編集: キャンセルボタンでイベント画面に戻る', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => screen.getByDisplayValue('春季大会'));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(mockNavigate).toHaveBeenCalledWith(toEvent('test-guild-001', 1));
  });
});
