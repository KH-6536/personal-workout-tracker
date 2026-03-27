import { supabaseAdmin } from './supabase-admin.js';

const WHOOP_API = 'https://api.prod.whoop.com';

interface WhoopTokenRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  whoop_user_id: string | null;
}

interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// Refresh tokens if expired, returns a valid access token
export async function getValidAccessToken(token: WhoopTokenRow): Promise<string> {
  const expiresAt = new Date(token.expires_at);
  const now = new Date();
  // Refresh 5 minutes before expiry
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return token.access_token;
  }

  const res = await fetch(`${WHOOP_API}/oauth/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID!,
      client_secret: process.env.WHOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // If refresh fails (no refresh token or revoked), mark as expired so UI prompts reconnect
    if (!token.refresh_token || res.status === 400 || res.status === 401) {
      await supabaseAdmin
        .from('whoop_tokens')
        .update({ expires_at: new Date(0).toISOString(), updated_at: new Date().toISOString() })
        .eq('id', token.id);
      throw new Error('Whoop session expired. Please reconnect your Whoop account.');
    }
    throw new Error(`Token refresh failed: ${res.status} ${errText}`);
  }

  const data: WhoopTokenResponse = await res.json();

  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from('whoop_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', token.id);

  return data.access_token;
}

async function whoopGet(accessToken: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${WHOOP_API}/developer${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Whoop API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface WhoopCycle {
  id: number;
  start: string;
  end: string;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  } | null;
}

export interface WhoopRecovery {
  cycle_id: number;
  score: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number | null;
    skin_temp_celsius: number | null;
  } | null;
}

export interface WhoopSleep {
  id: number;
  start: string;
  end: string;
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      total_awake_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: { baseline_milli: number; need_from_sleep_debt_milli: number; need_from_recent_strain_milli: number; need_from_recent_nap_milli: number };
    respiratory_rate: number | null;
    sleep_performance_percentage: number | null;
    sleep_consistency_percentage: number | null;
    sleep_efficiency_percentage: number | null;
  } | null;
}

export interface WhoopBodyMeasurement {
  height_meter: number | null;
  weight_kilogram: number | null;
  max_heart_rate: number | null;
}

export async function fetchLatestCycle(accessToken: string, start: string, end: string): Promise<WhoopCycle | null> {
  try {
    const data = await whoopGet(accessToken, '/v2/cycle', { start, end, limit: '1' });
    const records = data.records ?? data;
    return Array.isArray(records) && records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error('fetchLatestCycle failed:', err);
    return null;
  }
}

export async function fetchLatestRecovery(accessToken: string, start: string, end: string): Promise<WhoopRecovery | null> {
  try {
    const data = await whoopGet(accessToken, '/v2/recovery', { start, end, limit: '1' });
    const records = data.records ?? data;
    return Array.isArray(records) && records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error('fetchLatestRecovery failed:', err);
    return null;
  }
}

export async function fetchLatestSleep(accessToken: string, start: string, end: string): Promise<WhoopSleep | null> {
  try {
    const data = await whoopGet(accessToken, '/v2/activity/sleep', { start, end, limit: '1' });
    const records = data.records ?? data;
    return Array.isArray(records) && records.length > 0 ? records[0] : null;
  } catch (err) {
    console.error('fetchLatestSleep failed:', err);
    return null;
  }
}

export async function fetchBodyMeasurement(accessToken: string): Promise<WhoopBodyMeasurement | null> {
  try {
    return await whoopGet(accessToken, '/v2/user/measurement/body');
  } catch (err) {
    console.error('fetchBodyMeasurement failed:', err);
    return null;
  }
}
