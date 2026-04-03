import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, getEvent, createGame, updateGame } from '../api/client';
import type { BetType, Game } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import { useTokenSearch } from '../hooks/useTokenSearch';

interface BetOptionDraft {
  id?: number;
  symbol: string;
  label: string;
}

const BET_TYPE_OPTIONS: { value: BetType; label: string; description: string }[] = [
  { value: 'single', label: '単数', description: '記号を1つ選ぶ賭け方式です。' },
  {
    value: 'multi_unordered',
    label: '複数-選択一致',
    description: '複数の記号を選び、順序に関わらず選択した記号がすべて一致すれば当選する賭け方式です。',
  },
  {
    value: 'multi_ordered',
    label: '複数-順番一致（重複なし）',
    description: '複数の記号を順番通りに選び、記号と順番が完全に一致すれば当選する賭け方式です。同じ記号は1回しか選べません。',
  },
  {
    value: 'multi_ordered_dup',
    label: '複数-順番一致（重複あり）',
    description: '複数の記号を順番通りに選び、記号と順番が完全に一致すれば当選する賭け方式です。同じ記号を複数回選べます。',
  },
];

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GameEdit() {
  // Route: /events/:guildId/:eventId/games/new  or  /games/:id/edit
  const params = useParams<{ guildId?: string; eventId?: string; id?: string }>();
  const isNew = !params.id;
  const gameId = params.id ? Number(params.id) : undefined;
  const { token, guildId: authGuildId } = useAuth();
  const guildId = params.guildId ?? authGuildId;
  const navigate = useNavigate();
  const tokenSearch = useTokenSearch();

  const [eventId, setEventId] = useState<number | null>(
    params.eventId ? Number(params.eventId) : null,
  );
  const [eventName, setEventName] = useState('');
  const [game, setGame] = useState<Game | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(() => toLocalDatetimeValue(new Date().toISOString()));
  const [betType, setBetType] = useState<BetType>('single');
  const [requiredSelections, setRequiredSelections] = useState(2);
  const [options, setOptions] = useState<BetOptionDraft[]>([
    { symbol: '', label: '' },
    { symbol: '', label: '' },
  ]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  const isPublished = game?.isPublished ?? false;

  useEffect(() => {
    if (isNew) {
      // eventId は params.eventId から設定済み
      if (params.eventId) {
        getEvent(Number(params.eventId), token ?? undefined)
          .then((ev) => setEventName(ev.name))
          .catch(() => setEventName(''));
      }
      return;
    }
    setLoading(true);
    getGame(gameId!, token ?? undefined)
      .then((g) => {
        setGame(g);
        setEventId(g.eventId);
        setTitle(g.title);
        setDescription(g.description ?? '');
        setDeadline(toLocalDatetimeValue(g.deadline));
        setBetType(g.betType);
        setRequiredSelections(g.requiredSelections ?? 2);
        setOptions(g.betOptions.map((o) => ({ id: o.id, symbol: o.symbol, label: o.label })));
        return getEvent(g.eventId, token ?? undefined);
      })
      .then((ev) => setEventName(ev.name))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const addOption = () => setOptions((prev) => [...prev, { symbol: '', label: '' }]);
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, idx) => idx !== i));
  const updateOption = (i: number, field: 'symbol' | 'label', value: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));

  const validate = (): string | null => {
    if (title.trim().length === 0 || title.length > 100) return 'ゲームタイトルは1〜100文字で入力してください';
    if (description.length > 500) return '説明は500文字以内で入力してください';
    if (!deadline) return '締め切り日時を入力してください';
    if (new Date(deadline) <= new Date()) return '締め切り日時は現在時刻より未来にしてください';
    if (betType !== 'single' && (!Number.isInteger(requiredSelections) || requiredSelections < 2)) {
      return '選択数は2以上の整数を入力してください';
    }
    if (options.length < 2) return '賭け項目は2つ以上必要です';
    const symbolPattern = /^[A-Z1-9]$/;
    const symbols = new Set<string>();
    for (const opt of options) {
      if (!symbolPattern.test(opt.symbol)) return `記号「${opt.symbol}」は半角大文字英字(A〜Z)または半角数字(1〜9)を1文字で入力してください`;
      if (symbols.has(opt.symbol)) return `記号「${opt.symbol}」が重複しています`;
      symbols.add(opt.symbol);
      if (opt.label.trim().length === 0 || opt.label.length > 50) return '項目名は1〜50文字で入力してください';
    }
    if (betType !== 'single' && options.length < requiredSelections) {
      return `賭け項目数（${options.length}）が選択数（${requiredSelections}）以上必要です`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const validErr = validate();
    if (validErr) { setError(validErr); return; }

    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      deadline: new Date(deadline).toISOString(),
      betType,
      requiredSelections: betType !== 'single' ? requiredSelections : null,
      betOptions: options.map((o) => ({ symbol: o.symbol, label: o.label.trim() })),
    };

    try {
      const gamePath = guildId
        ? `/events/${guildId}/${eventId}/games${tokenSearch}`
        : `/events${tokenSearch}`;
      if (isNew) {
        await createGame(eventId!, body, token);
        navigate(gamePath);
      } else {
        await updateGame(gameId!, body, token);
        navigate(gamePath);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const eventsBase = guildId ? `/events/${guildId}` : '/events';
  const backPath = eventId
    ? `${eventsBase}/${eventId}/games${tokenSearch}`
    : `${eventsBase}${tokenSearch}`;

  const breadcrumbs = isNew
    ? [
        { label: 'ホーム', href: `#${eventsBase}${tokenSearch}` },
        { label: 'イベント一覧', href: `#${eventsBase}${tokenSearch}` },
        { label: eventName || '...', href: `#${eventsBase}/${eventId}/games${tokenSearch}` },
        { label: 'ゲーム一覧', href: `#${eventsBase}/${eventId}/games${tokenSearch}` },
        { label: '新規作成' },
      ]
    : [
        { label: 'ホーム', href: `#${eventsBase}${tokenSearch}` },
        { label: 'イベント一覧', href: `#${eventsBase}${tokenSearch}` },
        { label: eventName || '...', href: `#${eventsBase}/${eventId}/games${tokenSearch}` },
        { label: 'ゲーム一覧', href: `#${eventsBase}/${eventId}/games${tokenSearch}` },
        { label: title || '編集' },
      ];

  const selectedBetTypeInfo = BET_TYPE_OPTIONS.find((o) => o.value === betType);

  if (loading) return <div className="loading">読み込み中...</div>;

  return (
    <>
      <Breadcrumb items={breadcrumbs} />
      <h1 className="page-title">{isNew ? '新規ゲーム作成' : 'ゲーム編集'}</h1>

      {isPublished && (
        <div style={{
          background: '#fff3cd',
          color: '#856404',
          padding: '10px 16px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
        }}>
          このゲームは公開済みです。一部フィールドは編集できません。
        </div>
      )}

      <div className="card" style={{ maxWidth: '640px', margin: '0 auto' }}>
        {error && <div className="error-message" ref={errorRef}>{error}</div>}
        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="title">ゲームタイトル *</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">説明</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="deadline">締め切り日時 *</label>
            <input
              id="deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              disabled={isPublished}
              style={{ maxWidth: '240px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="betType">賭け方式 *</label>
            <select
              id="betType"
              value={betType}
              onChange={(e) => setBetType(e.target.value as BetType)}
              disabled={isPublished}
              style={{ maxWidth: '320px' }}
            >
              {BET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {selectedBetTypeInfo && (
              <p className="form-hint" style={{ marginTop: '6px' }}>
                ℹ {selectedBetTypeInfo.description}
              </p>
            )}
          </div>

          {betType !== 'single' && (
            <div className="form-group">
              <label htmlFor="requiredSelections">選択数 *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  id="requiredSelections"
                  type="number"
                  value={requiredSelections}
                  onChange={(e) => setRequiredSelections(Number(e.target.value))}
                  min={2}
                  step={1}
                  required
                  disabled={isPublished}
                  style={{ maxWidth: '100px' }}
                />
                <span>個</span>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>賭け項目 *</label>
            <div style={{
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '80px' }}>記号</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>項目名</th>
                    {!isPublished && <th style={{ padding: '8px 12px', width: '60px' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {options.map((opt, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          type="text"
                          value={opt.symbol}
                          onChange={(e) => updateOption(i, 'symbol', e.target.value.toUpperCase())}
                          maxLength={1}
                          placeholder="A"
                          disabled={isPublished}
                          style={{ width: '56px', textAlign: 'center', fontWeight: 700 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateOption(i, 'label', e.target.value)}
                          maxLength={50}
                          placeholder="チームA"
                        />
                      </td>
                      {!isPublished && (
                        <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => removeOption(i)}
                            disabled={options.length <= 2}
                          >
                            削除
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isPublished && (
                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)' }}>
                  <button type="button" className="btn-secondary btn-sm" onClick={addOption}>
                    + 項目追加
                  </button>
                </div>
              )}
            </div>
            <p className="form-hint">
              記号は半角大文字英字(A〜Z)または半角数字(1〜9)を1文字。同一ゲーム内で一意。
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(backPath)}
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
