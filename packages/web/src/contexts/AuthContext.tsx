import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSession } from '../api/client';

interface AuthContextValue {
  isEditor: boolean;
  isVerifying: boolean;
  guildId: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  isEditor: false,
  isVerifying: true,
  guildId: null,
});

function getGuildIdFromHash(): string | null {
  const hash = window.location.hash;
  const withoutHash = hash.slice(1).split('?')[0];
  const parts = withoutHash.split('/').filter(Boolean);
  if (parts[0] === 'dashboard' && parts[1]) return parts[1];
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isEditor, setIsEditor] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [guildId, setGuildId] = useState<string | null>(() => getGuildIdFromHash());

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((res) => { if (!cancelled) { setIsEditor(res.isEditor); if (res.guildId) setGuildId(res.guildId); } })
      .catch(() => { if (!cancelled) setIsEditor(false); })
      .finally(() => { if (!cancelled) setIsVerifying(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onHashChange = () => setGuildId(getGuildIdFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return <AuthContext.Provider value={{ isEditor, isVerifying, guildId }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue { return useContext(AuthContext); }
