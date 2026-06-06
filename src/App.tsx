import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ActiveWorkoutPage from './pages/ActiveWorkoutPage';
import HistoryPage from './pages/HistoryPage';
import TemplatesPage from './pages/TemplatesPage';
import HealthPage from './pages/HealthPage';
import NutritionPage from './pages/NutritionPage';
import NutritionAnalyticsPage from './pages/NutritionAnalyticsPage';
import HabitsPage from './pages/HabitsPage';
import LoadingSpinner from './components/LoadingSpinner';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner message="Loading..." />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="nutrition" element={<NutritionPage />} />
        <Route path="nutrition/analytics" element={<NutritionAnalyticsPage />} />
        <Route path="habits" element={<HabitsPage />} />
      </Route>
      <Route path="workout/:templateId" element={<ActiveWorkoutPage />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner message="Loading..." />;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
