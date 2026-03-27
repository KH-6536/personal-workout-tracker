import { useNavigate } from 'react-router-dom';
import { Play, Calendar, TrendingUp, Heart, Scale } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { useTemplates } from '../hooks/useTemplates';
import { useHealthMetrics } from '../hooks/useHealthMetrics';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { DAY_NAMES, type DayOfWeek } from '../types/database';
import { format } from 'date-fns';

export default function HomePage() {
  const { user } = useAuth();
  const { schedule, loading: scheduleLoading } = useSchedule(user?.id);
  const { templates } = useTemplates(user?.id);
  const { sessions, loading: historyLoading } = useWorkoutHistory(user?.id);
  const { getToday: getHealthToday } = useHealthMetrics(user?.id);
  const navigate = useNavigate();

  const healthToday = getHealthToday();

  const today = new Date();
  const dayOfWeek = today.getDay() as DayOfWeek;
  const todaySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);
  const todayTemplate = todaySchedule?.template;

  const recentSessions = sessions.slice(0, 5);
  const totalWorkouts = sessions.length;

  if (scheduleLoading || historyLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="page">
      <AppHeader title="Dashboard" subtitle={format(today, 'EEEE, MMMM d')} />

      {/* Today's Workout Card */}
      <div className="today-card">
        <div className="today-card-header">
          <Calendar size={20} />
          <span>{DAY_NAMES[dayOfWeek]}'s Workout</span>
        </div>

        {todayTemplate ? (
          <>
            <h2 className="today-workout-name">{todayTemplate.name}</h2>
            <button
              className="btn btn-primary btn-large start-btn"
              onClick={() => navigate(`/workout/${todayTemplate.id}`)}
            >
              <Play size={22} />
              Start Workout
            </button>
          </>
        ) : (
          <div className="rest-day">
            <h2 className="today-workout-name">Rest Day</h2>
            <p className="rest-day-text">No workout scheduled for today.</p>
            {templates.length > 0 && (
              <div className="quick-start">
                <p className="quick-start-label">Quick start:</p>
                <div className="quick-start-buttons">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      className="btn btn-outline btn-small"
                      onClick={() => navigate(`/workout/${t.id}`)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <TrendingUp size={20} />
          <div className="stat-value">{totalWorkouts}</div>
          <div className="stat-label">Total Workouts</div>
        </div>
        <div className="stat-card">
          <Calendar size={20} />
          <div className="stat-value">
            {sessions.filter(
              (s) =>
                new Date(s.completed_at) >=
                new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)
            ).length}
          </div>
          <div className="stat-label">This Week</div>
        </div>
        {healthToday?.recovery_score != null && (
          <div className={`stat-card ${healthToday.recovery_score >= 67 ? 'stat-card-green' : healthToday.recovery_score >= 34 ? 'stat-card-yellow' : 'stat-card-red'}`}>
            <Heart size={20} />
            <div className="stat-value">{healthToday.recovery_score}%</div>
            <div className="stat-label">Recovery</div>
          </div>
        )}
        {healthToday?.weight != null && (
          <div className="stat-card">
            <Scale size={20} />
            <div className="stat-value">
              {healthToday.weight_unit === 'kg'
                ? (healthToday.weight * 2.20462).toFixed(1)
                : healthToday.weight}
            </div>
            <div className="stat-label">Weight (lbs)</div>
          </div>
        )}
      </div>

      {/* Recent Workouts */}
      {recentSessions.length > 0 && (
        <section className="section">
          <h3 className="section-title">Recent Workouts</h3>
          <div className="recent-list">
            {recentSessions.map((s) => (
              <div
                key={s.id}
                className="recent-item"
                onClick={() => navigate('/history')}
              >
                <div className="recent-item-name">
                  {s.template_name || 'Custom Workout'}
                </div>
                <div className="recent-item-date">
                  {format(new Date(s.completed_at), 'MMM d, h:mm a')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {templates.length === 0 && (
        <div className="empty-state">
          <h3>Get Started</h3>
          <p>Create your workout splits to begin tracking.</p>
          <button className="btn btn-primary" onClick={() => navigate('/templates')}>
            Create Splits
          </button>
        </div>
      )}
    </div>
  );
}
