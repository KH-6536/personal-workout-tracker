import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SplitTemplate, TemplateExercise } from '../types/database';

export function useTemplates(userId: string | undefined) {
  const [templates, setTemplates] = useState<SplitTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('split_templates')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    if (error) console.error('Error fetching templates:', error);
    else setTemplates(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (name: string) => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('split_templates')
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (error) throw error;
      setTemplates((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      return data;
    },
    [userId]
  );

  const updateTemplate = useCallback(async (id: string, name: string) => {
    const { error } = await supabase
      .from('split_templates')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('split_templates').delete().eq('id', id);
    if (error) throw error;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, refetch: fetchTemplates };
}

export function useTemplateExercises(templateId: string | undefined) {
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplateExercises = useCallback(async () => {
    if (!templateId) {
      setTemplateExercises([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('template_exercises')
      .select('*, exercise:exercises(*)')
      .eq('template_id', templateId)
      .order('sort_order');
    if (error) console.error('Error fetching template exercises:', error);
    else setTemplateExercises(data ?? []);
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    fetchTemplateExercises();
  }, [fetchTemplateExercises]);

  const addExerciseToTemplate = useCallback(
    async (exerciseId: string, sortOrder: number, defaultSets: number = 3) => {
      if (!templateId) return;
      const { data, error } = await supabase
        .from('template_exercises')
        .insert({
          template_id: templateId,
          exercise_id: exerciseId,
          sort_order: sortOrder,
          default_sets: defaultSets,
        })
        .select('*, exercise:exercises(*)')
        .single();
      if (error) throw error;
      setTemplateExercises((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
    },
    [templateId]
  );

  const removeExerciseFromTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('template_exercises').delete().eq('id', id);
    if (error) throw error;
    setTemplateExercises((prev) => prev.filter((te) => te.id !== id));
  }, []);

  const updateSortOrder = useCallback(async (id: string, sortOrder: number) => {
    const { error } = await supabase
      .from('template_exercises')
      .update({ sort_order: sortOrder })
      .eq('id', id);
    if (error) throw error;
    setTemplateExercises((prev) =>
      prev
        .map((te) => (te.id === id ? { ...te, sort_order: sortOrder } : te))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  }, []);

  const updateDefaultSets = useCallback(async (id: string, defaultSets: number) => {
    if (defaultSets < 1) return;
    const { error } = await supabase
      .from('template_exercises')
      .update({ default_sets: defaultSets })
      .eq('id', id);
    if (error) throw error;
    setTemplateExercises((prev) =>
      prev.map((te) => (te.id === id ? { ...te, default_sets: defaultSets } : te))
    );
  }, []);

  const swapExercises = useCallback(async (indexA: number, indexB: number) => {
    setTemplateExercises((prev) => {
      if (indexA < 0 || indexB < 0 || indexA >= prev.length || indexB >= prev.length) return prev;
      const a = prev[indexA];
      const b = prev[indexB];
      // Swap sort_order values in DB
      Promise.all([
        supabase.from('template_exercises').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('template_exercises').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
      // Swap locally
      const next = [...prev];
      const tempOrder = a.sort_order;
      next[indexA] = { ...a, sort_order: b.sort_order };
      next[indexB] = { ...b, sort_order: tempOrder };
      return next.sort((x, y) => x.sort_order - y.sort_order);
    });
  }, []);

  return {
    templateExercises,
    loading,
    addExerciseToTemplate,
    removeExerciseFromTemplate,
    updateSortOrder,
    updateDefaultSets,
    swapExercises,
    refetch: fetchTemplateExercises,
  };
}
