import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin.js';

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

  // Get tokens
  const { data: token } = await supabaseAdmin
    .from('whoop_tokens')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!token) {
    return res.status(404).json({ error: 'No Whoop connection' });
  }

  const WHOOP_API = 'https://api.prod.whoop.com';
  const accessToken = token.access_token;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const startStr = twoDaysAgo.toISOString().split('T')[0];
  const start = `${startStr}T00:00:00.000Z`;
  const end = `${todayStr}T23:59:59.999Z`;

  // Try each endpoint and capture raw responses
  const endpoints = [
    { name: 'cycle', path: `/developer/v1/cycle?start=${start}&end=${end}&limit=1` },
    { name: 'recovery', path: `/developer/v1/recovery?start=${start}&end=${end}&limit=1` },
    { name: 'sleep', path: `/developer/v1/activity/sleep?start=${start}&end=${end}&limit=1` },
    { name: 'body', path: `/developer/v1/user/measurement/body` },
    { name: 'profile', path: `/developer/v1/user/profile/basic` },
  ];

  const results: Record<string, unknown> = { dateRange: { start, end } };

  for (const ep of endpoints) {
    try {
      const r = await fetch(`${WHOOP_API}${ep.path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); } catch { body = text; }
      results[ep.name] = { status: r.status, body };
    } catch (err) {
      results[ep.name] = { error: (err as Error).message };
    }
  }

  return res.status(200).json(results);
}
