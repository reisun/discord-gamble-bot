import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import EventList from './pages/EventList';
import EventEdit from './pages/EventEdit';
import GameList from './pages/GameList';
import GameEdit from './pages/GameEdit';
import GameStatus from './pages/GameStatus';
import UserResults from './pages/UserResults';
import Privacy from './pages/Privacy';

function TokenExpiredBanner() {
  const { isSessionExpired } = useAuth();
  if (!isSessionExpired) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#b91c1c',
      color: '#ffffff',
      padding: '10px 16px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: 500,
    }}>
      セッションの有効期限が切れました。Discordで <code>/dashboard</code> コマンドを再実行してください。
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TokenExpiredBanner />
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<EventList />} />
            <Route path="/dashboard/:guildId" element={<EventList />} />
            <Route path="/dashboard/:guildId/new-event" element={<EventEdit />} />
            <Route path="/dashboard/:guildId/:eventId/edit" element={<EventEdit />} />
            <Route path="/dashboard/:guildId/:eventId" element={<GameList />} />
            <Route path="/dashboard/:guildId/:eventId/new-game" element={<GameEdit />} />
            <Route path="/dashboard/:guildId/:eventId/results" element={<UserResults />} />
            <Route path="/dashboard/:guildId/:eventId/:gameId/edit" element={<GameEdit />} />
            <Route path="/dashboard/:guildId/:eventId/:gameId" element={<GameStatus />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
