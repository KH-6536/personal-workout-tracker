import { supabaseAdmin } from '../lib/supabase-admin.js';
import {
  getValidAccessToken,
  fetchLatestCycle,
  fetchLatestRecovery,
  fetchLatestSleep,
  fetchBodyMeasurement,
} from '../lib/whoop.js';

export async function syncUserData(userId: string) {
  // Get user's tokens
  const { data: token, error } = await supabaseAdmin
    .from('whoop_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !token) {
    throw new Error('No Whoop connection found');
  }

  const accessToken = await getValidAccessToken(token);

  // Date range: yesterday through today to capture overnight sleep/recovery
  // Whoop's recovery and sleep are tied to the cycle that started the previous day
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const start = `${yesterdayStr}T00:00:00.000Z`;
  const end = `${todayStr}T23:59:59.999Z`;

  // Fetch all data in parallel
  const [cycle, recovery, sleep, body] = await Promise.all([
    fetchLatestCycle(accessToken, start, end),
    fetchLatestRecovery(accessToken, start, end),
    fetchLatestSleep(accessToken, start, end),
    fetchBodyMeasurement(accessToken),
  ]);

  // Build metrics row
  const metrics: Record<string, unknown> = {
    user_id: userId,
    date: todayStr,
    source: 'whoop',
    updated_at: new Date().toISOString(),
  };

  if (cycle?.score) {
    metrics.strain_score = cycle.score.strain;
    metrics.calories = Math.round(cycle.score.kilojoule / 4.184); // kJ to kcal
  }

  if (recovery?.score) {
    metrics.recovery_score = recovery.score.recovery_score;
    metrics.resting_heart_rate = recovery.score.resting_heart_rate;
    metrics.hrv = recovery.score.hrv_rmssd_milli;
    if (recovery.score.spo2_percentage != null) {
      metrics.spo2 = recovery.score.spo2_percentage;
    }
    if (recovery.score.skin_temp_celsius != null) {
      metrics.skin_temp = recovery.score.skin_temp_celsius;
    }
  }

  if (sleep?.score) {
    const totalSleepMilli =
      sleep.score.stage_summary.total_light_sleep_time_milli +
      sleep.score.stage_summary.total_slow_wave_sleep_time_milli +
      sleep.score.stage_summary.total_rem_sleep_time_milli;
    metrics.sleep_duration_minutes = Math.round(totalSleepMilli / 60000);

    if (sleep.score.sleep_efficiency_percentage != null) {
      metrics.sleep_efficiency = sleep.score.sleep_efficiency_percentage;
    }
    if (sleep.score.sleep_performance_percentage != null) {
      metrics.sleep_performance = sleep.score.sleep_performance_percentage;
    }
  }

  if (body) {
    if (body.weight_kilogram != null) {
      metrics.weight = body.weight_kilogram;
      metrics.weight_unit = 'kg';
    }
  }

  // Upsert into health_metrics
  const { error: upsertError } = await supabaseAdmin
    .from('health_metrics')
    .upsert(metrics, { onConflict: 'user_id,date' });

  if (upsertError) {
    throw new Error(`Failed to upsert health metrics: ${upsertError.message}`);
  }

  return { date: todayStr, metrics };
}

// Also export as a Vercel API route for manual "Sync Now"
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user from Authorization header
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

  try {
    const result = await syncUserData(user.id);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Sync failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
