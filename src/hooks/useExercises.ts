import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Exercise } from '../types/database';

export function useExercises(userId: string | undefined) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (error) {
      console.error('Error fetching exercises:', error);
    } else {
      setExercises(data ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const addExercise = useCallback(
    async (name: string, muscleGroup?: string) => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('exercises')
        .insert({ user_id: userId, name, muscle_group: muscleGroup || null })
        .select()
        .single();
      if (error) throw error;
      setExercises((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    },
    [userId]
  );

  const deleteExercise = useCallback(async (id: string) => {
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) throw error;
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { exercises, loading, addExercise, deleteExercise, refetch: fetchExercises };
}
