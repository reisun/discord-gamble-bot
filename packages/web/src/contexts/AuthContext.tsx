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
 * ハッシュフラグメント内のクエリパラメータから session を取得する。
 * 例: /#/dashboard/123456789?session=xxx  → "xxx"
 */
function getSessionFromHash(): string | null {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const query = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return params.get('session');
}

/**
 * ハッシュフラグメントから guildId を取得する。
 * 例: /#/dashboard/123456789/...  → "123456789"
 */
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
 * セッションを初期化: URLハッシュ → localStorage の順に探す
 */
function initSession(): string | null {
  const fromHash = getSessionFromHash();
  if (fromHash) {
    localStorage.setItem(SESSION_STORAGE_KEY, fromHash);
    // URLからセッションパラメータを除去
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex !== -1) {
      const basePath = hash.slice(0, queryIndex);
      const params = new URLSearchParams(hash.slice(queryIndex + 1));
      params.delete('session');
      const remaining = params.toString();
      window.location.hash = remaining ? `${basePath}?${remaining}` : basePath;
    }
    return fromHash;
  }
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function buildLoginUrl(guildId: string | null): string | null {
  if (!guildId) return null;
  const currentUrl = window.location.origin + window.location.pathname;
  // BASE_URL が相対パスの場合、現在のオリジンを付与してフルURLにする
  const apiBase = BASE_URL.startsWith('http') ? BASE_URL : `${window.location.origin}${BASE_URL}`;
  return `${apiBase}/auth/discord?guild_id=${encodeURIComponent(guildId)}&redirect_uri=${encodeURIComponent(currentUrl)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => initSession());
  const [guildId, setGuildId] = useState<string | null>(() => getGuildIdFromHash());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // セッションがなく guildId がある場合、Discord OAuth2 へ自動リダイレクト
  useEffect(() => {
    if (!token && !isVerifying && guildId) {
      const url = buildLoginUrl(guildId);
      if (url) {
        window.location.href = url;
      }
    }
  }, [token, isVerifying, guildId]);

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
          if (res.guildId && res.guildId !== '*') {
            setGuildId(res.guildId);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAdmin(false);
          // セッション無効 → localStorageからも削除
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

  // ハッシュ変化時にセッションと guildId を再取得
  useEffect(() => {
    const onHashChange = () => {
      const s = getSessionFromHash();
      const g = getGuildIdFromHash();
      if (s) {
        localStorage.setItem(SESSION_STORAGE_KEY, s);
        setToken(s);
      }
      setGuildId(g);
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

  const loginUrl = buildLoginUrl(guildId);

  return (
    <AuthContext.Provider value={{
      token,
      isAdmin,
      isVerifying,
      guildId,
      isSessionExpired,
      isTokenExpired: isSessionExpired,
      loginUrl,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
