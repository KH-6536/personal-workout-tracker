import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Pencil, Trash2, Flame, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHabits, useHabitLogs, computeHabitStats } from '../hooks/useHabits';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Habit } from '../types/database';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isSameMonth } from 'date-fns';

type ViewMode = 'week' | 'month';

// YYYY-MM-DD in local time (matches what we write to habit_logs from the client)
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function HabitsPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // default = month per user request
  const [anchorMonth, setAnchorMonth] = useState(() => new Date());
  const [anchorWeek, setAnchorWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const monthStart = startOfMonth(anchorMonth);
  const monthEnd = endOfMonth(anchorMonth);
  const fetchStart = ymd(addDays(monthStart, -7));
  const fetchEnd = ymd(addDays(monthEnd, 7));

  const { habits, loading: habitsLoading, createHabit, updateHabit, archiveHabit, moveHabit, setHabitPosition } = useHabits(user?.id);
  const { logs, isCompleted, toggle, loading: logsLoading } = useHabitLogs(user?.id, fetchStart, fetchEnd);

  // Stats derive from the SAME logs state that toggle mutates → optimistic toggles
  // immediately reflect in stats, chart, and per-habit cards. (Fixes the "chart
  // doesn't update" and the earlier sync gap.)
  const { statsByHabit, dailyTotals } = useMemo(
    () => computeHabitStats(habits, logs, ymd(monthStart), ymd(monthEnd)),
    [habits, logs, monthStart, monthEnd]
  );

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

  // Chunk month into 7-day groups (matches the Excel "Week 1 / Week 2 / ..." layout)
  const monthWeeks = useMemo(() => {
    const chunks: Date[][] = [];
    for (let i = 0; i < monthDays.length; i += 7) {
      chunks.push(monthDays.slice(i, i + 7));
    }
    return chunks;
  }, [monthDays]);

  const todayYMD = ymd(new Date());
  const todayDone = habits.filter((h) => isCompleted(h.id, todayYMD)).length;

  // Daily completion chart data (visible month)
  const chartData = useMemo(() => {
    return monthDays.map((d) => ({
      date: d,
      done: dailyTotals[ymd(d)] ?? 0,
      total: habits.length,
      pct: habits.length > 0
        ? Math.round(((dailyTotals[ymd(d)] ?? 0) / habits.length) * 100)
        : 0,
    }));
  }, [monthDays, dailyTotals, habits.length]);

  if (habitsLoading) return <LoadingSpinner message="Loading habits..." />;

  return (
    <div className="page">
      <AppHeader title="Habits" subtitle={format(anchorMonth, 'MMMM yyyy')} />

      {/* Top toolbar: month nav + view toggle + add */}
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
        <div className="habits-toolbar-right">
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
          <button className="btn btn-primary btn-small" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Add Habit
          </button>
        </div>
      </div>

      {/* Daily completion card — REPLACES "This month".
          Big "X/Y" updates live when toggling; area chart shows the month. */}
      <DailyCompletionCard
        todayDone={todayDone}
        totalHabits={habits.length}
        chartData={chartData}
      />

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
        <MonthGridExcel
          habits={habits}
          monthWeeks={monthWeeks}
          monthOfDays={monthStart}
          isCompleted={isCompleted}
          onToggle={toggle}
          statsByHabit={statsByHabit}
        />
      )}

      {/* Per-habit stat cards */}
      {habits.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h3 className="section-title">Per habit</h3>
            <span className="section-hint">Use ↑↓ to reorder</span>
          </div>
          <div className="habits-stats-grid">
            {habits.map((h, i) => {
              const s = statsByHabit[h.id];
              const isFirst = i === 0;
              const isLast = i === habits.length - 1;
              return (
                <div key={h.id} className="habit-stat-card">
                  <div className="habit-stat-head">
                    <span className="habit-stat-position" title={`Position ${i + 1} of ${habits.length}`}>
                      {i + 1}
                    </span>
                    <div className="habit-stat-name">
                      {h.emoji && <span className="habit-emoji">{h.emoji}</span>} {h.name}
                    </div>
                    <div className="habit-stat-actions">
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => moveHabit(h.id, 'up')}
                        disabled={isFirst}
                        title="Move up"
                        aria-label={`Move ${h.name} up`}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        className="icon-btn icon-btn--sm"
                        onClick={() => moveHabit(h.id, 'down')}
                        disabled={isLast}
                        title="Move down"
                        aria-label={`Move ${h.name} down`}
                      >
                        <ChevronDown size={14} />
                      </button>
                      <button className="icon-btn icon-btn--sm" onClick={() => setEditingHabit(h)} title="Edit">
                        <Pencil size={14} />
                      </button>
                    </div>
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

      {/* Floating add button — still here for fast access when scrolled */}
      <button className="fab" onClick={() => setShowAddModal(true)} title="Add habit">
        <Plus size={22} />
      </button>

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
          totalHabits={habits.length}
          currentPosition={habits.findIndex((h) => h.id === editingHabit.id) + 1}
          onClose={() => setEditingHabit(null)}
          onSave={async (vals, newPosition) => {
            await updateHabit(editingHabit.id, vals);
            const currentIdx = habits.findIndex((h) => h.id === editingHabit.id);
            // newPosition is 1-based; convert to 0-based index
            if (newPosition != null && newPosition - 1 !== currentIdx) {
              await setHabitPosition(editingHabit.id, newPosition - 1);
            }
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
// Daily completion card — sits at the top.
// Shows today's "X / Y" prominently + monthly area chart + per-day "X/Y" tooltip on tap.
// ============================================
function DailyCompletionCard({
  todayDone,
  totalHabits,
  chartData,
}: {
  todayDone: number;
  totalHabits: number;
  chartData: { date: Date; done: number; total: number; pct: number }[];
}) {
  const pct = totalHabits > 0 ? Math.round((todayDone / totalHabits) * 100) : 0;
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hovered = hoveredIdx != null ? chartData[hoveredIdx] : null;

  return (
    <div className="daily-completion-card">
      <div className="dc-head">
        <div>
          <div className="dc-label">Today's Completion</div>
          <div className="dc-fraction">
            <span className="dc-num">{hovered ? hovered.done : todayDone}</span>
            <span className="dc-slash">/</span>
            <span className="dc-denom">{hovered ? hovered.total : totalHabits}</span>
          </div>
          {hovered && (
            <div className="dc-date-tag">{format(hovered.date, 'MMM d')}</div>
          )}
        </div>
        <div className="dc-pct">{(hovered ? hovered.pct : pct).toFixed(0)}%</div>
      </div>
      <div className="dc-track">
        <div className="dc-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <AreaChart
        data={chartData}
        highlightToday
        onHover={setHoveredIdx}
      />
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
                <div className="habits-th-dow">{DAY_LABELS[i]}</div>
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
// Month view — Excel-style: weeks side-by-side, day-of-week + date labels,
// "Goal / Actual / Progress" analysis on the right. Wider than the page —
// horizontal scroll on smaller viewports, full bleed on larger ones.
// ============================================
function MonthGridExcel({
  habits,
  monthWeeks,
  monthOfDays,
  isCompleted,
  onToggle,
  statsByHabit,
}: {
  habits: Habit[];
  monthWeeks: Date[][];
  monthOfDays: Date;
  isCompleted: (h: string, d: string) => boolean;
  onToggle: (h: string, d: string) => Promise<unknown>;
  statsByHabit: Record<string, { consistency_pct: number; total_completions: number; goal: number }>;
}) {
  const today = new Date();
  // Total days across all chunks (used for analysis right-edge separators)
  return (
    <div className="habits-excel-wrap">
      <div className="habits-excel-scroll">
        <table className="habits-excel-table">
          <thead>
            {/* Row 1: Week N labels spanning 7 cells, plus Analysis spanning 3 */}
            <tr className="excel-row-weeks">
              <th className="excel-th-habits" rowSpan={3}>My Habits</th>
              {monthWeeks.map((week, wi) => (
                <th key={`w-${wi}`} className="excel-th-week" colSpan={week.length}>
                  Week {wi + 1}
                </th>
              ))}
              <th className="excel-th-analysis" colSpan={3}>Analysis</th>
            </tr>
            {/* Row 2: day-of-week labels per actual date */}
            <tr className="excel-row-dow">
              {monthWeeks.map((week, wi) =>
                week.map((d, di) => (
                  <th
                    key={`dow-${wi}-${di}`}
                    className={`excel-th-dow ${isSameDay(d, today) ? 'excel-cell--today' : ''} ${!isSameMonth(d, monthOfDays) ? 'excel-cell--outside' : ''} ${di === 0 ? 'excel-cell--week-start' : ''}`}
                  >
                    {DAY_LABELS[d.getDay()]}
                  </th>
                ))
              )}
              <th className="excel-th-subhead">Goal</th>
              <th className="excel-th-subhead">Actual</th>
              <th className="excel-th-subhead">Progress</th>
            </tr>
            {/* Row 3: date numbers */}
            <tr className="excel-row-dates">
              {monthWeeks.map((week, wi) =>
                week.map((d, di) => (
                  <th
                    key={`date-${wi}-${di}`}
                    className={`excel-th-date ${isSameDay(d, today) ? 'excel-cell--today' : ''} ${!isSameMonth(d, monthOfDays) ? 'excel-cell--outside' : ''} ${di === 0 ? 'excel-cell--week-start' : ''}`}
                  >
                    {d.getDate()}
                  </th>
                ))
              )}
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const stat = statsByHabit[h.id];
              return (
                <tr key={h.id}>
                  <td className="excel-td-habits">
                    {h.emoji && <span className="habit-emoji">{h.emoji}</span>}
                    <span className="habit-name-text">{h.name}</span>
                  </td>
                  {monthWeeks.map((week, wi) =>
                    week.map((d, di) => {
                      const ds = ymd(d);
                      const checked = isCompleted(h.id, ds);
                      return (
                        <td
                          key={`c-${wi}-${di}`}
                          className={`excel-td-check ${di === 0 ? 'excel-cell--week-start' : ''} ${!isSameMonth(d, monthOfDays) ? 'excel-cell--outside' : ''}`}
                        >
                          <button
                            className={`habit-check habit-check--md ${checked ? 'habit-check--on' : ''}`}
                            onClick={() => onToggle(h.id, ds)}
                            aria-label={`${h.name} on ${ds}`}
                          >
                            {checked && '✓'}
                          </button>
                        </td>
                      );
                    })
                  )}
                  <td className="excel-td-analysis excel-td-goal">{h.goal_per_month}</td>
                  <td className="excel-td-analysis excel-td-actual">{stat?.total_completions ?? 0}</td>
                  <td className="excel-td-analysis excel-td-progress">
                    <div className="excel-progress-track">
                      <div
                        className="excel-progress-fill"
                        style={{ width: `${Math.min(stat?.consistency_pct ?? 0, 100)}%` }}
                      />
                    </div>
                  </td>
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
// Tiny SVG area chart with optional hover callback
// ============================================
function AreaChart({
  data,
  highlightToday,
  onHover,
}: {
  data: { date: Date; pct: number }[];
  highlightToday?: boolean;
  onHover?: (idx: number | null) => void;
}) {
  const today = new Date();
  if (data.length === 0) return null;
  const w = 600;
  const h = 100;
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

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onHover) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
    onHover(idx);
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="habits-chart"
      onMouseMove={handleMove}
      onMouseLeave={() => onHover?.(null)}
    >
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
  totalHabits,
  currentPosition,
  onClose,
  onSave,
  onDelete,
}: {
  habit?: Habit;
  totalHabits?: number;
  currentPosition?: number;
  onClose: () => void;
  onSave: (vals: { name: string; emoji: string; goal_per_month: number }, newPosition?: number) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(habit?.name ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? '');
  const [goal, setGoal] = useState(habit?.goal_per_month ?? 31);
  const [position, setPosition] = useState(currentPosition ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(
      { name: name.trim(), emoji: emoji.trim(), goal_per_month: goal },
      habit ? position : undefined,
    );
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
          {habit && totalHabits != null && totalHabits > 1 && (
            <label className="form-label">
              Position <span className="form-hint">(1 = top of list)</span>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value) || 1)}
                min={1}
                max={totalHabits}
                className="input"
              />
            </label>
          )}
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
