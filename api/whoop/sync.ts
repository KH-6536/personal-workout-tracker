import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabase-admin.js';
import { syncUserData } from './sync-user.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get all users with Whoop connections
  const { data: tokens, error } = await supabaseAdmin
    .from('whoop_tokens')
    .select('user_id');

  if (error) {
    console.error('Failed to fetch whoop tokens:', error);
    return res.status(500).json({ error: 'Failed to fetch tokens' });
  }

  const results: { user_id: string; success: boolean; error?: string }[] = [];

  for (const token of tokens ?? []) {
    try {
      await syncUserData(token.user_id);
      results.push({ user_id: token.user_id, success: true });
    } catch (err) {
      console.error(`Sync failed for user ${token.user_id}:`, err);
      results.push({
        user_id: token.user_id,
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
