import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const { data: token } = await supabaseAdmin
    .from('whoop_tokens')
    .select('id, expires_at, whoop_user_id, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!token) {
    return res.status(200).json({ connected: false });
  }

  return res.status(200).json({
    connected: true,
    expires_at: token.expires_at,
    whoop_user_id: token.whoop_user_id,
    last_synced: token.updated_at,
  });
}
