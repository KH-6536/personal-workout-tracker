import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { HealthMetric, WhoopConnection } from '../types/database';

export function useHealthMetrics(userId: string | undefined) {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(90); // last ~3 months
    if (error) console.error('Error fetching health metrics:', error);
    else setMetrics(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const getToday = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return metrics.find((m) => m.date === today) ?? null;
  }, [metrics]);

  const getDateRange = useCallback(
    (days: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      return metrics
        .filter((m) => m.date >= cutoffStr)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [metrics]
  );

  return { metrics, loading, getToday, getDateRange, refetch: fetchMetrics };
}

export function useWhoopConnection(userId: string | undefined) {
  const [connection, setConnection] = useState<WhoopConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConnection = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('whoop_tokens')
      .select('id, user_id, expires_at, whoop_user_id, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('Error fetching whoop connection:', error);
    else setConnection(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const isConnected = connection !== null;
  const isExpired = connection ? new Date(connection.expires_at) < new Date() : false;

  return { connection, isConnected, isExpired, loading, refetch: fetchConnection };
}
