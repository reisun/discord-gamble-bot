import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getGames, getUsers, getUserEventResults, updateEventResultsPublic } from '../api/client';
import type { Event, Game, User, UserEventResult } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { useTokenSearch } from '../hooks/useTokenSearch';
import { toDashboard, toEvent, toHashPath } from '../routes';

type SortKey = 'points' | 'assets';

function PointChange({ value }: { value: number }) {
  if (value > 0) return <span className="text-success">+{value.toLocaleString()} pt ▲</span>;
  if (value < 0) return <span className="text-danger">{value.toLocaleString()} pt ▼</span>;
  return <span className="text-muted">±0 pt</span>;
}

export default function UserResults() {
  const { guildId, eventId } = useParams<{ guildId: string; eventId: string }>();
  const { isAdmin, token } = useAuth();
  const tokenSearch = useTokenSearch();
  const evId = Number(eventId);

  const [event, setEvent] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [results, setResults] = useState<Map<number, UserEventResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [updatingPublic, setUpdatingPublic] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getEvent(evId, token ?? undefined),
      getUsers(evId, token ?? undefined),
      getGames(evId),
    ])
      .then(([ev, us, gs]) => {
        setEvent(ev);
        setUsers(us);
        setGames(gs.filter((g) => g.isPublished));
        return Promise.all(
          us.map((u) => getUserEventResults(u.id, evId, token ?? undefined)),
        );
      })
      .then((resultList) => {
        const map = new Map<number, UserEventResult>();
        resultList.forEach((r) => map.set(r.userId, r));
        setResults(map);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResultsPublicToggle = async () => {
    if (!event || !token) return;
    setUpdatingPublic(true);
    try {
      const updated = await updateEventResultsPublic(event.id, !event.resultsPublic, token);
      setEvent(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '更新に失敗しました');
    } finally {
      setUpdatingPublic(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const ra = results.get(a.id);
    const rb = results.get(b.id);
    if (sortKey === 'points') {
      return (rb?.totalPointChange ?? 0) - (ra?.totalPointChange ?? 0);
    }
    return (rb?.totalAssetsChange ?? 0) - (ra?.totalAssetsChange ?? 0);
  });


  const breadcrumbs = [
    { label: 'ホーム', href: toHashPath(toDashboard(guildId, tokenSearch)) },
    { label: event?.name ?? '...', href: toHashPath(toEvent(guildId, evId, tokenSearch)) },
    { label: 'ユーザー結果一覧' },
  ];

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <>
      <Breadcrumb items={breadcrumbs} />
      <div style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '16px', fontWeight: 600 }}>イベント: {event?.name}</span>
      </div>
      <h1 className="page-title">ユーザー結果一覧</h1>

      {error && <div className="error-message">{error}</div>}

      {isAdmin && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={event?.resultsPublic ?? false}
              onChange={handleResultsPublicToggle}
              disabled={updatingPublic}
              style={{ width: 'auto' }}
            />
            一般ユーザーに公開する
          </label>
        </div>
      )}

      {/* ポイントランキング */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>ポイントランキング</h2>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className={sortKey === 'points' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setSortKey('points')}
            >
              所持ポイント順
            </button>
            <button
              className={sortKey === 'assets' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => setSortKey('assets')}
            >
              総資産順
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table style={{ tableLayout: 'fixed', minWidth: '480px' }}>
            <colgroup>
              <col style={{ width: '56px' }} />
              <col />
              <col style={{ width: '112px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '80px' }} />
              {sortKey === 'assets' && <col style={{ width: '108px' }} />}
              {sortKey === 'assets' && <col style={{ width: '112px' }} />}
              {sortKey === 'assets' && <col style={{ width: '120px' }} />}
            </colgroup>
            <thead>
              <tr>
                <th>順位</th>
                <th>ユーザー名</th>
                <th>ポイント総額</th>
                <th>ポイント増減</th>
                <th>勝/敗</th>
                {sortKey === 'assets' && <th>借金総額</th>}
                {sortKey === 'assets' && <th>総資産額</th>}
                {sortKey === 'assets' && <th>総資産増減</th>}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u, i) => {
                const r = results.get(u.id);
                return (
                  <tr key={u.id}>
                    <td>{i + 1}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" width={20} height={20} style={{ borderRadius: '50%', flexShrink: 0 }} />
                        ) : (
                          <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-border)', display: 'inline-block', flexShrink: 0 }} />
                        )}
                        {u.discordName}
                      </span>
                    </td>
                    <td>{u.points.toLocaleString()} pt</td>
                    <td>{r ? <PointChange value={r.totalPointChange} /> : '-'}</td>
                    <td>{r ? `${r.wins}勝${r.losses}敗` : '-'}</td>
                    {sortKey === 'assets' && (
                      <td>
                        {r ? (r.totalDebt > 0 ? (
                          <span className="text-danger">{r.totalDebt.toLocaleString()} pt</span>
                        ) : '0 pt') : '-'}
                      </td>
                    )}
                    {sortKey === 'assets' && <td>{r ? `${r.totalAssets.toLocaleString()} pt` : '-'}</td>}
                    {sortKey === 'assets' && <td>{r ? <PointChange value={r.totalAssetsChange} /> : '-'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ゲーム別ポイント推移 */}
      {games.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>ゲーム別ポイント推移</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ユーザー</th>
                  {games.map((g) => (
                    <th key={g.id}>{g.title}</th>
                  ))}
                  <th>合計</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => {
                  const r = results.get(u.id);
                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" width={16} height={16} style={{ borderRadius: '50%', flexShrink: 0 }} />
                          ) : (
                            <span style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-border)', display: 'inline-block', flexShrink: 0 }} />
                          )}
                          {u.discordName}
                        </span>
                      </td>
                      {games.map((game) => {
                        const gr = r?.games.find((rg) => rg.gameId === game.id);
                        if (!gr) return <td key={game.id} style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>-</td>;
                        return (
                          <td key={game.id} style={{ fontSize: '12px' }}>
                            <div>
                              <PointChange value={gr.pointChange} />
                            </div>
                            {gr.debtChange > 0 && (
                              <div style={{ color: 'var(--color-danger)', fontSize: '11px' }}>
                                債: {gr.debtChange.toLocaleString()} pt
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td>
                        {r ? (
                          <div>
                            <PointChange value={r.totalPointChange} />
                            {r.totalDebt > 0 && (
                              <div style={{ color: 'var(--color-danger)', fontSize: '11px' }}>
                                債: {r.totalDebt.toLocaleString()} pt
                              </div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
