import React, { createContext, useContext, useEffect, useState } from 'react';
import { verifyToken } from '../api/client';

interface AuthContextValue {
  token: string | null;
  isAdmin: boolean;
  isVerifying: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isAdmin: false,
  isVerifying: false,
});

/**
 * ハッシュフラグメント内のクエリパラメータから token を取得する。
 * 例: /#/events?token=xxx  → "xxx"
 */
function getTokenFromHash(): string | null {
  const hash = window.location.hash; // e.g. "#/events?token=xxx"
  const queryIndex = hash.indexOf('?');
  if (queryIndex === -1) return null;
  const query = hash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  return params.get('token');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getTokenFromHash());
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

  // ハッシュ変化時にトークンを再取得
  useEffect(() => {
    const onHashChange = () => {
      const t = getTokenFromHash();
      setToken(t);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAdmin, isVerifying }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
