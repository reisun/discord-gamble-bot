import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvents, deleteEvent, activateEvent, publishEvent } from '../api/client';
import type { Event } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { CircleActive, EyeIcon, EyeOffIcon } from '../components/icons';
import { toEvent, toHashPath, toNewEvent } from '../routes';

export default function EventList() {
  const { guildId: paramGuildId } = useParams<{ guildId?: string }>();
  const { isEditor } = useAuth();
  const navigate = useNavigate();

  const guildId = paramGuildId ?? null;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    if (!guildId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getEvents(guildId)
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteEvent(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async (event: Event) => {
    setActionLoading(true);
    try {
      await activateEvent(event.id);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '切り替えに失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (event: Event) => {
    setActionLoading(true);
    try {
      await publishEvent(event.id, !event.isPublished);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '公開設定の変更に失敗しました');
    } finally {
      setActionLoading(false);
    }
  };

  if (!guildId) {
    return (
      <div className="card" style={{ textAlign: 'center', marginTop: '48px' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Discordの <code>/link</code> コマンドからアクセスしてください。
        </p>
      </div>
    );
  }

  return (
    <>
      <Breadcrumb items={[
        { label: 'ホーム' },
      ]} />

      <div className="action-bar">
        {isEditor && (
          <button
            className="btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => navigate(toNewEvent(guildId))}
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
                  {isEditor && <th style={{ textAlign: 'left' }}>公開</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={{ fontSize: '16px' }}>
                      <a href={toHashPath(toEvent(guildId, ev.id))} style={{ color: 'var(--color-text)', textDecoration: 'none' }} onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')} onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}>
                        {ev.name}
                      </a>
                    </td>
                    <td>
                      {ev.isActive ? (
                        <span className="badge badge-active event-status-badge">
                          <CircleActive />開催中
                        </span>
                      ) : (
                        <span className="badge badge-inactive event-status-badge">
                          ー 非開催
                        </span>
                      )}
                    </td>
                    {isEditor && (
                      <td>
                        {ev.isPublished ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', fontSize: '14px' }}>
                            <EyeIcon />公開
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-disabled)', fontSize: '14px' }}>
                            <EyeOffIcon />非公開
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="btn-outline btn-sm"
                          onClick={() => navigate(toEvent(guildId, ev.id))}
                        >
                          詳細
                        </button>
                        {isEditor && (
                          <>
                            <button
                              className="btn-secondary btn-sm"
                              disabled={actionLoading}
                              onClick={() => handleActivate(ev)}
                            >
                              開催中切替
                            </button>
                            <button
                              className={`btn-sm ${ev.isPublished ? 'btn-warning' : 'btn-success'}`}
                              disabled={actionLoading || ev.isActive}
                              title={ev.isActive ? '開催中のイベントは非公開にできません' : undefined}
                              onClick={() => handlePublish(ev)}
                            >
                              {ev.isPublished ? '非公開にする' : '公開にする'}
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
