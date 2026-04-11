/**
 * 以前はトークンをURLパラメータとして付加していたが、
 * OAuth2セッション方式に移行したため常に空文字を返す。
 * 既存の呼び出し元との互換性のために残している。
 */
export function useTokenSearch(): string {
  return '';
}
