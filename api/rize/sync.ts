import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase-admin.js';
import { syncRizeUser } from './sync-user.js';

/**
 * Cron entry point. Hit nightly to pull every connected user's prior-day Rize data.
 * Scheduled in vercel.json: "0 8 * * *" (08:00 UTC = 01:00 PT, captures full PT day).
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: connections, error } = await supabaseAdmin
    .from('rize_connections')
    .select('user_id');

  if (error) {
    console.error('Failed to fetch rize_connections:', error);
    return res.status(500).json({ error: 'Failed to fetch connections' });
  }

  const results: { user_id: string; success: boolean; date?: string; error?: string }[] = [];

  for (const conn of connections ?? []) {
    try {
      const r = await syncRizeUser(conn.user_id);
      results.push({ user_id: conn.user_id, success: true, date: r.date });
    } catch (err) {
      console.error(`Rize sync failed for user ${conn.user_id}:`, err);
      results.push({
        user_id: conn.user_id,
        success: false,
        error: (err as Error).message,
      });
    }
  }

  return res.status(200).json({
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
