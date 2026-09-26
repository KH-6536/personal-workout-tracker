import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { BlockCategory, TimeBlock, TimeBlockWithCategory } from '../types/database';

// Category names are stored lowercase-trimmed so "Workout" and "workout" collapse.
export function normalizeCategoryName(raw: string): string {
  return raw.trim().toLowerCase();
}

// A rotating palette used when auto-creating a category — the user can change it later.
const PALETTE = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
];

function paletteColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

// Guess a sensible lucide icon from the title/category. Falls back to Circle.
export function iconForTitle(text: string): string {
  const s = text.toLowerCase();
  if (/(gym|workout|lift|exercise|cardio|run)/.test(s)) return 'Dumbbell';
  if (/(deep work|focus|coding|code|write|writing|study)/.test(s)) return 'Brain';
  if (/(meeting|call|standup|1:1|zoom)/.test(s)) return 'Phone';
  if (/(lunch|breakfast|dinner|eat|meal|food)/.test(s)) return 'Utensils';
  if (/(sleep|rest|nap|bed)/.test(s)) return 'Moon';
  if (/(read|book)/.test(s)) return 'BookOpen';
  if (/(walk|stroll|outside)/.test(s)) return 'Footprints';
  if (/(break|coffee|tea)/.test(s)) return 'Coffee';
  if (/(email|inbox)/.test(s)) return 'Mail';
  if (/(plan|review|journal|reflect)/.test(s)) return 'NotebookPen';
  return 'Circle';
}

/**
 * useTimeBlocks — blocks + categories for a single date, with optimistic writes.
 * Categories are shared across all dates; blocks are scoped to `date`.
 */
export function useTimeBlocks(userId: string | undefined, date: string) {
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [categories, setCategories] = useState<BlockCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [blocksRes, catsRes] = await Promise.all([
      supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('block_date', date)
        .order('start_time', { ascending: true }),
      supabase
        .from('block_categories')
        .select('*')
        .eq('user_id', userId),
    ]);
    if (blocksRes.error) console.error('[schedule] blocks fetch failed:', blocksRes.error);
    else setBlocks(blocksRes.data ?? []);
    if (catsRes.error) console.error('[schedule] categories fetch failed:', catsRes.error);
    else setCategories(catsRes.data ?? []);
    setLoading(false);
  }, [userId, date]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const categoryByName = useMemo(() => {
    const m = new Map<string, BlockCategory>();
    for (const c of categories) m.set(c.name, c);
    return m;
  }, [categories]);

  const blocksWithCategory = useMemo<TimeBlockWithCategory[]>(
    () => blocks.map((b) => ({
      ...b,
      category: b.category_name ? categoryByName.get(b.category_name) ?? null : null,
    })),
    [blocks, categoryByName],
  );

  // Ensure a category row exists for `name`. If missing, creates one with a
  // palette color + guessed icon. Returns the resulting BlockCategory.
  const ensureCategory = useCallback(
    async (rawName: string): Promise<BlockCategory | null> => {
      if (!userId) return null;
      const name = normalizeCategoryName(rawName);
      if (!name) return null;
      const existing = categoryByName.get(name);
      if (existing) return existing;

      const { data, error } = await supabase
        .from('block_categories')
        .insert({
          user_id: userId,
          name,
          color: paletteColorFor(name),
          icon: iconForTitle(name),
        })
        .select()
        .single();
      if (error) {
        // 23505 = another concurrent insert already created it; refetch that row.
        const code = (error as { code?: string }).code;
        if (code === '23505') {
          const { data: existingRow } = await supabase
            .from('block_categories')
            .select('*')
            .eq('user_id', userId)
            .eq('name', name)
            .maybeSingle();
          if (existingRow) {
            setCategories((prev) => [...prev.filter((c) => c.name !== name), existingRow]);
            return existingRow;
          }
        }
        console.error('[schedule] ensureCategory failed:', error);
        return null;
      }
      setCategories((prev) => [...prev, data]);
      return data;
    },
    [userId, categoryByName],
  );

  const createBlock = useCallback(
    async (input: {
      start_time: string;
      end_time: string;
      title: string;
      category_name?: string | null;
      notes?: string | null;
    }) => {
      if (!userId) return { error: new Error('no user') };
      const catName = input.category_name
        ? normalizeCategoryName(input.category_name)
        : normalizeCategoryName(input.title);
      if (catName) await ensureCategory(catName);

      const { data, error } = await supabase
        .from('time_blocks')
        .insert({
          user_id: userId,
          block_date: date,
          start_time: input.start_time,
          end_time: input.end_time,
          title: input.title,
          category_name: catName || null,
          notes: input.notes ?? null,
          source: 'manual',
        })
        .select()
        .single();
      if (error) {
        console.error('[schedule] createBlock failed:', error);
        return { error };
      }
      setBlocks((prev) => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)));
      return { data, error: null };
    },
    [userId, date, ensureCategory],
  );

  const updateBlock = useCallback(
    async (id: string, updates: Partial<Pick<TimeBlock, 'title' | 'start_time' | 'end_time' | 'category_name' | 'notes'>>) => {
      const patch = { ...updates };
      if (patch.category_name !== undefined) {
        const n = patch.category_name ? normalizeCategoryName(patch.category_name) : null;
        patch.category_name = n;
        if (n) await ensureCategory(n);
      }
      // Optimistic
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
      const { data, error } = await supabase
        .from('time_blocks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('[schedule] updateBlock failed:', error);
        await fetchAll();
        return { error };
      }
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? data : b))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
      return { data, error: null };
    },
    [ensureCategory, fetchAll],
  );

  const deleteBlock = useCallback(async (id: string) => {
    const prev = blocks;
    setBlocks((p) => p.filter((b) => b.id !== id));
    const { error } = await supabase.from('time_blocks').delete().eq('id', id);
    if (error) {
      console.error('[schedule] deleteBlock failed:', error);
      setBlocks(prev);
    }
    return { error };
  }, [blocks]);

  // Toggle completion: optimistic. Sets/clears completed_at to now.
  const toggleComplete = useCallback(async (id: string) => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    const now = new Date().toISOString();
    const nextCompleted = block.completed_at ? null : now;

    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, completed_at: nextCompleted } : b))
    );

    const { error } = await supabase
      .from('time_blocks')
      .update({ completed_at: nextCompleted })
      .eq('id', id);
    if (error) {
      console.error('[schedule] toggleComplete failed:', error);
      setBlocks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, completed_at: block.completed_at } : b))
      );
    }
  }, [blocks]);

  // Update a category — the color/icon change flows to every block that
  // references it because rendering joins by name.
  const updateCategory = useCallback(
    async (id: string, updates: Partial<Pick<BlockCategory, 'color' | 'icon' | 'name'>>) => {
      const patch = { ...updates };
      if (patch.name !== undefined) patch.name = normalizeCategoryName(patch.name);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      const { data, error } = await supabase
        .from('block_categories')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('[schedule] updateCategory failed:', error);
        await fetchAll();
        return { error };
      }
      setCategories((prev) => prev.map((c) => (c.id === id ? data : c)));
      return { data, error: null };
    },
    [fetchAll],
  );

  return {
    blocks: blocksWithCategory,
    categories,
    loading,
    createBlock,
    updateBlock,
    deleteBlock,
    toggleComplete,
    updateCategory,
    refetch: fetchAll,
  };
}
