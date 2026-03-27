import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { WeeklySchedule, DayOfWeek } from '../types/database';

export function useSchedule(userId: string | undefined) {
  const [schedule, setSchedule] = useState<WeeklySchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('weekly_schedule')
      .select('*, template:split_templates(*)')
      .eq('user_id', userId)
      .order('day_of_week');
    if (error) console.error('Error fetching schedule:', error);
    else setSchedule(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const setDayTemplate = useCallback(
    async (dayOfWeek: DayOfWeek, templateId: string | null) => {
      if (!userId) return;
      const existing = schedule.find((s) => s.day_of_week === dayOfWeek);

      if (existing) {
        if (templateId === null) {
          const { error } = await supabase
            .from('weekly_schedule')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
          setSchedule((prev) => prev.filter((s) => s.id !== existing.id));
        } else {
          const { error } = await supabase
            .from('weekly_schedule')
            .update({ template_id: templateId })
            .eq('id', existing.id);
          if (error) throw error;
          await fetchSchedule();
        }
      } else if (templateId !== null) {
        const { error } = await supabase
          .from('weekly_schedule')
          .insert({ user_id: userId, day_of_week: dayOfWeek, template_id: templateId });
        if (error) throw error;
        await fetchSchedule();
      }
    },
    [userId, schedule, fetchSchedule]
  );

  const getTodayTemplate = useCallback(() => {
    const today = new Date().getDay() as DayOfWeek;
    const entry = schedule.find((s) => s.day_of_week === today);
    return entry?.template ?? null;
  }, [schedule]);

  return { schedule, loading, setDayTemplate, getTodayTemplate, refetch: fetchSchedule };
}
