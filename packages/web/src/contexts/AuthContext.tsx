import React, { createContext, useContext, useEffect, useState } from 'react';
import { verifySession, TOKEN_EXPIRED_EVENT } from '../api/client';

const SESSION_STORAGE_KEY = 'discord-gamble-session';
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

interface AuthContextValue {
  token: string | null;
  isAdmin: boolean;
  isVerifying: boolean;
  guildId: string | null;
  isSessionExpired: boolean;
  /** @deprecated alias for isSessionExpired */
  isTokenExpired: boolean;
  loginUrl: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isAdmin: false,
  isVerifying: false,
  guildId: null,
  isSessionExpired: false,
  isTokenExpired: false,
  loginUrl: null,
});

/**
 * ハッシュフラグメント内のクエリパラメータを取得する。
 */
function getHashParams(): URLSearchParams {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(queryIndex + 1));
}

function getGuildIdFromHash(): string | null {
  const hash = window.location.hash;
  const withoutHash = hash.slice(1).split('?')[0];
  const parts = withoutHash.split('/').filter(Boolean);
  if (parts[0] === 'dashboard' && parts[1]) {
    return parts[1];
  }
  return null;
}

/**
 * 認証を初期化:
 * - ?session=xxx があれば localStorage に保存して使用（OAuth2 認証済み）
 * - ?token=xxx があれば OAuth2 に渡して本人確認を開始
 * - どちらもなければ localStorage から復元
 */
function initAuth(guildId: string | null): string | null {
  const params = getHashParams();

  // OAuth2 認証済みセッション
  const session = params.get('session');
  if (session) {
    localStorage.setItem(SESSION_STORAGE_KEY, session);
    cleanHashParams(['session', 'token']);
    return session;
  }

  // Bot から発行されたトークン → OAuth2 本人確認へリダイレクト
  const token = params.get('token');
  if (token && guildId) {
    const apiBase = BASE_URL.startsWith('http') ? BASE_URL : `${window.location.origin}${BASE_URL}`;
    const currentUrl = window.location.origin + window.location.pathname;
    const oauthUrl = `${apiBase}/auth/discord?guild_id=${encodeURIComponent(guildId)}&token=${encodeURIComponent(token)}&redirect_uri=${encodeURIComponent(currentUrl)}`;
    window.location.href = oauthUrl;
    return null; // リダイレクト中
  }

  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function cleanHashParams(keys: string[]): void {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return;
  const basePath = hash.slice(0, queryIndex);
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  keys.forEach((k) => params.delete(k));
  const remaining = params.toString();
  window.location.hash = remaining ? `${basePath}?${remaining}` : basePath;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [guildId] = useState<string | null>(() => getGuildIdFromHash());
  const [token, setToken] = useState<string | null>(() => initAuth(guildId));
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    setIsVerifying(true);

    verifySession(token)
      .then((res) => {
        if (!cancelled) {
          setIsAdmin(res.isAdmin);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          localStorage.removeItem(SESSION_STORAGE_KEY);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ハッシュ変化時にセッションを再取得
  useEffect(() => {
    const onHashChange = () => {
      const params = getHashParams();
      const s = params.get('session');
      if (s) {
        localStorage.setItem(SESSION_STORAGE_KEY, s);
        setToken(s);
        cleanHashParams(['session']);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // TOKEN_EXPIRED イベントを購読
  useEffect(() => {
    const handler = () => {
      setIsSessionExpired(true);
      setIsAdmin(false);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setToken(null);
    };
    window.addEventListener(TOKEN_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(TOKEN_EXPIRED_EVENT, handler);
  }, []);

  return (
    <AuthContext.Provider value={{
      token,
      isAdmin,
      isVerifying,
      guildId,
      isSessionExpired,
      isTokenExpired: isSessionExpired,
      loginUrl: null, // OAuth2 は token 経由のみ、直接ログインURLは不要
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
