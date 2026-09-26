import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { fetchGcalBlocksForDate } from '../_lib/gcal.js';

/**
 * POST /api/gcal/sync
 * Body: { date: "YYYY-MM-DD", timezone: "America/Los_Angeles", ical_url?: string }
 *
 * If ical_url is provided, saves it to the user's gcal_connections row first
 * (upsert). Then fetches the feed, expands events overlapping `date` in the
 * given timezone, and upserts them into time_blocks with source='gcal'.
 * The (user_id, source, external_id) unique index keeps re-syncs idempotent.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { date, timezone, ical_url } = (req.body ?? {}) as {
    date?: string; timezone?: string; ical_url?: string;
  };
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
  }
  const tz = timezone || 'UTC';

  // If a new URL was provided, save it and use it.
  let urlToUse = ical_url;
  if (ical_url) {
    if (!/^https?:\/\//i.test(ical_url)) {
      return res.status(400).json({ error: 'ical_url must be an http(s) URL' });
    }
    const { error: saveErr } = await supabaseAdmin
      .from('gcal_connections')
      .upsert({ user_id: user.id, ical_url, last_error: null }, { onConflict: 'user_id' });
    if (saveErr) return res.status(500).json({ error: `Failed to save URL: ${saveErr.message}` });
  } else {
    const { data: conn, error: connErr } = await supabaseAdmin
      .from('gcal_connections')
      .select('ical_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (connErr) return res.status(500).json({ error: connErr.message });
    if (!conn) return res.status(400).json({ error: 'No calendar connected' });
    urlToUse = conn.ical_url;
  }

  let events;
  try {
    events = await fetchGcalBlocksForDate(urlToUse!, date, tz);
  } catch (err) {
    const msg = (err as Error).message || 'iCal fetch failed';
    await supabaseAdmin
      .from('gcal_connections')
      .update({ last_error: msg })
      .eq('user_id', user.id);
    return res.status(502).json({ error: `Calendar fetch failed: ${msg}` });
  }

  // Diff strategy: read existing gcal blocks for the day, then insert new ones,
  // update changed ones (title/start/end), and delete ones no longer in the
  // calendar. We avoid PostgREST upsert here because the (user_id, source,
  // external_id) uniqueness is enforced by a partial index, which doesn't
  // pair cleanly with .upsert(onConflict).
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('time_blocks')
    .select('id, external_id, title, start_time, end_time')
    .eq('user_id', user.id)
    .eq('block_date', date)
    .eq('source', 'gcal');
  if (exErr) return res.status(500).json({ error: exErr.message });

  const existingByExtId = new Map<string, typeof existing[number]>();
  for (const row of existing ?? []) {
    if (row.external_id) existingByExtId.set(row.external_id, row);
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; patch: Record<string, unknown> }> = [];

  for (const ev of events) {
    const existingRow = existingByExtId.get(ev.external_id);
    const category_name = ev.title.trim().toLowerCase();
    if (!existingRow) {
      toInsert.push({
        user_id: user.id,
        block_date: date,
        start_time: ev.start_time,
        end_time: ev.end_time,
        title: ev.title,
        category_name,
        source: 'gcal',
        external_id: ev.external_id,
      });
    } else if (
      existingRow.title !== ev.title ||
      existingRow.start_time !== ev.start_time ||
      existingRow.end_time !== ev.end_time
    ) {
      toUpdate.push({
        id: existingRow.id,
        patch: {
          title: ev.title,
          start_time: ev.start_time,
          end_time: ev.end_time,
          category_name,
        },
      });
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabaseAdmin.from('time_blocks').insert(toInsert);
    if (error) {
      await supabaseAdmin
        .from('gcal_connections')
        .update({ last_error: error.message })
        .eq('user_id', user.id);
      return res.status(500).json({ error: `DB insert failed: ${error.message}` });
    }
  }

  for (const u of toUpdate) {
    // Small loops in serverless; a stored proc would be nicer at scale, but
    // per-user per-day the event count is tiny.
    await supabaseAdmin.from('time_blocks').update(u.patch).eq('id', u.id);
  }

  // Also remove gcal blocks for this date whose external_id is NOT in the
  // new set — so events deleted in Google disappear here too.
  const keepIds = new Set(events.map((e) => e.external_id));
  const stale = (existing ?? []).filter((r) => r.external_id && !keepIds.has(r.external_id));
  if (stale.length > 0) {
    await supabaseAdmin
      .from('time_blocks')
      .delete()
      .in('id', stale.map((r) => r.id));
  }

  await supabaseAdmin
    .from('gcal_connections')
    .update({ last_synced_at: new Date().toISOString(), last_error: null })
    .eq('user_id', user.id);

  return res.status(200).json({
    added: toInsert.length,
    updated: toUpdate.length,
    removed: stale.length,
    event_count: events.length,
  });
}
