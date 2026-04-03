import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvent, getGames, deleteEvent, publishGame } from '../api/client';
import type { Event, Game } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { EyeIcon, EyeOffIcon } from '../components/icons';
import { useTokenSearch } from '../hooks/useTokenSearch';

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${m}`;
}

export default function GameList() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAdmin, token } = useAuth();
  const navigate = useNavigate();
  const tokenSearch = useTokenSearch();

  const [event, setEvent] = useState<Event | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState(false);

  const evId = Number(eventId);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      getEvent(evId, token ?? undefined),
      getGames(evId, token ?? undefined),
    ])
      .then(([ev, gs]) => {
        setEvent(ev);
        setGames(gs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteEvent = async () => {
    if (!token) return;
    setActionLoading(true);
    try {
      await deleteEvent(evId, token);
      navigate('/events' + tokenSearch);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleteEventTarget(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (game: Game) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await publishGame(game.id, !game.isPublished, token);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '切り替えに失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const breadcrumbs = [
    { label: 'ホーム', href: '#/events' + tokenSearch },
    { label: event?.name ?? '...' },
  ];

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <>
      <Breadcrumb items={breadcrumbs} />

      {/* イベント名ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text)' }}>
          イベント: {event?.name}
        </h1>
        {event?.isActive && (
          <span className="badge badge-active">開催中</span>
        )}
        {isAdmin && (
          <>
            <button
              className="btn-secondary btn-sm"
              onClick={() => navigate(`/events/${evId}/edit${tokenSearch}`)}
            >
              編集
            </button>
            <button
              className="btn-danger btn-sm"
              disabled={actionLoading}
              onClick={() => setDeleteEventTarget(true)}
            >
              削除
            </button>
          </>
        )}
      </div>

      {/* アクションバー */}
      <div className="action-bar" style={{ marginBottom: '16px' }}>
        {isAdmin && (
          <>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/events/${evId}/results${tokenSearch}`)}
            >
              ユーザー結果一覧
            </button>
            <button
              className="btn-primary"
              style={{ marginLeft: 'auto' }}
              onClick={() => navigate(`/events/${evId}/games/new${tokenSearch}`)}
            >
              + 新規ゲーム作成
            </button>
          </>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {games.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--color-text-muted)' }}>ゲームがありません。</p>
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', width: '56px' }}>#</th>
                  <th style={{ textAlign: 'left' }}>ゲームタイトル</th>
                  <th style={{ textAlign: 'left' }}>締め切り</th>
                  <th style={{ textAlign: 'left' }}>公開</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => (
                  <tr key={g.id}>
                    <td className="cell-sm">{i + 1}</td>
                    <td style={{ fontSize: '16px' }}>{g.title}</td>
                    <td className="cell-sm">{formatDeadline(g.deadline)}</td>
                    <td>
                      {g.isPublished ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '14px' }}>
                          <EyeIcon />公開
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-disabled)', fontSize: '14px' }}>
                          <EyeOffIcon />非公開
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => navigate(`/games/${g.id}/status${tokenSearch}`)}
                        >
                          詳細
                        </button>
                        {isAdmin && (
                          <button
                            className={`btn-sm ${g.isPublished ? 'btn-warning' : 'btn-success'}`}
                            disabled={actionLoading}
                            onClick={() => handlePublish(g)}
                          >
                            {g.isPublished ? '非公開にする' : '公開する'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {deleteEventTarget && event && (
        <ConfirmDialog
          message={`「${event.name}」を削除しますか？この操作は取り消せません。`}
          onConfirm={handleDeleteEvent}
          onCancel={() => setDeleteEventTarget(false)}
        />
      )}
    </>
  );
}
