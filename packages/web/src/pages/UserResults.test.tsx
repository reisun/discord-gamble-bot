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

function renderPage() {
  vi.mocked(useAuth).mockReturnValue({
    token: 'tok',
    isAdmin: true,
    isVerifying: false,
    guildId: 'test-guild-001',
  });
  return render(
    <MemoryRouter>
      <UserResults />
    </MemoryRouter>,
  );
}

describe('UserResults', () => {
  beforeEach(() => {
    vi.mocked(api.getEvent).mockResolvedValue(mockEvent);
    vi.mocked(api.getUsers).mockResolvedValue([mockUser]);
    vi.mocked(api.getUserEventResults).mockResolvedValue(mockUserEventResult);
    vi.mocked(api.updateEventResultsPublic).mockResolvedValue(mockEvent);
  });

  it('パンくずが設計書どおり「ホーム > イベント一覧 > イベント名 > ユーザー結果一覧」で表示される', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('link', { name: '春季大会' })).toHaveAttribute('href', '#/events/test-guild-001/1/games'));
    expect(screen.getByRole('link', { name: 'ホーム' })).toHaveAttribute('href', '#/events/test-guild-001');
    expect(screen.getByRole('link', { name: 'イベント一覧' })).toHaveAttribute('href', '#/events/test-guild-001');
    expect(screen.getAllByText('ユーザー結果一覧')).toHaveLength(2);
  });
});
