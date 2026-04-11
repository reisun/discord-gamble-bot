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
 * ?token=xxx (管理者トークン) または ?session=xxx (OAuth2セッション) を探す。
 */
function getAuthFromHash(): { token: string; source: 'token' | 'session' } | null {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  // token（管理者）が優先
  const token = params.get('token');
  if (token) return { token, source: 'token' };
  const session = params.get('session');
  if (session) return { token: session, source: 'session' };
  return null;
}

/**
 * ハッシュフラグメントから guildId を取得する。
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
 * 認証を初期化: URLハッシュ → localStorage の順に探す
 */
function initAuth(): string | null {
  const fromHash = getAuthFromHash();
  if (fromHash) {
    localStorage.setItem(SESSION_STORAGE_KEY, fromHash.token);
    // URLから認証パラメータを除去
    const hash = window.location.hash;
    const queryIndex = hash.indexOf('?');
    if (queryIndex !== -1) {
      const basePath = hash.slice(0, queryIndex);
      const params = new URLSearchParams(hash.slice(queryIndex + 1));
      params.delete('token');
      params.delete('session');
      const remaining = params.toString();
      window.location.hash = remaining ? `${basePath}?${remaining}` : basePath;
    }
    return fromHash.token;
  }
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

function buildLoginUrl(guildId: string | null): string | null {
  if (!guildId) return null;
  const currentUrl = window.location.origin + window.location.pathname;
  const apiBase = BASE_URL.startsWith('http') ? BASE_URL : `${window.location.origin}${BASE_URL}`;
  return `${apiBase}/auth/discord?guild_id=${encodeURIComponent(guildId)}&redirect_uri=${encodeURIComponent(currentUrl)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => initAuth());
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

  // ハッシュ変化時に認証情報と guildId を再取得
  useEffect(() => {
    const onHashChange = () => {
      const auth = getAuthFromHash();
      const g = getGuildIdFromHash();
      if (auth) {
        localStorage.setItem(SESSION_STORAGE_KEY, auth.token);
        setToken(auth.token);
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
