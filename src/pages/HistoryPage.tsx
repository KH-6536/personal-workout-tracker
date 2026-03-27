import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import type { WorkoutSet } from '../types/database';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

export default function HistoryPage() {
  const { user } = useAuth();
  const { sessions, loading, getSessionSets, getSessionsByDate, getDatesWithWorkouts } =
    useWorkoutHistory(user?.id);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSets, setSelectedSets] = useState<Record<string, WorkoutSet[]>>({});
  const [loadingSets, setLoadingSets] = useState(false);

  const workoutDates = getDatesWithWorkouts();
  const daySessions = getSessionsByDate(selectedDate);

  // Load sets for selected day's sessions
  useEffect(() => {
    if (daySessions.length === 0) {
      setSelectedSets({});
      return;
    }

    const loadSets = async () => {
      setLoadingSets(true);
      const result: Record<string, WorkoutSet[]> = {};
      for (const session of daySessions) {
        result[session.id] = await getSessionSets(session.id);
      }
      setSelectedSets(result);
      setLoadingSets(false);
    };

    loadSets();
  }, [selectedDate, sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner message="Loading history..." />;

  // Calendar rendering
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // Group sets by exercise for display
  const groupSetsByExercise = (sets: WorkoutSet[]) => {
    const groups: Record<string, WorkoutSet[]> = {};
    for (const set of sets) {
      if (!groups[set.exercise_name]) groups[set.exercise_name] = [];
      groups[set.exercise_name].push(set);
    }
    return Object.entries(groups);
  };

  return (
    <div className="page">
      <AppHeader title="History" />

      {/* Calendar */}
      <div className="calendar">
        <div className="calendar-nav">
          <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={20} />
          </button>
          <h3 className="calendar-month">{format(currentMonth, 'MMMM yyyy')}</h3>
          <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="calendar-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="calendar-day-header">{d}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const hasWorkout = workoutDates.has(dateStr);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={dateStr}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <span>{format(day, 'd')}</span>
                {hasWorkout && <div className="workout-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail */}
      <div className="day-detail">
        <h3 className="day-detail-title">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>

        {daySessions.length === 0 ? (
          <p className="no-workout-text">No workouts logged on this day.</p>
        ) : (
          daySessions.map((session) => (
            <div key={session.id} className="session-card">
              <div className="session-header">
                <h4>{session.template_name || 'Custom Workout'}</h4>
                <span className="session-time">
                  {format(new Date(session.completed_at), 'h:mm a')}
                </span>
              </div>

              {loadingSets ? (
                <p className="loading-text">Loading sets...</p>
              ) : (
                selectedSets[session.id] &&
                groupSetsByExercise(selectedSets[session.id]).map(([name, sets]) => (
                  <div key={name} className="history-exercise">
                    <h5 className="history-exercise-name">{name}</h5>
                    <div className="history-sets">
                      {sets.map((s) => (
                        <div key={s.id} className="history-set-row">
                          <span className="history-set-num">Set {s.set_number}</span>
                          <span className="history-set-data">
                            {s.weight ?? '-'} lbs x {s.reps ?? '-'} reps
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
