import { useAuth } from '../contexts/AuthContext';

/**
 * トークンが存在する場合に `?token=xxx` 形式のクエリ文字列を返す。
 * ハッシュルーティングでのリンク・navigate に付加して使用する。
 */
export function useTokenSearch(): string {
  const { token } = useAuth();
  return token ? `?token=${encodeURIComponent(token)}` : '';
}
