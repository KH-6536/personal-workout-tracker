import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Calendar, Layers, LogOut, Dumbbell } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const isWorkout = location.pathname.startsWith('/workout/');

  // Hide bottom nav during active workout for max screen real estate
  if (isWorkout) {
    return <Outlet />;
  }

  return (
    <div className="app-layout">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Home size={22} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={22} />
          <span>History</span>
        </NavLink>
        <NavLink to="/templates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Layers size={22} />
          <span>Splits</span>
        </NavLink>
        <button className="nav-item" onClick={signOut}>
          <LogOut size={22} />
          <span>Logout</span>
        </button>
      </nav>
    </div>
  );
}

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="app-header">
      <Dumbbell size={28} className="header-icon" />
      <div>
        {subtitle && <p className="header-subtitle">{subtitle}</p>}
        <h1 className="header-title">{title}</h1>
      </div>
    </header>
  );
}
