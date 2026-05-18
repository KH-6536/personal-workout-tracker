import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CustomFood, FoodLog } from '../types/database';

export function useCustomFoods(userId: string | undefined) {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFoods = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .eq('user_id', userId)
      .order('last_used_at', { ascending: false })
      .limit(20);
    setFoods(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchFoods(); }, [fetchFoods]);

  const addCustomFood = useCallback(async (food: Omit<CustomFood, 'id' | 'user_id' | 'use_count' | 'last_used_at' | 'created_at'>) => {
    if (!userId) return;
    const { error } = await supabase
      .from('custom_foods')
      .insert({ ...food, user_id: userId });
    if (!error) await fetchFoods();
    return { error };
  }, [userId, fetchFoods]);

  const deleteCustomFood = useCallback(async (id: string) => {
    const { error } = await supabase.from('custom_foods').delete().eq('id', id);
    if (!error) setFoods((prev) => prev.filter((f) => f.id !== id));
    return { error };
  }, []);

  const bumpUsage = useCallback(async (id: string) => {
    const current = foods.find((f) => f.id === id);
    await supabase
      .from('custom_foods')
      .update({
        use_count: (current?.use_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id);
  }, [foods]);

  return { foods, loading, addCustomFood, deleteCustomFood, bumpUsage, refetch: fetchFoods };
}

/** Derive recently logged unique foods from food_logs (last 30 days) */
export function useRecentFoods(userId: string | undefined) {
  const [recentFoods, setRecentFoods] = useState<Pick<FoodLog, 'food_name' | 'serving_description' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg' | 'micronutrients'>[]>([]);

  const fetchRecent = useCallback(async () => {
    if (!userId) return;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from('food_logs')
      .select('food_name, serving_description, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, micronutrients, created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (!data) return;

    // Deduplicate by food_name, keep most recent
    const seen = new Map<string, typeof recentFoods[number]>();
    for (const row of data) {
      const key = row.food_name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, {
          food_name: row.food_name,
          serving_description: row.serving_description,
          calories: row.calories,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          fiber_g: row.fiber_g,
          sugar_g: row.sugar_g,
          sodium_mg: row.sodium_mg,
          micronutrients: row.micronutrients ?? {},
        });
      }
    }
    setRecentFoods(Array.from(seen.values()).slice(0, 15));
  }, [userId]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  return { recentFoods, refetch: fetchRecent };
}
