import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserResults from './UserResults';
import * as api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  mockEvent,
  mockGameSingle,
  mockGameUnpublished,
  mockUser,
  mockUserEventResult,
} from '../test/fixtures';

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
  vi.mocked(useAuth).mockReturnValue({
    token: isAdmin ? 'tok' : null,
    isAdmin,
    isVerifying: false,
    guildId: 'test-guild-001',
    isTokenExpired: false,
  });
  return render(
    <MemoryRouter>
      <UserResults />
    </MemoryRouter>
  );
}

describe('UserResults', () => {
  beforeEach(() => {
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getUsers).mockResolvedValue([mockUser]);
    vi.mocked(api.getGames).mockResolvedValue([mockGameSingle]);
    vi.mocked(api.getUserEventResults).mockResolvedValue(mockUserEventResult);
  });

  it('パンくずリストが ホーム > [イベント名] > ユーザー結果一覧 の順で表示される', async () => {
    renderPage();
    await waitFor(() => screen.getByText('春季大会'));
    expect(screen.getByRole('link', { name: 'ホーム' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '春季大会' })).toBeInTheDocument();
    // 末尾の「ユーザー結果一覧」はリンクではなくspan
    const breadcrumbSpans = document.querySelector('nav')!.querySelectorAll('span');
    const lastText = Array.from(breadcrumbSpans).find(
      (s) => s.textContent?.trim() === 'ユーザー結果一覧'
    );
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
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: 'ポイント総額' })).toBeInTheDocument()
    );
    expect(screen.getAllByText('10,500 pt').length).toBeGreaterThanOrEqual(1);
  });

  it('総資産額列が総資産順で表示される', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: '総資産順' }));
    fireEvent.click(screen.getByRole('button', { name: '総資産順' }));
    expect(screen.getByRole('columnheader', { name: '総資産額' })).toBeVisible();
    expect(screen.getAllByText('10,500 pt').length).toBeGreaterThanOrEqual(1);
  });

  it('所持ポイント順（デフォルト）では借金総額・総資産額・総資産増減列がプレースホルダー（不可視）', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('columnheader', { name: 'ポイント総額' }));
    // visibility: hidden のため DOM には存在するが不可視（直接 DOM で確認）
    const ths = Array.from(document.querySelectorAll('th'));
    const hiddenLabels = ['借金総額', '総資産額', '総資産増減'];
    for (const label of hiddenLabels) {
      const th = ths.find((el) => el.textContent === label);
      expect(th, `${label} の th が存在すること`).toBeDefined();
      expect(th?.style.visibility, `${label} が visibility: hidden であること`).toBe('hidden');
    }
  });

  it('総資産順に切り替えると借金総額・総資産額・総資産増減列が可視になる', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: '総資産順' }));
    fireEvent.click(screen.getByRole('button', { name: '総資産順' }));
    expect(screen.getByRole('columnheader', { name: '借金総額' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: '総資産額' })).toBeVisible();
    expect(screen.getByRole('columnheader', { name: '総資産増減' })).toBeVisible();
  });

  it('一般ユーザーにも借金総額列が表示される（総資産順切替後）', async () => {
    renderPage(false);
    await waitFor(() => screen.getByRole('button', { name: '総資産順' }));
    fireEvent.click(screen.getByRole('button', { name: '総資産順' }));
    expect(screen.getByRole('columnheader', { name: '借金総額' })).toBeVisible();
    expect(screen.getByText('0 pt')).toBeInTheDocument();
  });

  it('ゲーム別ポイント推移に公開ゲームのタイトルが列として表示される', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: '第1試合' })).toBeInTheDocument()
    );
  });

  it('ゲーム別ポイント推移に非公開ゲームが列として表示されない', async () => {
    vi.mocked(api.getGames).mockResolvedValue([mockGameSingle, mockGameUnpublished]);
    renderPage();
    await waitFor(() => screen.getByRole('columnheader', { name: '第1試合' }));
    expect(screen.queryByRole('columnheader', { name: '第4試合' })).not.toBeInTheDocument();
  });

  it('管理者には公開切替チェックボックスが表示される', async () => {
    renderPage(true);

    await waitFor(() =>
      expect(screen.getByLabelText('一般ユーザーに公開する')).toBeInTheDocument()
    );
  });
});
