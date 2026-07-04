// ============================================
// Rize API client (GraphQL)
// Docs: https://help.rize.io/en/articles/8121707-rize-public-api
// Endpoint: https://api.rize.io/api/v1/graphql
// Auth:     Authorization: Bearer <api_key>
// ============================================

const RIZE_GRAPHQL = 'https://api.rize.io/api/v1/graphql';

export interface RizeDailySummary {
  date: string;           // YYYY-MM-DD (caller's timezone)
  work_seconds: number;   // total tracked work
  focus_seconds: number;  // category: focus work
  meeting_seconds: number;
  break_seconds: number;
  raw: unknown;           // raw response (for re-aggregation later)
}

async function rizeQuery<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RIZE_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rize API HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length) {
    throw new Error(`Rize GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) throw new Error('Rize API returned no data');
  return json.data;
}

// Fetch the user's tracked sessions for a single calendar day in their timezone.
// We query the `sessions` connection with a date range, then sum by category client-side.
//
// Rize's schema exposes Session { startTime, endTime, type, category { name } }.
// We treat type === 'TRACKED' work as billable; meetings/breaks as separate.
const SESSIONS_QUERY = /* GraphQL */ `
  query SessionsForDay($startTime: ISO8601DateTime!, $endTime: ISO8601DateTime!) {
    sessions(startTime: $startTime, endTime: $endTime, first: 500) {
      nodes {
        startTime
        endTime
        type
        category { name }
      }
    }
  }
`;

interface SessionNode {
  startTime: string;
  endTime: string;
  type: string | null;
  category: { name: string | null } | null;
}

interface SessionsResponse {
  sessions: { nodes: SessionNode[] };
}

/** Compute the [startISO, endISO] UTC range that bounds a given calendar date in `timezone`. */
export function dayBoundsInTimezone(dateYMD: string, timezone: string): { startISO: string; endISO: string } {
  // dateYMD is YYYY-MM-DD interpreted in `timezone`.
  // We construct the local midnight then find UTC equivalents.
  // Using Intl + manual offset; avoids pulling a TZ library.
  const [y, m, d] = dateYMD.split('-').map(Number);
  const localMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offsetStartMs = tzOffsetMs(localMidnight, timezone);
  const startUTC = new Date(localMidnight.getTime() - offsetStartMs);

  const localNextMidnight = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const offsetEndMs = tzOffsetMs(localNextMidnight, timezone);
  const endUTC = new Date(localNextMidnight.getTime() - offsetEndMs);

  return { startISO: startUTC.toISOString(), endISO: endUTC.toISOString() };
}

/** Get the YYYY-MM-DD of "yesterday" in the given timezone. */
export function yesterdayInTimezone(timezone: string): string {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: timezone });
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return yesterday.toLocaleDateString('en-CA', { timeZone: timezone });
}

/** Returns ms offset between UTC and the given timezone at the given instant. */
function tzOffsetMs(at: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUTC - at.getTime();
}

export async function fetchDailySummary(
  apiKey: string,
  dateYMD: string,
  timezone: string,
): Promise<RizeDailySummary> {
  const { startISO, endISO } = dayBoundsInTimezone(dateYMD, timezone);

  const data = await rizeQuery<SessionsResponse>(apiKey, SESSIONS_QUERY, {
    startTime: startISO,
    endTime: endISO,
  });

  let work_seconds = 0;
  let focus_seconds = 0;
  let meeting_seconds = 0;
  let break_seconds = 0;

  for (const node of data.sessions.nodes) {
    const start = new Date(node.startTime).getTime();
    const end = new Date(node.endTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const seconds = Math.round((end - start) / 1000);

    const categoryName = (node.category?.name ?? '').toLowerCase();
    const type = (node.type ?? '').toLowerCase();

    if (type === 'break' || categoryName.includes('break')) {
      break_seconds += seconds;
      continue;
    }
    if (categoryName.includes('meeting') || categoryName.includes('call')) {
      meeting_seconds += seconds;
      work_seconds += seconds;
      continue;
    }
    if (categoryName.includes('focus') || type === 'focus') {
      focus_seconds += seconds;
      work_seconds += seconds;
      continue;
    }
    // Default bucket: tracked work
    work_seconds += seconds;
  }

  return {
    date: dateYMD,
    work_seconds,
    focus_seconds,
    meeting_seconds,
    break_seconds,
    raw: data,
  };
}
