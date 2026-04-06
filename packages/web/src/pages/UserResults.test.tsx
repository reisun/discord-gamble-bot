import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserResults from './UserResults';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { mockEvent, mockUser, mockUserEventResult } from '../test/fixtures';

vi.mock('../api/client');
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../hooks/useTokenSearch', () => ({ useTokenSearch: () => '' }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ guildId: 'test-guild-001', eventId: '1' }),
  };
});

function renderPage(isAdmin = false) {
  vi.mocked(useAuth).mockReturnValue({ token: isAdmin ? 'tok' : null, isAdmin, isVerifying: false, guildId: 'test-guild-001' });
  return render(<MemoryRouter><UserResults /></MemoryRouter>);
}

describe('UserResults', () => {
  beforeEach(() => {
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getUsers).mockResolvedValue([mockUser]);
    vi.mocked(api.getUserEventResults).mockResolvedValue(mockUserEventResult);
  });

  it('パンくずリストが ホーム > [イベント名] > ユーザー結果一覧 の順で表示される', async () => {
    renderPage();
    await waitFor(() => screen.getByText('春季大会'));
    expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '春季大会' })).toBeInTheDocument();
    // 末尾の「ユーザー結果一覧」はリンクではなくspan
    const breadcrumbSpans = document.querySelector('nav')!.querySelectorAll('span');
    const lastText = Array.from(breadcrumbSpans).find(s => s.textContent?.trim() === 'ユーザー結果一覧');
    expect(lastText).not.toBeUndefined();
  });

  it('パンくずリストに「イベント一覧」が含まれない', async () => {
    renderPage();
    await waitFor(() => screen.getByText('春季大会'));
    expect(screen.queryByText('イベント一覧')).not.toBeInTheDocument();
  });

  it('ユーザー名が一覧に表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('User A').length).toBeGreaterThan(0));
  });

  it('ポイント総額列が表示される', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'ポイント総額' })).toBeInTheDocument());
    expect(screen.getByText('10,500 pt')).toBeInTheDocument();
  });

  it('一般ユーザーにも借金総額列が表示される', async () => {
    renderPage(false);

    await waitFor(() => expect(screen.getByRole('columnheader', { name: '借金総額' })).toBeInTheDocument());
    expect(screen.getByText('0 pt')).toBeInTheDocument();
  });

  it('管理者には公開切替チェックボックスが表示される', async () => {
    renderPage(true);

    await waitFor(() => expect(screen.getByLabelText('一般ユーザーに公開する')).toBeInTheDocument());
  });
});
