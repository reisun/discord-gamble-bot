import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame, getEvent, getBets, setGameResult, deleteGame } from '../api/client';
import type { BetType, BetsData, BetCombination, Game, Event } from '../api/types';
import { useAuth } from '../contexts/AuthContext';
import Breadcrumb from '../components/Breadcrumb';
import ConfirmDialog from '../components/ConfirmDialog';
import { ClockIcon, CheckCircleIcon } from '../components/icons';
import { useTokenSearch } from '../hooks/useTokenSearch';
import { toDashboard, toEvent, toGameEdit, toHashPath } from '../routes';

function betTypeLabel(betType: BetType, requiredSelections: number | null): string {
  switch (betType) {
    case 'single': return '単数';
    case 'multi_unordered': return `複数-選択一致 / 選択数: ${requiredSelections}`;
    case 'multi_ordered': return `複数-順番一致（重複なし） / 選択数: ${requiredSelections}`;
    case 'multi_ordered_dup': return `複数-順番一致（重複あり） / 選択数: ${requiredSelections}`;
  }
}

function combinationLabel(
  selectedSymbols: string,
  selectedLabels: string[],
  betType: BetType,
): string {
  const sep = betType === 'multi_ordered' || betType === 'multi_ordered_dup' ? '→' : '、';
  return `${selectedSymbols}: ${selectedLabels.join(sep)}`;
}

function statusLabel(status: Game['status']): { text: string; color: string } {
  switch (status) {
    case 'open': return { text: '受付中', color: 'var(--color-success)' };
    case 'closed': return { text: '締め切り済', color: 'var(--color-warning)' };
    case 'finished': return { text: '結果確定', color: 'var(--color-success)' };
  }
}

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`(残り ${h > 0 ? `${h}時間` : ''}${m}分)`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!remaining) return null;
  return <span style={{ color: 'var(--color-warning)', fontWeight: 500, fontSize: '14px' }}>{remaining}</span>;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

interface CombinationCardProps {
  combo: BetCombination;
  betType: BetType;
  isWinner: boolean;
  revealStats: boolean;
}

function formatOdds(odds: number | null): string {
  return odds == null ? '--' : odds.toFixed(2);
}

function CombinationCard({ combo, betType, isWinner, revealStats }: CombinationCardProps) {
  return (
    <div style={{
      background: isWinner ? 'var(--color-success-bg)' : 'var(--color-surface-dark)',
      border: `1px solid ${isWinner ? 'var(--color-success-border)' : 'var(--color-border)'}`,
      borderRadius: 'var(--border-radius-lg)',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <span style={{ fontSize: '16px', color: 'var(--color-text)' }}>
        {combinationLabel(combo.selectedSymbols, combo.selectedLabels, betType)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <>
          <span style={{ color: 'var(--color-primary-text)', fontSize: '18px', fontWeight: 600 }}>
            ×{formatOdds(combo.odds)}倍
          </span>
          {revealStats && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
              ({(combo.totalPoints ?? 0).toLocaleString()}pt / {combo.betCount ?? 0}人)
            </span>
          )}
        </>
        {isWinner && <CheckCircleIcon />}
      </div>
    </div>
  );
}

export default function GameStatus() {
  const { guildId: paramGuildId, eventId, gameId } = useParams<{
    guildId?: string;
    eventId?: string;
    gameId?: string;
  }>();
  const { isAdmin, token, guildId: authGuildId } = useAuth();
  const guildId = paramGuildId ?? authGuildId;
  const navigate = useNavigate();
  const tokenSearch = useTokenSearch();

  const [game, setGame] = useState<Game | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [bets, setBets] = useState<BetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // 結果確定フォーム
  const [resultSymbols, setResultSymbols] = useState('');
  const [selectedResultSymbols, setSelectedResultSymbols] = useState<string[]>([]);
  const [orderedSymbols, setOrderedSymbols] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!gameId) return;
    const gameIdNum = Number(gameId);
    setLoading(true);
    Promise.all([
      getGame(gameIdNum, token ?? undefined),
      getBets(gameIdNum, token ?? undefined),
    ])
      .then(([g, b]) => {
        setGame(g);
        setBets(b);
        if (g.requiredSelections) {
          setOrderedSymbols(Array(g.requiredSelections).fill(''));
        }
        return getEvent(g.eventId, token ?? undefined);
      })
      .then((ev) => setEvent(ev))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [gameId, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timerId = setInterval(load, 30000);
    return () => clearInterval(timerId);
  }, [load]);

  const buildResultSymbols = (): string => {
    if (!game) return '';
    switch (game.betType) {
      case 'single': return resultSymbols;
      case 'multi_unordered': return [...selectedResultSymbols].sort().join('');
      case 'multi_ordered':
      case 'multi_ordered_dup': return orderedSymbols.join('');
    }
  };

  const handleConfirmResult = async () => {
    if (!game || !token) return;
    const symbols = buildResultSymbols();
    if (!symbols) { setSubmitError('結果を選択してください'); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await setGameResult(game.id, symbols, token);
      load();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : '確定に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!game || !token) return;
    setActionLoading(true);
    try {
      await deleteGame(game.id, token);
      navigate(toEvent(guildId, eventId ?? game.eventId, tokenSearch));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
      setDeleteTarget(false);
    } finally {
      setActionLoading(false);
    }
  };

  const revealStats = isAdmin || game?.status === 'finished';

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!game || !bets) return <div className="error-message">{error ?? 'データが取得できませんでした'}</div>;

  const breadcrumbs = [
    { label: 'ホーム', href: toHashPath(toDashboard(guildId, tokenSearch)) },
    { label: event?.name ?? '...', href: toHashPath(toEvent(guildId, eventId ?? game.eventId, tokenSearch)) },
    { label: game.title },
  ];

  const status = statusLabel(game.status);

  return (
    <>
      <Breadcrumb items={breadcrumbs} />

      {error && <div className="error-message">{error}</div>}

      {/* ゲーム情報カード */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-text)' }}>{game.title}</h1>
            {isAdmin && (
              <>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => navigate(toGameEdit(guildId, eventId ?? game.eventId, game.id, tokenSearch))}
                >
                  編集
                </button>
                <button
                  className="btn-danger btn-sm"
                  disabled={actionLoading}
                  onClick={() => setDeleteTarget(true)}
                >
                  削除
                </button>
              </>
            )}
          </div>
          {game.betType !== 'single' && (
            <div>
              <span className="badge badge-bet-type">
                {betTypeLabel(game.betType, game.requiredSelections)}
              </span>
            </div>
          )}
          {game.description && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>
              {game.description}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <ClockIcon />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
              締め切り: {formatDeadline(game.deadline)}
            </span>
            {game.status === 'open' && <Countdown deadline={game.deadline} />}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            状態:{' '}
            <span style={{ color: status.color, fontWeight: 500 }}>{status.text}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
            {game.betOptions.map((opt) => (
              <span
                key={opt.symbol}
                style={{
                  display: 'inline-block',
                  background: 'var(--color-surface-dark)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius-sm)',
                  padding: '2px 8px',
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {opt.symbol}: {opt.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 賭け組み合わせ・倍率カード */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>
          賭け組み合わせ・倍率
        </h2>
        {bets.combinations.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>まだ賭けがありません。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bets.combinations.map((c) => (
              <CombinationCard
                key={c.selectedSymbols}
                combo={c}
                betType={game.betType}
                isWinner={game.resultSymbols === c.selectedSymbols}
                revealStats={revealStats}
              />
            ))}
            {!revealStats && (
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                ※ 賭け総数・参加人数は結果確定後に公開されます
              </p>
            )}
          </div>
        )}
      </div>

      {/* ゲーム結果カード */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>
          ゲーム結果
        </h2>
        {game.resultSymbols ? (
          (() => {
            const winCombo = bets.combinations.find((c) => c.selectedSymbols === game.resultSymbols);
            const label = winCombo
              ? combinationLabel(game.resultSymbols, winCombo.selectedLabels, game.betType)
              : game.resultSymbols;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircleIcon />
                <span style={{ color: 'var(--color-success)', fontSize: '16px' }}>
                  当選: {label}
                </span>
              </div>
            );
          })()
        ) : (
          <p style={{ color: 'var(--color-text-muted)' }}>結果未確定</p>
        )}
      </div>

      {/* 管理者: 結果確定フォーム */}
      {isAdmin && (game.status === 'closed' || game.status === 'finished') && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '16px' }}>
            結果を確定する {game.status === 'finished' && <span style={{ fontSize: '14px', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>（修正）</span>}
          </h2>
          {submitError && <div className="error-message">{submitError}</div>}

          {game.betType === 'single' && (
            <div className="form-group">
              <label>当選項目を選択</label>
              <select
                value={resultSymbols}
                onChange={(e) => setResultSymbols(e.target.value)}
                style={{ maxWidth: '300px' }}
              >
                <option value="">-- 選択 --</option>
                {game.betOptions.map((opt) => (
                  <option key={opt.symbol} value={opt.symbol}>{opt.symbol}: {opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {game.betType === 'multi_unordered' && (
            <div className="form-group">
              <label>当選項目を選択（順不同・{game.requiredSelections}個）</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                {game.betOptions.map((opt) => {
                  const checked = selectedResultSymbols.includes(opt.symbol);
                  return (
                    <label key={opt.symbol} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', color: 'var(--color-text)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ width: 'auto', accentColor: 'var(--color-primary)' }}
                        disabled={!checked && selectedResultSymbols.length >= (game.requiredSelections ?? 0)}
                        onChange={(e) => {
                          setSelectedResultSymbols((prev) =>
                            e.target.checked ? [...prev, opt.symbol] : prev.filter((s) => s !== opt.symbol),
                          );
                        }}
                      />
                      {opt.symbol}: {opt.label}
                    </label>
                  );
                })}
              </div>
              <p className="form-hint">選択数: {selectedResultSymbols.length} / {game.requiredSelections}</p>
            </div>
          )}

          {(game.betType === 'multi_ordered' || game.betType === 'multi_ordered_dup') && (
            <div className="form-group">
              <label>当選項目を順番通りに選択（{game.requiredSelections}連）</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {orderedSymbols.map((sym, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{i + 1}位</span>
                    <select
                      value={sym}
                      onChange={(e) => {
                        const next = [...orderedSymbols];
                        next[i] = e.target.value;
                        setOrderedSymbols(next);
                      }}
                      style={{ width: '130px' }}
                    >
                      <option value="">--</option>
                      {game.betOptions
                        .filter((opt) =>
                          game.betType !== 'multi_ordered' ||
                          !orderedSymbols.some((s, idx) => idx !== i && s === opt.symbol)
                        )
                        .map((opt) => (
                          <option key={opt.symbol} value={opt.symbol}>{opt.symbol}: {opt.label}</option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleConfirmResult}
            disabled={submitting}
            style={{ marginTop: '8px' }}
          >
            {submitting ? '確定中...' : '確定'}
          </button>
        </div>
      )}

      {/* 個別賭け一覧（管理者のみ） */}
      {isAdmin && bets.bets.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--border-radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 24px 0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>個別賭け一覧</h2>
          </div>
          <div className="table-wrapper" style={{ marginTop: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>ユーザー</th>
                  <th style={{ textAlign: 'left' }}>選択</th>
                  <th style={{ textAlign: 'left' }}>賭けpt</th>
                  <th style={{ textAlign: 'left' }}>借金</th>
                  <th style={{ textAlign: 'left' }}>結果</th>
                  <th>獲得pt</th>
                </tr>
              </thead>
              <tbody>
                {bets.bets.map((bet, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '14px' }}>{bet.userName}</td>
                    <td className="cell-sm" style={{ whiteSpace: 'normal', minWidth: '160px' }}>
                      {combinationLabel(bet.selectedSymbols, bet.selectedLabels, game.betType)}
                    </td>
                    <td className="cell-sm">{bet.amount.toLocaleString()}</td>
                    <td className="cell-sm">{bet.isDebt ? <span style={{ color: 'var(--color-warning)' }}>借金</span> : '-'}</td>
                    <td className="cell-sm">
                      {bet.result === 'win' ? (
                        <span className="text-success">当選</span>
                      ) : bet.result === 'lose' ? (
                        <span className="text-danger">落選</span>
                      ) : (
                        <span className="text-muted">未確定</span>
                      )}
                    </td>
                    <td className="cell-sm" style={{ textAlign: 'right' }}>
                      {bet.pointChange != null
                        ? <span className={bet.pointChange > 0 ? 'text-success' : 'text-muted'}>
                            {bet.pointChange > 0 ? '+' : ''}{bet.pointChange.toLocaleString()}
                          </span>
                        : '-'
                      }
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
          message={`「${game.title}」を削除しますか？この操作は取り消せません。`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(false)}
        />
      )}
    </>
  );
}
