import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?whoop_error=${encodeURIComponent(String(error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect('/?whoop_error=missing_code');
  }

  // The state contains the user's Supabase access token
  const userToken = state as string;
  if (!userToken) {
    return res.redirect('/?whoop_error=missing_state');
  }

  // Verify the user's identity
  const supabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(userToken);

  if (authError || !user) {
    return res.redirect('/?whoop_error=invalid_token');
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.WHOOP_REDIRECT_URI!,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('Token exchange failed:', errText);
    return res.redirect('/?whoop_error=token_exchange_failed');
  }

  const tokens = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Fetch Whoop user ID
  let whoopUserId: string | null = null;
  try {
    const profileRes = await fetch('https://api.prod.whoop.com/developer/v2/user/profile/basic', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      whoopUserId = String(profile.user_id);
    }
  } catch {
    // Non-critical, continue without whoop_user_id
  }

  // Upsert tokens
  const { error: upsertError } = await supabaseAdmin
    .from('whoop_tokens')
    .upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        expires_at: expiresAt,
        scopes: tokens.scope || null,
        whoop_user_id: whoopUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) {
    console.error('Failed to store tokens:', upsertError);
    return res.redirect(`/?whoop_error=${encodeURIComponent(`storage_failed: ${upsertError.message} (code: ${upsertError.code})`)}`);
  }

  // Redirect back to health page
  return res.redirect('/health?whoop_connected=true');
  } catch (err) {
    console.error('Callback error:', err);
    return res.redirect(`/?whoop_error=${encodeURIComponent(`unexpected: ${(err as Error).message}`)}`);
  }
}
