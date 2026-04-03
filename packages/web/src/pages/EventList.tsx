import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEvents, deleteEvent, activateEvent } from '../api/client';
import type { Event } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { CircleActive, CircleInactive } from '../components/icons';
import { useTokenSearch } from '../hooks/useTokenSearch';

export default function EventList() {
  const { isAdmin, token } = useAuth();
  const navigate = useNavigate();
  const tokenSearch = useTokenSearch();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getEvents(token ?? undefined)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async () => {
    if (!deleteTarget || !token) return;
    setActionLoading(true);
    try {
      await deleteEvent(deleteTarget.id, token);
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (event: Event) => {
    if (!token) return;
    setActionLoading(true);
    try {
      await activateEvent(event.id, token);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '切り替えに失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Breadcrumb items={[
        { label: 'ホーム', href: '#/events' + tokenSearch },
        { label: 'イベント一覧' },
      ]} />

      <div className="action-bar">
        {isAdmin && (
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => navigate('/events/new' + tokenSearch)}
          >
            + 新規イベント作成
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">読み込み中...</div>
      ) : events.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--color-text-muted)' }}>イベントがありません。</p>
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
                  <th style={{ textAlign: 'left' }}>イベント名</th>
                  <th style={{ textAlign: 'left' }}>開催状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontSize: '16px', color: 'var(--color-text)' }}>{ev.name}</td>
                    <td>
                      {ev.isActive ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <CircleActive />
                          <span style={{ color: 'var(--color-success)', fontWeight: 500, fontSize: '16px' }}>開催中</span>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <CircleInactive />
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '16px' }}>終了</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => navigate(`/events/${ev.id}/games${tokenSearch}`)}
                        >
                          ゲーム一覧
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              className="btn-secondary btn-sm"
                              onClick={() => navigate(`/events/${ev.id}/edit${tokenSearch}`)}
                            >
                              編集
                            </button>
                            <button
                              className="btn-danger btn-sm"
                              disabled={actionLoading}
                              onClick={() => setDeleteTarget(ev)}
                            >
                              削除
                            </button>
                            <button
                              className="btn-secondary btn-sm"
                              disabled={actionLoading || ev.isActive}
                              onClick={() => handleActivate(ev)}
                            >
                              開催中切替
                            </button>
                          </>
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

      {deleteTarget && (
        <ConfirmDialog
          message={`「${deleteTarget.name}」を削除しますか？この操作は取り消せません。`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
