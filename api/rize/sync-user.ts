import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin.js';
import { fetchDailySummary, yesterdayInTimezone } from '../lib/rize.js';

interface RizeConnectionRow {
  user_id: string;
  api_key: string;
  timezone: string;
}

/**
 * Sync one user's Rize data for a single date (defaults to "yesterday" in their TZ).
 * Used by both the manual sync route and the cron route.
 */
export async function syncRizeUser(userId: string, dateYMD?: string) {
  const { data: conn, error } = await supabaseAdmin
    .from('rize_connections')
    .select('user_id, api_key, timezone')
    .eq('user_id', userId)
    .single<RizeConnectionRow>();

  if (error || !conn) {
    throw new Error('No Rize connection found for user');
  }

  const date = dateYMD ?? yesterdayInTimezone(conn.timezone);
  const summary = await fetchDailySummary(conn.api_key, date, conn.timezone);

  const { error: upsertErr } = await supabaseAdmin.from('rize_daily').upsert(
    {
      user_id: userId,
      log_date: summary.date,
      work_seconds: summary.work_seconds,
      focus_seconds: summary.focus_seconds,
      meeting_seconds: summary.meeting_seconds,
      break_seconds: summary.break_seconds,
      source_payload: summary.raw,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,log_date' }
  );
  if (upsertErr) throw new Error(`Failed to upsert rize_daily: ${upsertErr.message}`);

  await supabaseAdmin
    .from('rize_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { date: summary.date, work_seconds: summary.work_seconds };
}

// POST /api/rize/sync-user — manual sync triggered by the app
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const date = typeof req.body?.date === 'string' ? req.body.date : undefined;

  try {
    const result = await syncRizeUser(user.id, date);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Rize sync failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
