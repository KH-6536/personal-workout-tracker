import { useNavigate } from 'react-router-dom';
import { Play, TrendingUp, Heart, Scale, Utensils, Beef, Wheat, Droplet, Dumbbell, Moon, Clock, CheckSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSchedule } from '../hooks/useSchedule';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { useTemplates } from '../hooks/useTemplates';
import { useHealthMetrics } from '../hooks/useHealthMetrics';
import { useNutritionGoals, useFoodLogs } from '../hooks/useNutrition';
import { useHabits, useHabitLogs, useRizeDaily } from '../hooks/useHabits';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { DAY_NAMES, MEAL_LABELS, type DayOfWeek, type MealType } from '../types/database';
import { format } from 'date-fns';

// YYYY-MM-DD in local (browser) time — matches what we write to habit_logs from the client.
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function MiniCalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min(consumed / (target || 1), 1.5);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - pct * circumference;
  const remaining = target - consumed;
  const color = consumed > target ? 'var(--danger)' : 'var(--accent)';

  return (
    <div className="dash-ring-container">
      <svg viewBox="0 0 96 96" className="dash-ring-svg">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="dash-ring-text">
        <div className="dash-ring-value">{Math.round(consumed)}</div>
        <div className="dash-ring-label">
          {remaining >= 0 ? `${Math.round(remaining)} left` : `${Math.round(-remaining)} over`}
        </div>
      </div>
    </div>
  );
}

function MiniMacroBar({ label, icon, current, target, color }: { label: string; icon: React.ReactNode; current: number; target: number; color: string }) {
  const pct = Math.min((current / (target || 1)) * 100, 100);
  return (
    <div className="dash-macro-row">
      <div className="dash-macro-icon" style={{ color }}>{icon}</div>
      <div className="dash-macro-info">
        <div className="dash-macro-header">
          <span className="dash-macro-label">{label}</span>
          <span className="dash-macro-nums">{Math.round(current)}/{Math.round(target)}g</span>
        </div>
        <div className="dash-macro-track">
          <div className="dash-macro-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const { schedule, loading: scheduleLoading } = useSchedule(user?.id);
  const { templates } = useTemplates(user?.id);
  const { sessions, loading: historyLoading } = useWorkoutHistory(user?.id);
  const { getToday: getHealthToday } = useHealthMetrics(user?.id);
  const { goals } = useNutritionGoals(user?.id);
  const todayStr = new Date().toISOString().split('T')[0];
  const { dailySummary, loading: nutritionLoading } = useFoodLogs(user?.id, todayStr);

  // Habits — today's checklist
  const todayLocal = ymd(new Date());
  const yesterdayLocal = ymd(new Date(Date.now() - 86400000));
  const { habits } = useHabits(user?.id);
  const { isCompleted, toggle } = useHabitLogs(user?.id, todayLocal, todayLocal);
  // Rize — yesterday's working hours
  const { getDate: getRize } = useRizeDaily(user?.id, yesterdayLocal, yesterdayLocal);
  const rizeYesterday = getRize(yesterdayLocal);

  const navigate = useNavigate();

  const healthToday = getHealthToday();

  const today = new Date();
  const dayOfWeek = today.getDay() as DayOfWeek;
  const todaySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);
  const todayTemplate = todaySchedule?.template;

  // Week schedule preview (next 7 days)
  const weekPreview = Array.from({ length: 7 }, (_, i) => {
    const d = (dayOfWeek + i) % 7 as DayOfWeek;
    const entry = schedule.find((s) => s.day_of_week === d);
    return { day: d, name: DAY_NAMES[d].slice(0, 3), template: entry?.template?.name ?? null, isToday: i === 0 };
  });

  const recentSessions = sessions.slice(0, 3);
  const thisWeekCount = sessions.filter(
    (s) => new Date(s.completed_at) >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)
  ).length;

  const calorieTarget = goals?.calorie_target ?? 2500;
  const proteinTarget = goals?.protein_g ?? 180;
  const carbsTarget = goals?.carbs_g ?? 250;
  const fatTarget = goals?.fat_g ?? 80;

  // Meals logged today
  const mealsLogged = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[])
    .filter((mt) => dailySummary.meals[mt].length > 0);

  if (scheduleLoading || historyLoading) {
    return <LoadingSpinner message="Loading..." />;
  }

  return (
    <div className="page">
      <AppHeader title="Dashboard" subtitle={format(today, 'EEEE, MMMM d')} />

      {/* Health vitals strip */}
      {healthToday && (
        <div className="dash-vitals">
          {healthToday.recovery_score != null && (
            <div className={`dash-vital ${healthToday.recovery_score >= 67 ? 'dash-vital--green' : healthToday.recovery_score >= 34 ? 'dash-vital--yellow' : 'dash-vital--red'}`}>
              <Heart size={14} />
              <span className="dash-vital-val">{healthToday.recovery_score}%</span>
              <span className="dash-vital-label">Recovery</span>
            </div>
          )}
          {healthToday.resting_heart_rate != null && (
            <div className="dash-vital">
              <Heart size={14} />
              <span className="dash-vital-val">{healthToday.resting_heart_rate}</span>
              <span className="dash-vital-label">RHR</span>
            </div>
          )}
          {healthToday.hrv != null && (
            <div className="dash-vital">
              <TrendingUp size={14} />
              <span className="dash-vital-val">{Math.round(healthToday.hrv)}</span>
              <span className="dash-vital-label">HRV</span>
            </div>
          )}
          {healthToday.sleep_duration_minutes != null && (
            <div className="dash-vital">
              <Moon size={14} />
              <span className="dash-vital-val">{Math.floor(healthToday.sleep_duration_minutes / 60)}h{Math.round(healthToday.sleep_duration_minutes % 60)}m</span>
              <span className="dash-vital-label">Sleep</span>
            </div>
          )}
          {healthToday.weight != null && (
            <div className="dash-vital">
              <Scale size={14} />
              <span className="dash-vital-val">
                {healthToday.weight_unit === 'kg' ? (healthToday.weight * 2.20462).toFixed(0) : healthToday.weight}
              </span>
              <span className="dash-vital-label">lbs</span>
            </div>
          )}
          {rizeYesterday && (
            <div className="dash-vital">
              <Clock size={14} />
              <span className="dash-vital-val">
                {Math.floor(rizeYesterday.work_seconds / 3600)}h
                {String(Math.round((rizeYesterday.work_seconds % 3600) / 60)).padStart(2, '0')}m
              </span>
              <span className="dash-vital-label">yest. work</span>
            </div>
          )}
        </div>
      )}

      {/* Today's habits — quick checklist */}
      {habits.length > 0 && (
        <div className="dash-habits" onClick={() => navigate('/habits')}>
          <div className="dash-habits-head">
            <div className="dash-habits-title">
              <CheckSquare size={14} />
              <span>Today's Habits</span>
            </div>
            <span className="dash-habits-count">
              {habits.filter((h) => isCompleted(h.id, todayLocal)).length} / {habits.length}
            </span>
          </div>
          <div className="dash-habits-row">
            {habits.map((h) => {
              const done = isCompleted(h.id, todayLocal);
              return (
                <button
                  key={h.id}
                  className={`dash-habit-chip ${done ? 'dash-habit-chip--done' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggle(h.id, todayLocal); }}
                  title={h.name}
                >
                  <span className="dash-habit-chip-emoji">{h.emoji || '•'}</span>
                  <span className="dash-habit-chip-name">{h.name}</span>
                  {done && <span className="dash-habit-chip-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column overview */}
      <div className="dash-columns">
        {/* LEFT: Nutrition */}
        <div className="dash-col dash-col-nutrition" onClick={() => navigate('/nutrition')}>
          <div className="dash-col-header">
            <Utensils size={16} />
            <span>Nutrition</span>
          </div>

          {nutritionLoading ? (
            <div className="dash-col-loading">Loading...</div>
          ) : (
            <>
              <MiniCalorieRing consumed={dailySummary.total_calories} target={calorieTarget} />

              <div className="dash-macros">
                <MiniMacroBar label="Protein" icon={<Beef size={14} />} current={dailySummary.total_protein} target={proteinTarget} color="var(--protein-color)" />
                <MiniMacroBar label="Carbs" icon={<Wheat size={14} />} current={dailySummary.total_carbs} target={carbsTarget} color="var(--carbs-color)" />
                <MiniMacroBar label="Fat" icon={<Droplet size={14} />} current={dailySummary.total_fat} target={fatTarget} color="var(--fat-color)" />
              </div>

              {mealsLogged.length > 0 ? (
                <div className="dash-meals-logged">
                  {mealsLogged.map((mt) => (
                    <span key={mt} className="dash-meal-tag">{MEAL_LABELS[mt]}</span>
                  ))}
                </div>
              ) : (
                <div className="dash-col-empty">No meals logged yet</div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Workout */}
        <div
          className="dash-col dash-col-workout"
          onClick={() => todayTemplate ? navigate(`/workout/${todayTemplate.id}`) : navigate('/templates')}
        >
          <div className="dash-col-header">
            <Dumbbell size={16} />
            <span>Workout</span>
          </div>

          {todayTemplate ? (
            <>
              <div className="dash-workout-today">
                <div className="dash-workout-label">Today</div>
                <div className="dash-workout-name">{todayTemplate.name}</div>
              </div>
              <button
                className="btn btn-primary dash-start-btn"
                onClick={(e) => { e.stopPropagation(); navigate(`/workout/${todayTemplate.id}`); }}
              >
                <Play size={16} />
                Start
              </button>
            </>
          ) : (
            <div className="dash-rest-day">
              <div className="dash-rest-icon">😴</div>
              <div className="dash-workout-name">Rest Day</div>
              <div className="dash-rest-sub">No workout scheduled</div>
            </div>
          )}

          <div className="dash-workout-stats">
            <div className="dash-workout-stat">
              <span className="dash-workout-stat-val">{thisWeekCount}</span>
              <span className="dash-workout-stat-label">this week</span>
            </div>
            <div className="dash-workout-stat">
              <span className="dash-workout-stat-val">{sessions.length}</span>
              <span className="dash-workout-stat-label">total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Week schedule strip */}
      <div className="dash-week-strip">
        {weekPreview.map((day) => (
          <div key={day.day} className={`dash-week-day ${day.isToday ? 'dash-week-day--today' : ''} ${day.template ? '' : 'dash-week-day--rest'}`}>
            <span className="dash-week-day-name">{day.name}</span>
            <span className="dash-week-day-workout">{day.template ?? 'Rest'}</span>
          </div>
        ))}
      </div>

      {/* Recent Workouts */}
      {recentSessions.length > 0 && (
        <section className="section">
          <h3 className="section-title">Recent Workouts</h3>
          <div className="recent-list">
            {recentSessions.map((s) => (
              <div key={s.id} className="recent-item" onClick={() => navigate('/history')}>
                <div className="recent-item-name">{s.template_name || 'Custom Workout'}</div>
                <div className="recent-item-date">{format(new Date(s.completed_at), 'MMM d, h:mm a')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick start if no template for today but templates exist */}
      {!todayTemplate && templates.length > 0 && (
        <div className="quick-start">
          <p className="quick-start-label">Quick start a workout:</p>
          <div className="quick-start-buttons">
            {templates.map((t) => (
              <button key={t.id} className="btn btn-outline btn-small" onClick={() => navigate(`/workout/${t.id}`)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
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
