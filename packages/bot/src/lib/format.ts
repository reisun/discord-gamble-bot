import { Game } from './api';

/** ポイント数をカンマ区切りで表示（例: 10,000pt） */
export function fmtPt(pt: number): string {
  return pt.toLocaleString('en-US') + 'pt';
}

/** 賭け方式のラベルを返す */
export function betTypeLabel(betType: string, requiredSelections: number | null): string {
  switch (betType) {
    case 'single':
      return '単数';
    case 'multi_unordered':
      return `複数-選択一致 / ${requiredSelections}択`;
    case 'multi_ordered':
      return `複数-順番一致（重複なし） / ${requiredSelections}択`;
    case 'multi_ordered_dup':
      return `複数-順番一致（重複あり） / ${requiredSelections}択`;
    default:
      return betType;
  }
}

/**
 * 選択記号の文字列を「記号: ラベル」形式に変換する。
 * betType に応じて区切り文字と末尾注釈を付ける。
 */
export function formatSelection(
  selectedSymbols: string,
  optMap: Map<string, string>,
  betType: string,
): string {
  const entries = selectedSymbols.split('').map((s) => `${s}: ${optMap.get(s) ?? s}`);

  switch (betType) {
    case 'single':
      return entries[0] ?? selectedSymbols;
    case 'multi_unordered':
      return entries.join('、') + '（選択一致）';
    case 'multi_ordered':
      return entries.join(' → ') + '（順番一致・重複なし）';
    case 'multi_ordered_dup':
      return entries.join(' → ') + '（順番一致・重複あり）';
    default:
      return entries.join(', ');
  }
}

/** ゲームのオプションリストから symbol → label の Map を作る */
export function buildOptMap(game: Game): Map<string, string> {
  return new Map(game.betOptions.map((o) => [o.symbol, o.label]));
}

/** deadline までの残り時間文字列を返す（締め切り済みの場合は空文字） */
export function fmtRemaining(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return '';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `残り ${h}時間${m}分`;
  return `残り ${m}分`;
}

/** datetime 文字列を「YYYY-MM-DD HH:mm」形式にフォーマット */
export function fmtDeadline(deadline: string): string {
  const d = new Date(deadline);
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const yyyy = map.year;
  const mm = map.month;
  const dd = map.day;
  const hh = map.hour;
  const min = map.minute;
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * `/bet` コマンド用 `option` オートコンプリートのヒントテキストを生成する。
 * Discord のオートコンプリートはテキストを選択値として返すため、
 * ヒント文字列をそのまま choices として返す。
 */
export function optionHint(betType: string, requiredSelections: number | null): string {
  switch (betType) {
    case 'single':
      return '1文字の記号を入力してください（例: A）';
    case 'multi_unordered':
      return `${requiredSelections}文字を順不同で入力してください（例: ${'ABCDE'.slice(0, requiredSelections ?? 2)}）`;
    case 'multi_ordered':
      return `${requiredSelections}文字を順番通りに入力してください（例: ${'ABCDE'.slice(0, requiredSelections ?? 2)}）`;
    case 'multi_ordered_dup':
      return `${requiredSelections}文字を順番通りに入力してください（重複可、例: ${'AA'.padEnd(requiredSelections ?? 2, 'A')}）`;
    default:
      return '記号を入力してください';
  }
}
