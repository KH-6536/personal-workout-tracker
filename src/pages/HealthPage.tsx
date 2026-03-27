import { useState, useCallback } from 'react';
import { Heart, Activity, Moon, Flame, Scale, Wifi, WifiOff, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useHealthMetrics, useWhoopConnection } from '../hooks/useHealthMetrics';
import { AppHeader } from '../components/Layout';
import { supabase } from '../lib/supabase';

type TimeRange = 7 | 30;

function MetricCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`health-metric-card health-metric-${color}`}>
      <div className="health-metric-icon">{icon}</div>
      <div className="health-metric-value">
        {value !== null && value !== undefined ? value : '--'}
        {unit && value !== null && <span className="health-metric-unit">{unit}</span>}
      </div>
      <div className="health-metric-label">{label}</div>
    </div>
  );
}

function MiniChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 40;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mini-chart" preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendCard({
  label,
  data,
  unit,
  color,
}: {
  label: string;
  data: { date: string; value: number }[];
  unit?: string;
  color: string;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => d.value);
  const latest = values[values.length - 1];
  const first = values[0];
  const diff = latest - first;
  const diffStr = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);

  return (
    <div className="health-trend-card">
      <div className="health-trend-header">
        <span className="health-trend-label">{label}</span>
        <span className="health-trend-current">
          {latest.toFixed(1)}{unit && <span className="health-metric-unit"> {unit}</span>}
        </span>
      </div>
      <MiniChart data={values} color={color} />
      <div className="health-trend-footer">
        <span className="health-trend-range">
          {data[0].date.slice(5)} - {data[data.length - 1].date.slice(5)}
        </span>
        <span className={`health-trend-diff ${diff >= 0 ? 'trend-up' : 'trend-down'}`}>
          {diffStr}{unit && ` ${unit}`}
        </span>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { user } = useAuth();
  const { loading, getToday, getDateRange, refetch } = useHealthMetrics(user?.id);
  const { isConnected, isExpired, loading: connLoading } = useWhoopConnection(user?.id);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>(7);

  const today = getToday();
  const rangeData = getDateRange(timeRange);

  const handleConnect = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    window.location.href = `/api/whoop/authorize?token=${session.access_token}`;
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/whoop/sync-user', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        await refetch();
      } else {
        const err = await res.json();
        alert(`Sync failed: ${err.error}`);
      }
    } catch {
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }, [refetch]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm('Disconnect Whoop? Your synced data will remain.')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch('/api/whoop/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    window.location.reload();
  }, []);

  // Build trend data helpers
  const buildTrend = (key: keyof typeof rangeData[0]) => {
    return rangeData
      .filter((m) => m[key] != null)
      .map((m) => ({ date: m.date, value: Number(m[key]) }));
  };

  const weightTrend = buildTrend('weight');
  const recoveryTrend = buildTrend('recovery_score');
  const hrvTrend = buildTrend('hrv');
  const sleepTrend = rangeData
    .filter((m) => m.sleep_duration_minutes != null)
    .map((m) => ({ date: m.date, value: Number(m.sleep_duration_minutes) / 60 }));

  // Convert weight for display (stored as kg, show in lbs if unit is lbs)
  const displayWeight = today?.weight != null
    ? today.weight_unit === 'kg'
      ? `${(today.weight * 2.20462).toFixed(1)}`
      : `${today.weight}`
    : null;

  return (
    <div className="page">
      <AppHeader title="Health" subtitle="Whoop Integration" />

      {/* Whoop Connection */}
      <div className="health-connection-card">
        <div className="health-connection-status">
          {isConnected ? (
            <>
              <Wifi size={20} className="health-connected-icon" />
              <span>Whoop Connected</span>
              {isExpired && <span className="health-expired-badge">Token Expired</span>}
            </>
          ) : (
            <>
              <WifiOff size={20} className="health-disconnected-icon" />
              <span>Whoop Not Connected</span>
            </>
          )}
        </div>
        <div className="health-connection-actions">
          {isConnected ? (
            <>
              <button
                className="btn btn-primary btn-small"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw size={16} className={syncing ? 'spin' : ''} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button className="btn btn-outline btn-small btn-danger-outline" onClick={handleDisconnect}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connLoading}
            >
              Connect Whoop
            </button>
          )}
        </div>
      </div>

      {/* Today's Metrics */}
      {loading ? (
        <div className="health-loading">Loading health data...</div>
      ) : (
        <>
          <h3 className="section-title">Today</h3>
          <div className="health-metrics-grid">
            <MetricCard
              label="Recovery"
              value={today?.recovery_score ?? null}
              unit="%"
              icon={<Heart size={20} />}
              color={
                today?.recovery_score != null
                  ? today.recovery_score >= 67
                    ? 'green'
                    : today.recovery_score >= 34
                      ? 'yellow'
                      : 'red'
                  : 'neutral'
              }
            />
            <MetricCard
              label="HRV"
              value={today?.hrv != null ? Math.round(today.hrv) : null}
              unit="ms"
              icon={<Activity size={20} />}
              color="blue"
            />
            <MetricCard
              label="RHR"
              value={today?.resting_heart_rate ?? null}
              unit="bpm"
              icon={<Heart size={20} />}
              color="red"
            />
            <MetricCard
              label="Sleep"
              value={
                today?.sleep_duration_minutes != null
                  ? `${Math.floor(today.sleep_duration_minutes / 60)}h ${today.sleep_duration_minutes % 60}m`
                  : null
              }
              icon={<Moon size={20} />}
              color="purple"
            />
            <MetricCard
              label="Strain"
              value={today?.strain_score != null ? today.strain_score.toFixed(1) : null}
              icon={<Flame size={20} />}
              color="orange"
            />
            <MetricCard
              label="Weight"
              value={displayWeight}
              unit="lbs"
              icon={<Scale size={20} />}
              color="neutral"
            />
            <MetricCard
              label="SpO2"
              value={today?.spo2 != null ? today.spo2.toFixed(0) : null}
              unit="%"
              icon={<Zap size={20} />}
              color="blue"
            />
            <MetricCard
              label="Calories"
              value={today?.calories ?? null}
              unit="kcal"
              icon={<Flame size={20} />}
              color="orange"
            />
          </div>

          {/* Trends */}
          <div className="health-trends-header">
            <h3 className="section-title">Trends</h3>
            <div className="health-range-toggle">
              <button
                className={`btn btn-small ${timeRange === 7 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTimeRange(7)}
              >
                7d
              </button>
              <button
                className={`btn btn-small ${timeRange === 30 ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTimeRange(30)}
              >
                30d
              </button>
            </div>
          </div>

          <div className="health-trends-list">
            <TrendCard label="Recovery" data={recoveryTrend} unit="%" color="var(--success)" />
            <TrendCard label="HRV" data={hrvTrend} unit="ms" color="var(--accent)" />
            <TrendCard label="Sleep" data={sleepTrend} unit="hrs" color="#a855f7" />
            <TrendCard label="Weight" data={weightTrend} unit="lbs" color="var(--text-secondary)" />
          </div>
        </>
      )}
    </div>
  );
}
