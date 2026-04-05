import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getGuild } from '../api/client';
import { LogoIcon } from './icons';
import { useTokenSearch } from '../hooks/useTokenSearch';
import { toDashboard, toHashPath } from '../routes';

export default function Header() {
  const { isAdmin, isVerifying, guildId } = useAuth();
  const tokenSearch = useTokenSearch();
  const [guildName, setGuildName] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) { setGuildName(null); return; }
    getGuild(guildId)
      .then((g) => setGuildName(g.guildName))
      .catch(() => setGuildName(null));
  }, [guildId]);

  const titleText = '賭けダッシュボード';

  const homeHref = toHashPath(toDashboard(guildId, tokenSearch));

  return (
    <header style={{
      background: 'var(--color-header-bg)',
      borderBottom: '1px solid #000',
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexShrink: 0,
    }}>
      <a href={homeHref} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div style={{
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <LogoIcon />
        </div>
        <span style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '20px',
          whiteSpace: 'nowrap',
        }}>
          {titleText}
        </span>
      </a>

      <div>
        {isVerifying ? (
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>認証中...</span>
        ) : isAdmin ? (
          <span style={{
            background: 'rgba(255, 137, 4, 0.15)',
            color: 'var(--color-warning)',
            border: '1px solid rgba(255, 137, 4, 0.4)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 600,
          }}>管理者</span>
        ) : (
          <span style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
          }}>一般ユーザー</span>
        )}
      </div>
    </header>
  );
}
