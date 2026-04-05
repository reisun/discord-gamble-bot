import React, { createContext, useContext, useEffect, useState } from 'react';
import { verifyToken } from '../api/client';

interface AuthContextValue {
  token: string | null;
  isAdmin: boolean;
  isVerifying: boolean;
  guildId: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isAdmin: false,
  isVerifying: false,
  guildId: null,
});

/**
 * ハッシュフラグメント内のクエリパラメータから token を取得する。
 * 例: /#/dashboard/123456789?token=xxx  → "xxx"
 */
function getTokenFromHash(): string | null {
  const hash = window.location.hash; // e.g. "#/dashboard/123456789?token=xxx"
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const query = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return params.get('token');
}

/**
 * ハッシュフラグメントから guildId を取得する。
 * 例: /#/dashboard/123456789/...  → "123456789"
 */
function getGuildIdFromHash(): string | null {
  const hash = window.location.hash; // e.g. "#/dashboard/123456789?token=xxx"
  const withoutHash = hash.slice(1).split('?')[0];
  const parts = withoutHash.split('/').filter(Boolean);
  if ((parts[0] === 'dashboard' || parts[0] === 'events') && parts[1]) {
    return parts[1];
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getTokenFromHash());
  const [guildId, setGuildId] = useState<string | null>(() => getGuildIdFromHash());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    setIsVerifying(true);

    verifyToken(token)
      .then((res) => {
        if (!cancelled) {
          setIsAdmin(res.isAdmin);
        }
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setIsVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ハッシュ変化時にトークンと guildId を再取得
  useEffect(() => {
    const onHashChange = () => {
      const t = getTokenFromHash();
      const g = getGuildIdFromHash();
      setToken(t);
      setGuildId(g);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAdmin, isVerifying, guildId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
