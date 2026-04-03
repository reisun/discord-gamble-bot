import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvent, createEvent, updateEvent } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { useTokenSearch } from '../hooks/useTokenSearch';

export default function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const { token } = useAuth();
  const navigate = useNavigate();
  const tokenSearch = useTokenSearch();

  const [name, setName] = useState('');
  const [initialPoints, setInitialPoints] = useState(10000);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getEvent(Number(id), token ?? undefined)
      .then((ev) => {
        setName(ev.name);
        setInitialPoints(ev.initialPoints);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (name.trim().length === 0 || name.length > 100) {
      setError('イベント名は1〜100文字で入力してください');
      return;
    }
    if (!Number.isInteger(initialPoints) || initialPoints < 1) {
      setError('初期ポイントは1以上の整数を入力してください');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await createEvent({ name: name.trim(), initialPoints }, token);
      } else {
        await updateEvent(Number(id), { name: name.trim(), initialPoints }, token);
      }
      navigate('/events' + tokenSearch);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = isNew
    ? [
        { label: 'ホーム', href: '#/events' + tokenSearch },
        { label: 'イベント一覧', href: '#/events' + tokenSearch },
        { label: '新規作成' },
      ]
    : [
        { label: 'ホーム', href: '#/events' + tokenSearch },
        { label: 'イベント一覧', href: '#/events' + tokenSearch },
        { label: name || '編集' },
        { label: '編集' },
      ];

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <h1 className="page-title">{isNew ? '新規イベント作成' : 'イベント編集'}</h1>

      <div className="card" style={{ maxWidth: '480px', margin: '0 auto' }}>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">イベント名 *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="initialPoints">初期ポイント *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="initialPoints"
                type="number"
                value={initialPoints}
                onChange={(e) => setInitialPoints(Number(e.target.value))}
                min={1}
                step={1}
                required
                style={{ maxWidth: '160px' }}
              />
              <span>pt</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/events' + tokenSearch)}
            >
              キャンセル
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
