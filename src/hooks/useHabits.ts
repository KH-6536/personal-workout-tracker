import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Habit, HabitLog, HabitStats, RizeDaily, RizeConnectionStatus } from '../types/database';

// ============================================
// useHabits — list/create/update/archive/reorder
// ============================================
export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('display_order', { ascending: true });
    if (error) console.error('Error fetching habits:', error);
    else setHabits(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const createHabit = useCallback(async (input: { name: string; emoji?: string; goal_per_month?: number }) => {
    if (!userId) return;
    const display_order = habits.length;
    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: userId,
        name: input.name,
        emoji: input.emoji ?? null,
        goal_per_month: input.goal_per_month ?? 31,
        display_order,
      })
      .select()
      .single();
    if (!error && data) setHabits((prev) => [...prev, data]);
    return { data, error };
  }, [userId, habits.length]);

  const updateHabit = useCallback(async (id: string, updates: Partial<Pick<Habit, 'name' | 'emoji' | 'goal_per_month' | 'display_order'>>) => {
    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      setHabits((prev) => prev.map((h) => (h.id === id ? data : h)));
    }
    return { data, error };
  }, []);

  const archiveHabit = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('habits')
      .update({ archived: true })
      .eq('id', id);
    if (!error) {
      setHabits((prev) => prev.filter((h) => h.id !== id));
    }
    return { error };
  }, []);

  const reorderHabits = useCallback(async (orderedIds: string[]) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from('habits').update({ display_order: i }).eq('id', id)
    );
    await Promise.all(updates);
    setHabits((prev) =>
      [...prev].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id))
    );
  }, []);

  // Swap a habit one slot up or down. Optimistic — flips local order first,
  // then persists both affected display_order values.
  const moveHabit = useCallback(async (habitId: string, direction: 'up' | 'down') => {
    const idx = habits.findIndex((h) => h.id === habitId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= habits.length) return;

    const a = habits[idx];
    const b = habits[swapIdx];

    // Optimistic local swap
    setHabits((prev) => {
      const next = [...prev];
      next[idx] = { ...b, display_order: a.display_order };
      next[swapIdx] = { ...a, display_order: b.display_order };
      return next;
    });

    // Persist (parallel — they're independent rows)
    const [r1, r2] = await Promise.all([
      supabase.from('habits').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('habits').update({ display_order: a.display_order }).eq('id', b.id),
    ]);
    if (r1.error || r2.error) {
      console.error('[habit reorder] persist failed:', r1.error || r2.error);
      // Rollback by refetching from source of truth
      await fetchHabits();
    }
  }, [habits, fetchHabits]);

  // Move a habit to an absolute 0-based position. Used by the modal's
  // "Position" input ("show this habit 1st / 2nd / ...").
  const setHabitPosition = useCallback(async (habitId: string, newIndex: number) => {
    const currentIdx = habits.findIndex((h) => h.id === habitId);
    if (currentIdx < 0) return;
    const clamped = Math.max(0, Math.min(habits.length - 1, newIndex));
    if (clamped === currentIdx) return;

    const reordered = [...habits];
    const [moving] = reordered.splice(currentIdx, 1);
    reordered.splice(clamped, 0, moving);
    await reorderHabits(reordered.map((h) => h.id));
  }, [habits, reorderHabits]);

  return {
    habits,
    loading,
    createHabit,
    updateHabit,
    archiveHabit,
    reorderHabits,
    moveHabit,
    setHabitPosition,
    refetch: fetchHabits,
  };
}

// ============================================
// useHabitLogs — fetch logs for date range + toggle
// ============================================
export function useHabitLogs(userId: string | undefined, startDate: string, endDate: string) {
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('habit_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .lte('log_date', endDate);
    if (error) console.error('Error fetching habit logs:', error);
    else setLogs(data ?? []);
    setLoading(false);
  }, [userId, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Map for O(1) lookup
  const logSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) s.add(`${l.habit_id}|${l.log_date}`);
    return s;
  }, [logs]);

  const isCompleted = useCallback(
    (habitId: string, date: string) => logSet.has(`${habitId}|${date}`),
    [logSet]
  );

  // Toggle a habit completion for a date.
  // Optimistic — flips local state immediately, rolls back on error.
  // Duplicate-key on insert is treated as success (row already exists, no rollback).
  const toggle = useCallback(async (habitId: string, date: string) => {
    if (!userId) return;
    const key = `${habitId}|${date}`;
    const wasCompleted = logSet.has(key);

    // Optimistic update
    if (wasCompleted) {
      setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.log_date === date)));
    } else {
      setLogs((prev) => [
        ...prev,
        { habit_id: habitId, user_id: userId, log_date: date, created_at: new Date().toISOString() },
      ]);
    }

    if (wasCompleted) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('log_date', date);
      if (error) {
        console.error('[habit toggle] delete failed:', error);
        // Rollback
        setLogs((prev) => [
          ...prev,
          { habit_id: habitId, user_id: userId, log_date: date, created_at: new Date().toISOString() },
        ]);
        return { error };
      }
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({ habit_id: habitId, user_id: userId, log_date: date });
      if (error) {
        // 23505 = duplicate key — row already exists, optimistic state is correct
        const code = (error as { code?: string }).code;
        if (code === '23505') return { error: null };
        console.error('[habit toggle] insert failed:', error);
        // Rollback
        setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.log_date === date)));
        return { error };
      }
    }
    return { error: null };
  }, [userId, logSet]);

  return { logs, loading, isCompleted, toggle, refetch: fetchLogs };
}

// ============================================
// computeHabitStats — pure helper. Use with logs from useHabitLogs so stats
// stay in sync with optimistic toggles.
// ============================================
export function computeHabitStats(
  habits: Habit[],
  logs: HabitLog[],
  windowStart: string,
  windowEnd: string,
): { statsByHabit: Record<string, HabitStats>; dailyTotals: Record<string, number> } {
  // Filter to window
  const inRange = logs.filter((l) => l.log_date >= windowStart && l.log_date <= windowEnd);

  const byHabit: Record<string, string[]> = {};
  for (const h of habits) byHabit[h.id] = [];
  for (const l of inRange) {
    if (byHabit[l.habit_id]) byHabit[l.habit_id].push(l.log_date);
  }

  const todayPT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const yesterdayPT = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  })();

  const statsByHabit: Record<string, HabitStats> = {};
  for (const h of habits) {
    const dates = (byHabit[h.id] ?? []).sort();
    const total_completions = dates.length;
    const goal = h.goal_per_month;
    const consistency_pct = goal > 0 ? Math.round((total_completions / goal) * 100) : 0;

    let longest_streak = 0;
    let runLen = 0;
    let prevDate: string | null = null;
    for (const d of dates) {
      if (prevDate === null) runLen = 1;
      else {
        const prev = new Date(prevDate);
        const cur = new Date(d);
        const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
        runLen = diffDays === 1 ? runLen + 1 : 1;
      }
      longest_streak = Math.max(longest_streak, runLen);
      prevDate = d;
    }

    const last_completed_date = dates.length ? dates[dates.length - 1] : null;
    let current_streak = 0;
    if (last_completed_date && (last_completed_date === todayPT || last_completed_date === yesterdayPT)) {
      current_streak = runLen;
    }

    statsByHabit[h.id] = {
      habit_id: h.id,
      total_completions,
      goal,
      consistency_pct,
      current_streak,
      longest_streak,
      last_completed_date,
    };
  }

  const dailyTotals: Record<string, number> = {};
  for (const l of inRange) {
    dailyTotals[l.log_date] = (dailyTotals[l.log_date] ?? 0) + 1;
  }

  return { statsByHabit, dailyTotals };
}

// ============================================
// useRizeDaily — fetch rize_daily rows
// ============================================
export function useRizeDaily(userId: string | undefined, startDate: string, endDate: string) {
  const [rows, setRows] = useState<RizeDaily[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('rize_daily')
      .select('*')
      .eq('user_id', userId)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: false });
    if (error) console.error('Error fetching rize daily:', error);
    else setRows(data ?? []);
    setLoading(false);
  }, [userId, startDate, endDate]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const getDate = useCallback(
    (date: string) => rows.find((r) => r.log_date === date) ?? null,
    [rows]
  );

  return { rows, loading, getDate, refetch: fetchRows };
}

// ============================================
// useRizeConnection — read-only status (api_key never reaches the client)
// ============================================
export function useRizeConnection(userId: string | undefined) {
  const [connection, setConnection] = useState<RizeConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('rize_connection_status')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('Error fetching rize connection:', error);
    else setConnection(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { connection, isConnected: connection !== null, loading, refetch: fetch };
}
