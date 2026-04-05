import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import EventList from './pages/EventList';
import EventEdit from './pages/EventEdit';
import GameList from './pages/GameList';
import GameEdit from './pages/GameEdit';
import GameStatus from './pages/GameStatus';
import UserResults from './pages/UserResults';

export default function App() {
  return (
    <AuthProvider>
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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
