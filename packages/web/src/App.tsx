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
            <Route index element={<Navigate to="/events" replace />} />
            <Route path="/events" element={<EventList />} />
            <Route path="/events/:guildId" element={<EventList />} />
            <Route path="/events/:guildId/new" element={<EventEdit />} />
            <Route path="/events/:guildId/:eventId/edit" element={<EventEdit />} />
            <Route path="/events/:guildId/:eventId/games" element={<GameList />} />
            <Route path="/events/:guildId/:eventId/games/new" element={<GameEdit />} />
            <Route path="/games/:id/edit" element={<GameEdit />} />
            <Route path="/games/:id/status" element={<GameStatus />} />
            <Route path="/events/:guildId/:eventId/results" element={<UserResults />} />
            <Route path="*" element={<Navigate to="/events" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
