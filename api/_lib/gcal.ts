import ical from 'node-ical';

export interface GcalEventBlock {
  external_id: string;   // stable per-event id from the calendar
  title: string;
  start_time: string;    // HH:MM:SS local wall time
  end_time: string;      // HH:MM:SS local wall time
}

// Fetches the iCal feed at `url` and expands events that overlap `dateStr`
// (YYYY-MM-DD) in the user's timezone. Handles recurring events via
// node-ical's rrule expansion.
export async function fetchGcalBlocksForDate(
  url: string,
  dateStr: string,
  timezone: string,
): Promise<GcalEventBlock[]> {
  const data = await ical.async.fromURL(url);

  // Day window in the user's timezone. We build UTC bounds by asking
  // Intl what "00:00 in <timezone>" on that date corresponds to in UTC.
  const dayStart = zonedDateToUtc(dateStr, '00:00:00', timezone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const results: GcalEventBlock[] = [];

  for (const key of Object.keys(data)) {
    const ev = data[key] as ical.VEvent;
    if (!ev || ev.type !== 'VEVENT') continue;

    // Skip all-day events — they don't map to a time block usefully.
    // node-ical marks these with `datetype === 'date'` on start.
    const startProp = ev.start as unknown as { dateOnly?: boolean } & Date;
    if (startProp?.dateOnly) continue;

    if (ev.rrule) {
      // Expand recurrences into the day window; between() returns start dates.
      const instances = ev.rrule.between(dayStart, dayEnd, true);
      const excluded = new Set<string>();
      // node-ical exposes exdate as a keyed object of Date instances.
      if (ev.exdate) {
        for (const k of Object.keys(ev.exdate)) {
          const d = ev.exdate[k];
          if (d) excluded.add(d.toISOString());
        }
      }
      const duration = ev.end.getTime() - ev.start.getTime();
      for (const inst of instances) {
        if (excluded.has(inst.toISOString())) continue;
        // Recurrence-instance overrides live under ev.recurrences keyed by date.
        const overrideKey = inst.toISOString().slice(0, 10);
        const override = ev.recurrences?.[overrideKey];
        const s = override ? new Date(override.start) : inst;
        const e = override ? new Date(override.end) : new Date(inst.getTime() + duration);
        const title = (override?.summary ?? ev.summary ?? '').toString().trim();
        if (!title) continue;
        results.push({
          external_id: `${ev.uid}::${inst.toISOString()}`,
          title,
          start_time: hhmmssInTimezone(s, timezone),
          end_time: hhmmssInTimezone(e, timezone),
        });
      }
    } else {
      // Single event — include if it overlaps the day window.
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      if (e <= dayStart || s >= dayEnd) continue;
      const title = (ev.summary ?? '').toString().trim();
      if (!title) continue;
      results.push({
        external_id: String(ev.uid),
        title,
        start_time: hhmmssInTimezone(s, timezone),
        end_time: hhmmssInTimezone(e, timezone),
      });
    }
  }

  // Deduplicate by external_id (belt-and-suspenders — recurrence expansion
  // shouldn't collide but guarding is cheap) and sort by start.
  const byId = new Map<string, GcalEventBlock>();
  for (const r of results) byId.set(r.external_id, r);
  return [...byId.values()].sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// Format a Date as HH:MM:SS wall-clock time in the given IANA timezone.
function hhmmssInTimezone(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour')}:${get('minute')}:${get('second')}`;
}

// Convert "YYYY-MM-DD" + "HH:MM:SS" interpreted in `timezone` to a UTC Date.
// Works by binary-searching wall time; sufficient for our day-boundary needs.
function zonedDateToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [Y, M, D] = dateStr.split('-').map(Number);
  const [h, m, s] = timeStr.split(':').map(Number);
  // Start from the naive UTC guess.
  const guess = Date.UTC(Y, M - 1, D, h, m, s);
  // Compute the timezone's offset for that instant, then correct.
  const localParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const p: Record<string, string> = {};
  for (const part of localParts) p[part.type] = part.value;
  const asLocalUTC = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  const offset = asLocalUTC - guess;
  return new Date(guess - offset);
}
