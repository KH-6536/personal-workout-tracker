import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { NutritionGoals, FoodLog, MealType, DailyNutritionSummary } from '../types/database';

export function useNutritionGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('nutrition_goals')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setGoals(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const updateGoals = useCallback(async (updates: {
    calorie_target: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }) => {
    if (!userId) return;
    // Upsert without .single() — RLS sometimes blocks the SELECT-after-upsert
    // when the INSERT path runs, returning no rows and erroring out of .single().
    // We refetch to get the canonical row instead.
    const { error } = await supabase
      .from('nutrition_goals')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) {
      console.error('[nutrition goals] save failed:', error);
      return { error };
    }
    // Refetch from source of truth so UI matches DB exactly.
    await fetchGoals();
    return { error: null };
  }, [userId, fetchGoals]);

  return { goals, loading, updateGoals, refetch: fetchGoals };
}

export function useFoodLogs(userId: string | undefined, date: string) {
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true });
    setLogs(data ?? []);
    setLoading(false);
  }, [userId, date]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const dailySummary = useMemo((): DailyNutritionSummary => {
    const meals: Record<MealType, FoodLog[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    let total_calories = 0;
    let total_protein = 0;
    let total_carbs = 0;
    let total_fat = 0;

    for (const log of logs) {
      meals[log.meal_type].push(log);
      total_calories += log.calories ?? 0;
      total_protein += log.protein_g ?? 0;
      total_carbs += log.carbs_g ?? 0;
      total_fat += log.fat_g ?? 0;
    }

    return { date, total_calories, total_protein, total_carbs, total_fat, meals };
  }, [logs, date]);

  const addFoodLogs = useCallback(async (items: Omit<FoodLog, 'id' | 'user_id' | 'created_at'>[]) => {
    if (!userId) return;
    const rows = items.map((item) => ({
      ...item,
      user_id: userId,
    }));
    const { error } = await supabase.from('food_logs').insert(rows);
    if (!error) {
      await fetchLogs();
    }
    return { error };
  }, [userId, fetchLogs]);

  const deleteFoodLog = useCallback(async (id: string) => {
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    if (!error) {
      setLogs((prev) => prev.filter((l) => l.id !== id));
    }
    return { error };
  }, []);

  return { logs, loading, dailySummary, addFoodLogs, deleteFoodLog, refetch: fetchLogs };
}

export function useNutritionAnalytics(userId: string | undefined, days: number) {
  const [dailyTotals, setDailyTotals] = useState<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>([]);
  const [weightData, setWeightData] = useState<{ date: string; weight: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [foodRes, weightRes] = await Promise.all([
      supabase
        .from('food_logs')
        .select('date, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true }),
      supabase
        .from('health_metrics')
        .select('date, weight, weight_unit')
        .eq('user_id', userId)
        .gte('date', startStr)
        .lte('date', endStr)
        .not('weight', 'is', null)
        .order('date', { ascending: true }),
    ]);

    // Aggregate food logs by date
    const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
    for (const row of foodRes.data ?? []) {
      if (!byDate[row.date]) {
        byDate[row.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      byDate[row.date].calories += row.calories ?? 0;
      byDate[row.date].protein += row.protein_g ?? 0;
      byDate[row.date].carbs += row.carbs_g ?? 0;
      byDate[row.date].fat += row.fat_g ?? 0;
    }

    setDailyTotals(
      Object.entries(byDate)
        .map(([date, totals]) => ({ date, ...totals }))
        .sort((a, b) => a.date.localeCompare(b.date))
    );

    setWeightData(
      (weightRes.data ?? []).map((w) => ({
        date: w.date,
        weight: w.weight_unit === 'kg' ? w.weight * 2.20462 : w.weight,
      }))
    );

    setLoading(false);
  }, [userId, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weeklyAvg = useMemo(() => {
    if (dailyTotals.length === 0) return null;
    const total = dailyTotals.reduce((sum, d) => sum + d.calories, 0);
    return {
      avgCalories: Math.round(total / dailyTotals.length),
      avgProtein: Math.round(dailyTotals.reduce((s, d) => s + d.protein, 0) / dailyTotals.length),
      avgCarbs: Math.round(dailyTotals.reduce((s, d) => s + d.carbs, 0) / dailyTotals.length),
      avgFat: Math.round(dailyTotals.reduce((s, d) => s + d.fat, 0) / dailyTotals.length),
      totalDays: dailyTotals.length,
    };
  }, [dailyTotals]);

  return { dailyTotals, weightData, weeklyAvg, loading, refetch: fetchData };
}
