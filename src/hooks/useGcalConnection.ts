import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { GcalConnection } from '../types/database';

export function useGcalConnection(userId: string | undefined) {
  const [connection, setConnection] = useState<GcalConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConnection = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('gcal_connections')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) console.error('[gcal] fetch failed:', error);
    else setConnection(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchConnection(); }, [fetchConnection]);

  // Disconnect: deletes the saved iCal URL. Existing gcal-source time_blocks
  // stay put — user can delete them individually or they'll be replaced on
  // next sync after reconnecting.
  const disconnect = useCallback(async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('gcal_connections')
      .delete()
      .eq('user_id', userId);
    if (error) {
      console.error('[gcal] disconnect failed:', error);
      return { error };
    }
    setConnection(null);
    return { error: null };
  }, [userId]);

  // Hit the sync endpoint for the given date. If icalUrl is provided, saves
  // it first. Returns the summary payload.
  const sync = useCallback(async (date: string, icalUrl?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const res = await fetch('/api/gcal/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ date, timezone, ical_url: icalUrl }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Sync failed (${res.status})`);
    await fetchConnection();
    return body as { added: number; updated: number; removed: number; event_count: number };
  }, [fetchConnection]);

  return {
    connection,
    isConnected: connection !== null,
    loading,
    disconnect,
    sync,
    refetch: fetchConnection,
  };
}
