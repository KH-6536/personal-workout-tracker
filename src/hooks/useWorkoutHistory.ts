import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { WorkoutSession, WorkoutSet } from '../types/database';

export function useWorkoutHistory(userId: string | undefined) {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    if (error) console.error('Error fetching sessions:', error);
    else setSessions(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getSessionSets = useCallback(async (sessionId: string): Promise<WorkoutSet[]> => {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('exercise_name')
      .order('set_number');
    if (error) {
      console.error('Error fetching sets:', error);
      return [];
    }
    return data ?? [];
  }, []);

  const getSessionsByDate = useCallback(
    (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return sessions.filter((s) => s.completed_at.split('T')[0] === dateStr);
    },
    [sessions]
  );

  const getDatesWithWorkouts = useCallback(() => {
    const dates = new Set<string>();
    sessions.forEach((s) => dates.add(s.completed_at.split('T')[0]));
    return dates;
  }, [sessions]);

  return { sessions, loading, getSessionSets, getSessionsByDate, getDatesWithWorkouts, refetch: fetchSessions };
}

export function usePreviousSets(userId: string | undefined) {
  const getPreviousSets = useCallback(
    async (exerciseId: string): Promise<WorkoutSet[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, session:workout_sessions!inner(*)')
        .eq('exercise_id', exerciseId)
        .eq('session.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.error('Error fetching previous sets:', error);
        return [];
      }
      // Group by session, take the most recent session's sets
      if (!data || data.length === 0) return [];
      const mostRecentSessionId = data[0].session_id;
      return data
        .filter((s) => s.session_id === mostRecentSessionId)
        .sort((a, b) => a.set_number - b.set_number);
    },
    [userId]
  );

  return { getPreviousSets };
}
