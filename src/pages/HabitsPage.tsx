import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Flame, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHabits, useHabitLogs, useHabitStats } from '../hooks/useHabits';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Habit } from '../types/database';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isSameMonth } from 'date-fns';

type ViewMode = 'week' | 'month';

// YYYY-MM-DD in local time (no UTC offset shenanigans)
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HabitsPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [anchorMonth, setAnchorMonth] = useState(() => new Date());
  const [anchorWeek, setAnchorWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Always fetch the visible month (covers both week and month views) plus a small buffer
  const monthStart = startOfMonth(anchorMonth);
  const monthEnd = endOfMonth(anchorMonth);
  // Extend a week on either side so week view never falls outside fetched range
  const fetchStart = ymd(addDays(monthStart, -7));
  const fetchEnd = ymd(addDays(monthEnd, 7));

  const { habits, loading: habitsLoading, createHabit, updateHabit, archiveHabit } = useHabits(user?.id);
  const { isCompleted, toggle, loading: logsLoading } = useHabitLogs(user?.id, fetchStart, fetchEnd);
  const { statsByHabit, dailyTotals } = useHabitStats(user?.id, habits, ymd(monthStart), ymd(monthEnd));

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const monthDays = useMemo(() => {
    const days: Date[] = [];
    let d = monthStart;
    while (d <= monthEnd) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [monthStart, monthEnd]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(anchorWeek, i));
  }, [anchorWeek]);

  // Aggregate this month for header
  const monthAgg = useMemo(() => {
    const totalGoal = habits.reduce((sum, h) => sum + h.goal_per_month, 0);
    const totalCompleted = habits.reduce((sum, h) => sum + (statsByHabit[h.id]?.total_completions ?? 0), 0);
    const pct = totalGoal > 0 ? (totalCompleted / totalGoal) * 100 : 0;
    return { totalGoal, totalCompleted, pct };
  }, [habits, statsByHabit]);

  // Daily completion chart data for the visible month
  const chartData = useMemo(() => {
    return monthDays.map((d) => ({
      date: d,
      pct: habits.length > 0
        ? Math.round(((dailyTotals[ymd(d)] ?? 0) / habits.length) * 100)
        : 0,
    }));
  }, [monthDays, dailyTotals, habits.length]);

  if (habitsLoading) return <LoadingSpinner message="Loading habits..." />;

  return (
    <div className="page">
      <AppHeader title="Habits" subtitle={format(anchorMonth, 'MMMM yyyy')} />

      {/* Month nav + view toggle */}
      <div className="habits-toolbar">
        <div className="habits-month-nav">
          <button className="icon-btn" onClick={() => setAnchorMonth(subMonths(anchorMonth, 1))}>
            <ChevronLeft size={18} />
          </button>
          <span className="habits-month-label">{format(anchorMonth, 'MMM yyyy')}</span>
          <button className="icon-btn" onClick={() => setAnchorMonth(addMonths(anchorMonth, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="habits-view-toggle">
          <button
            className={`view-btn ${viewMode === 'week' ? 'view-btn--active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            Week
          </button>
          <button
            className={`view-btn ${viewMode === 'month' ? 'view-btn--active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            Month
          </button>
        </div>
      </div>

      {/* Month progress summary card */}
      <div className="habits-summary-card">
        <div>
          <div className="habits-summary-label">This month</div>
          <div className="habits-summary-value">
            {monthAgg.totalCompleted}<span className="habits-summary-of">/{monthAgg.totalGoal}</span>
          </div>
        </div>
        <div className="habits-summary-pct">
          {monthAgg.pct.toFixed(1)}%
          <div className="habits-summary-track">
            <div className="habits-summary-fill" style={{ width: `${Math.min(monthAgg.pct, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {habits.length === 0 ? (
        <div className="empty-state">
          <h3>No habits yet</h3>
          <p>Add your first habit to start tracking.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Habit
          </button>
        </div>
      ) : viewMode === 'week' ? (
        <WeekGrid
          habits={habits}
          weekDays={weekDays}
          anchorWeek={anchorWeek}
          onPrevWeek={() => setAnchorWeek(subWeeks(anchorWeek, 1))}
          onNextWeek={() => setAnchorWeek(addWeeks(anchorWeek, 1))}
          isCompleted={isCompleted}
          onToggle={toggle}
          statsByHabit={statsByHabit}
          loading={logsLoading}
        />
      ) : (
        <MonthGrid
          habits={habits}
          monthDays={monthDays}
          isCompleted={isCompleted}
          onToggle={toggle}
          statsByHabit={statsByHabit}
        />
      )}

      {/* Daily completion chart */}
      {habits.length > 0 && (
        <section className="section">
          <h3 className="section-title">Daily completion</h3>
          <AreaChart data={chartData} highlightToday />
        </section>
      )}

      {/* Per-habit stat cards */}
      {habits.length > 0 && (
        <section className="section">
          <h3 className="section-title">Per habit</h3>
          <div className="habits-stats-grid">
            {habits.map((h) => {
              const s = statsByHabit[h.id];
              return (
                <div key={h.id} className="habit-stat-card">
                  <div className="habit-stat-head">
                    <div className="habit-stat-name">
                      {h.emoji && <span className="habit-emoji">{h.emoji}</span>} {h.name}
                    </div>
                    <button className="icon-btn icon-btn--sm" onClick={() => setEditingHabit(h)}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="habit-stat-nums">
                    <span className="habit-stat-big">{s?.total_completions ?? 0}</span>
                    <span className="habit-stat-of">/ {h.goal_per_month}</span>
                  </div>
                  <div className="habit-stat-track">
                    <div className="habit-stat-fill" style={{ width: `${Math.min(s?.consistency_pct ?? 0, 100)}%` }} />
                  </div>
                  <div className="habit-stat-meta">
                    <span><Flame size={12} /> {s?.current_streak ?? 0} current</span>
                    <span><TrendingUp size={12} /> {s?.longest_streak ?? 0} best</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Floating add button */}
      <button className="fab" onClick={() => setShowAddModal(true)} title="Add habit">
        <Plus size={22} />
      </button>

      {/* Add/edit modals */}
      {showAddModal && (
        <HabitModal
          onClose={() => setShowAddModal(false)}
          onSave={async (vals) => {
            await createHabit(vals);
            setShowAddModal(false);
          }}
        />
      )}
      {editingHabit && (
        <HabitModal
          habit={editingHabit}
          onClose={() => setEditingHabit(null)}
          onSave={async (vals) => {
            await updateHabit(editingHabit.id, vals);
            setEditingHabit(null);
          }}
          onDelete={async () => {
            await archiveHabit(editingHabit.id);
            setEditingHabit(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Week view
// ============================================
function WeekGrid({
  habits,
  weekDays,
  anchorWeek,
  onPrevWeek,
  onNextWeek,
  isCompleted,
  onToggle,
  statsByHabit,
  loading,
}: {
  habits: Habit[];
  weekDays: Date[];
  anchorWeek: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  isCompleted: (h: string, d: string) => boolean;
  onToggle: (h: string, d: string) => Promise<unknown>;
  statsByHabit: Record<string, { consistency_pct: number; total_completions: number; goal: number }>;
  loading: boolean;
}) {
  const today = new Date();
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return (
    <div className="habits-week">
      <div className="habits-week-nav">
        <button className="icon-btn" onClick={onPrevWeek}>
          <ChevronLeft size={16} />
        </button>
        <span className="habits-week-label">
          {format(anchorWeek, 'MMM d')} – {format(addDays(anchorWeek, 6), 'MMM d')}
        </span>
        <button className="icon-btn" onClick={onNextWeek}>
          <ChevronRight size={16} />
        </button>
      </div>

      <table className="habits-table">
        <thead>
          <tr>
            <th className="habits-th-name"></th>
            {weekDays.map((d, i) => (
              <th key={i} className={`habits-th-day ${isSameDay(d, today) ? 'habits-th-day--today' : ''}`}>
                <div className="habits-th-dow">{dayLabels[i]}</div>
                <div className="habits-th-date">{d.getDate()}</div>
              </th>
            ))}
            <th className="habits-th-pct">%</th>
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => {
            const stat = statsByHabit[h.id];
            return (
              <tr key={h.id}>
                <td className="habits-td-name">
                  {h.emoji && <span className="habit-emoji">{h.emoji}</span>}
                  <span className="habit-name-text">{h.name}</span>
                </td>
                {weekDays.map((d) => {
                  const ds = ymd(d);
                  const checked = isCompleted(h.id, ds);
                  return (
                    <td key={ds} className="habits-td-check">
                      <button
                        className={`habit-check ${checked ? 'habit-check--on' : ''}`}
                        onClick={() => onToggle(h.id, ds)}
                        disabled={loading}
                        aria-label={`${h.name} on ${ds}`}
                      >
                        {checked && '✓'}
                      </button>
                    </td>
                  );
                })}
                <td className="habits-td-pct">{stat?.consistency_pct ?? 0}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// Month view (Excel-style full grid, horizontal scroll)
// ============================================
function MonthGrid({
  habits,
  monthDays,
  isCompleted,
  onToggle,
  statsByHabit,
}: {
  habits: Habit[];
  monthDays: Date[];
  isCompleted: (h: string, d: string) => boolean;
  onToggle: (h: string, d: string) => Promise<unknown>;
  statsByHabit: Record<string, { consistency_pct: number; total_completions: number; goal: number }>;
}) {
  const today = new Date();
  const monthOfDays = monthDays[0] ? monthDays[0] : new Date();
  return (
    <div className="habits-month-wrap">
      <div className="habits-month-scroll">
        <table className="habits-table habits-table--month">
          <thead>
            <tr>
              <th className="habits-th-name habits-th-sticky"></th>
              {monthDays.map((d) => (
                <th
                  key={ymd(d)}
                  className={`habits-th-day-narrow ${isSameDay(d, today) ? 'habits-th-day--today' : ''} ${!isSameMonth(d, monthOfDays) ? 'habits-th-day--outside' : ''}`}
                >
                  {d.getDate()}
                </th>
              ))}
              <th className="habits-th-pct">%</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const stat = statsByHabit[h.id];
              return (
                <tr key={h.id}>
                  <td className="habits-td-name habits-td-sticky">
                    {h.emoji && <span className="habit-emoji">{h.emoji}</span>}
                    <span className="habit-name-text">{h.name}</span>
                  </td>
                  {monthDays.map((d) => {
                    const ds = ymd(d);
                    const checked = isCompleted(h.id, ds);
                    return (
                      <td key={ds} className="habits-td-check-narrow">
                        <button
                          className={`habit-check habit-check--sm ${checked ? 'habit-check--on' : ''}`}
                          onClick={() => onToggle(h.id, ds)}
                          aria-label={`${h.name} on ${ds}`}
                        >
                          {checked && '✓'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="habits-td-pct">{stat?.consistency_pct ?? 0}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Tiny SVG area chart (no chart library; matches the Excel green area look)
// ============================================
function AreaChart({ data, highlightToday }: { data: { date: Date; pct: number }[]; highlightToday?: boolean }) {
  const today = new Date();
  if (data.length === 0) return null;
  const w = 600;
  const h = 120;
  const padX = 8;
  const padY = 8;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const maxPct = 100;
  const stepX = innerW / Math.max(data.length - 1, 1);

  const pts = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (d.pct / maxPct) * innerH;
    return { x, y, d };
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${padY + innerH} L${pts[0].x},${padY + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="habits-chart">
      <defs>
        <linearGradient id="habits-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,197,94,0.6)" />
          <stop offset="100%" stopColor="rgba(34,197,94,0.05)" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#habits-area-grad)" />
      <path d={linePath} fill="none" stroke="rgba(34,197,94,0.9)" strokeWidth="1.5" />
      {highlightToday && pts.map((p) => (
        isSameDay(p.d.date, today) ? (
          <circle key={ymd(p.d.date)} cx={p.x} cy={p.y} r={3.5} fill="#22c55e" />
        ) : null
      ))}
    </svg>
  );
}

// ============================================
// Habit add/edit modal
// ============================================
function HabitModal({
  habit,
  onClose,
  onSave,
  onDelete,
}: {
  habit?: Habit;
  onClose: () => void;
  onSave: (vals: { name: string; emoji: string; goal_per_month: number }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(habit?.name ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? '');
  const [goal, setGoal] = useState(habit?.goal_per_month ?? 31);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), emoji: emoji.trim(), goal_per_month: goal });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{habit ? 'Edit habit' : 'New habit'}</h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="form-label">
            Emoji
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🧊"
              maxLength={4}
              className="input input--emoji"
            />
          </label>
          <label className="form-label">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cold shower"
              className="input"
              autoFocus
            />
          </label>
          <label className="form-label">
            Monthly goal
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(parseInt(e.target.value) || 0)}
              min={1}
              max={31}
              className="input"
            />
          </label>
        </div>
        <div className="modal-foot">
          {onDelete && (
            <button className="btn btn-danger-outline" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          )}
          <div className="modal-foot-right">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
