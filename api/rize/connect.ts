import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin.js';

/**
 * POST /api/rize/connect
 * Body: { api_key: string, timezone?: string }
 *
 * Stores the user's Rize API key server-side. The key is never sent back to the client
 * (the rize_connection_status view excludes it).
 */
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

  const api_key = typeof req.body?.api_key === 'string' ? req.body.api_key.trim() : '';
  const timezone = typeof req.body?.timezone === 'string' ? req.body.timezone : 'America/Los_Angeles';

  if (!api_key) {
    return res.status(400).json({ error: 'api_key required' });
  }

  const { error: upsertErr } = await supabaseAdmin.from('rize_connections').upsert(
    {
      user_id: user.id,
      api_key,
      timezone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (upsertErr) {
    return res.status(500).json({ error: upsertErr.message });
  }

  return res.status(200).json({ ok: true });
}
