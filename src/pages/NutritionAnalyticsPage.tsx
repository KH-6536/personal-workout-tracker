import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNutritionAnalytics, useNutritionGoals } from '../hooks/useNutrition';
import { AppHeader } from '../components/Layout';

function BarChart({ data, maxVal, color, label }: { data: { date: string; value: number }[]; maxVal: number; color: string; label: string }) {
  if (data.length === 0) return <div className="nutrition-empty-chart">No data</div>;

  const max = Math.max(maxVal, ...data.map((d) => d.value));

  return (
    <div className="nutrition-bar-chart">
      <div className="nutrition-bar-chart-label">{label}</div>
      <div className="nutrition-bars">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' });
          return (
            <div key={d.date} className="nutrition-bar-col">
              <div className="nutrition-bar-value">{Math.round(d.value)}</div>
              <div className="nutrition-bar-track">
                <div className="nutrition-bar-fill" style={{ height: `${pct}%`, background: color }} />
              </div>
              <div className="nutrition-bar-day">{dayLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DualLineChart({
  calorieData,
  weightData,
}: {
  calorieData: { date: string; value: number }[];
  weightData: { date: string; value: number }[];
}) {
  if (calorieData.length < 2 && weightData.length < 2) {
    return <div className="nutrition-empty-chart">Not enough data for weight correlation</div>;
  }

  const allDates = [...new Set([...calorieData.map((d) => d.date), ...weightData.map((d) => d.date)])].sort();
  if (allDates.length < 2) return null;

  const width = 300;
  const height = 120;
  const pad = 30;

  const drawLine = (data: { date: string; value: number }[], color: string) => {
    if (data.length < 2) return null;
    const minV = Math.min(...data.map((d) => d.value));
    const maxV = Math.max(...data.map((d) => d.value));
    const rangeV = maxV - minV || 1;

    const points = data.map((d) => {
      const dateIdx = allDates.indexOf(d.date);
      const x = pad + (dateIdx / (allDates.length - 1)) * (width - 2 * pad);
      const y = height - pad - ((d.value - minV) / rangeV) * (height - 2 * pad);
      return `${x},${y}`;
    });

    return (
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  return (
    <div className="nutrition-dual-chart">
      <div className="nutrition-dual-legend">
        <span><span className="legend-dot" style={{ background: 'var(--accent)' }} /> Avg Calories</span>
        <span><span className="legend-dot" style={{ background: 'var(--success)' }} /> Weight (lbs)</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="nutrition-dual-svg" preserveAspectRatio="none">
        {drawLine(calorieData, 'var(--accent)')}
        {drawLine(weightData, 'var(--success)')}
      </svg>
      <div className="nutrition-dual-dates">
        <span>{allDates[0]?.slice(5)}</span>
        <span>{allDates[allDates.length - 1]?.slice(5)}</span>
      </div>
    </div>
  );
}

export default function NutritionAnalyticsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 30>(7);
  const { dailyTotals, weightData, weeklyAvg, loading } = useNutritionAnalytics(user?.id, range);
  const { goals } = useNutritionGoals(user?.id);

  const calorieTarget = goals?.calorie_target ?? 2500;

  const calorieChartData = dailyTotals.map((d) => ({ date: d.date, value: d.calories }));
  const proteinChartData = dailyTotals.map((d) => ({ date: d.date, value: d.protein }));

  // Weekly grouped calories for the correlation chart
  const weeklyCalData = (() => {
    if (dailyTotals.length === 0) return [];
    const weeks: Record<string, { total: number; count: number; date: string }> = {};
    for (const d of dailyTotals) {
      const dt = new Date(d.date + 'T12:00:00');
      const weekStart = new Date(dt);
      weekStart.setDate(dt.getDate() - dt.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!weeks[key]) weeks[key] = { total: 0, count: 0, date: key };
      weeks[key].total += d.calories;
      weeks[key].count++;
    }
    return Object.values(weeks).map((w) => ({ date: w.date, value: Math.round(w.total / w.count) }));
  })();

  // Weight trend
  const weightStart = weightData.length > 0 ? weightData[0].weight : null;
  const weightEnd = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
  const weightDiff = weightStart != null && weightEnd != null ? weightEnd - weightStart : null;

  return (
    <div className="page">
      <div className="nutrition-analytics-header">
        <button className="btn btn-outline btn-small" onClick={() => navigate('/nutrition')}>
          <ArrowLeft size={18} />
        </button>
        <AppHeader title="Analytics" subtitle="Nutrition" />
      </div>

      <div className="health-range-toggle" style={{ marginBottom: '1rem', justifyContent: 'center', display: 'flex', gap: '0.375rem' }}>
        <button className={`btn btn-small ${range === 7 ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRange(7)}>7d</button>
        <button className={`btn btn-small ${range === 30 ? 'btn-primary' : 'btn-outline'}`} onClick={() => setRange(30)}>30d</button>
      </div>

      {loading ? (
        <div className="health-loading">Loading analytics...</div>
      ) : (
        <>
          {/* Weekly Averages */}
          {weeklyAvg && (
            <div className="nutrition-avg-cards">
              <div className="nutrition-avg-card">
                <div className="nutrition-avg-value">{weeklyAvg.avgCalories}</div>
                <div className="nutrition-avg-label">Avg Cal/Day</div>
                <div className={`nutrition-avg-diff ${weeklyAvg.avgCalories > calorieTarget ? 'over' : 'under'}`}>
                  {weeklyAvg.avgCalories > calorieTarget ? '+' : ''}{weeklyAvg.avgCalories - calorieTarget} vs goal
                </div>
              </div>
              <div className="nutrition-avg-card">
                <div className="nutrition-avg-value">{weeklyAvg.avgProtein}g</div>
                <div className="nutrition-avg-label">Avg Protein</div>
              </div>
              <div className="nutrition-avg-card">
                <div className="nutrition-avg-value">{weeklyAvg.totalDays}</div>
                <div className="nutrition-avg-label">Days Logged</div>
              </div>
            </div>
          )}

          {/* Calorie Bar Chart */}
          <section className="section">
            <h3 className="section-title">Daily Calories</h3>
            <BarChart data={calorieChartData} maxVal={calorieTarget} color="var(--accent)" label="" />
          </section>

          {/* Protein Bar Chart */}
          <section className="section">
            <h3 className="section-title">Daily Protein</h3>
            <BarChart data={proteinChartData} maxVal={goals?.protein_g ?? 180} color="var(--protein-color)" label="" />
          </section>

          {/* Weight Correlation */}
          <section className="section">
            <h3 className="section-title">
              Calories vs Weight
              {weightDiff != null && (
                <span className={`nutrition-weight-change ${weightDiff >= 0 ? 'up' : 'down'}`}>
                  {weightDiff >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)} lbs
                </span>
              )}
            </h3>
            <DualLineChart
              calorieData={weeklyCalData}
              weightData={weightData.map((w) => ({ date: w.date, value: w.weight }))}
            />
          </section>

          {dailyTotals.length === 0 && (
            <div className="empty-state">
              <p>No nutrition data yet. Start logging food to see analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
