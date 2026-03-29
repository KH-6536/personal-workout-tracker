import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2, Settings, BarChart3, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNutritionGoals, useFoodLogs } from '../hooks/useNutrition';
import { useFoodParser } from '../hooks/useFoodParser';
import { AppHeader } from '../components/Layout';
import type { MealType, ParsedFoodItem } from '../types/database';
import { MEAL_LABELS } from '../types/database';

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
  const pct = Math.min(consumed / (target || 1), 1.5);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - pct * circumference;
  const remaining = target - consumed;
  const color = consumed > target ? 'var(--danger)' : 'var(--accent)';

  return (
    <div className="calorie-ring-container">
      <svg viewBox="0 0 128 128" className="calorie-ring-svg">
        <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--bg-input)" strokeWidth="10" />
        <circle
          cx="64" cy="64" r={radius} fill="none"
          stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="calorie-ring-text">
        <div className="calorie-ring-value">{Math.round(consumed)}</div>
        <div className="calorie-ring-label">
          {remaining >= 0 ? `${Math.round(remaining)} left` : `${Math.round(-remaining)} over`}
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min((current / (target || 1)) * 100, 100);
  return (
    <div className="macro-bar-row">
      <div className="macro-bar-label">
        <span>{label}</span>
        <span className="macro-bar-values">{Math.round(current)}g / {Math.round(target)}g</span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function getMealDefault(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

export default function NutritionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const { goals, updateGoals } = useNutritionGoals(user?.id);
  const { logs, dailySummary, addFoodLogs, deleteFoodLog, loading } = useFoodLogs(user?.id, selectedDate);
  const { parse, parsing, result, error: parseError, clear } = useFoodParser();

  // Food log input
  const [showInput, setShowInput] = useState(false);
  const [inputText, setInputText] = useState('');
  const [mealType, setMealType] = useState<MealType>(getMealDefault);
  const [reviewItems, setReviewItems] = useState<ParsedFoodItem[]>([]);

  // Goals modal
  const [showGoals, setShowGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({
    calorie_target: goals?.calorie_target ?? 2500,
    protein_g: goals?.protein_g ?? 180,
    carbs_g: goals?.carbs_g ?? 250,
    fat_g: goals?.fat_g ?? 80,
  });

  // Sync goalForm when goals load
  useMemo(() => {
    if (goals) {
      setGoalForm({
        calorie_target: goals.calorie_target,
        protein_g: goals.protein_g,
        carbs_g: goals.carbs_g,
        fat_g: goals.fat_g,
      });
    }
  }, [goals]);

  const navigateDate = useCallback((dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    setSelectedDate(d.toISOString().split('T')[0]);
  }, [selectedDate]);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const handleParse = useCallback(async () => {
    if (!inputText.trim()) return;
    const data = await parse(inputText);
    if (data?.items) {
      setReviewItems(data.items);
    }
  }, [inputText, parse]);

  const handleSave = useCallback(async () => {
    if (reviewItems.length === 0) return;
    await addFoodLogs(reviewItems.map((item) => ({
      date: selectedDate,
      meal_type: mealType,
      food_name: item.food_name,
      serving_description: item.serving_description,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fiber_g: item.fiber_g,
      sugar_g: item.sugar_g,
      sodium_mg: item.sodium_mg,
      micronutrients: item.micronutrients ?? {},
      source: 'nlp',
      raw_input: result?.raw_input ?? inputText,
    })));
    setShowInput(false);
    setInputText('');
    setReviewItems([]);
    clear();
  }, [reviewItems, addFoodLogs, selectedDate, mealType, result, inputText, clear]);

  const handleRemoveReviewItem = useCallback((idx: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveGoals = useCallback(async () => {
    await updateGoals(goalForm);
    setShowGoals(false);
  }, [goalForm, updateGoals]);

  const calorieTarget = goals?.calorie_target ?? 2500;
  const proteinTarget = goals?.protein_g ?? 180;
  const carbsTarget = goals?.carbs_g ?? 250;
  const fatTarget = goals?.fat_g ?? 80;

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  // Expanded micronutrient view
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  return (
    <div className="page">
      <AppHeader title="Nutrition" />

      {/* Date Navigation */}
      <div className="nutrition-date-nav">
        <button className="btn btn-outline btn-small" onClick={() => navigateDate(-1)}>
          <ChevronLeft size={18} />
        </button>
        <span className="nutrition-date-label">{isToday ? 'Today' : dateLabel}</span>
        <button className="btn btn-outline btn-small" onClick={() => navigateDate(1)} disabled={isToday}>
          <ChevronRight size={18} />
        </button>
        <div className="nutrition-date-actions">
          <button className="btn btn-outline btn-small" onClick={() => setShowGoals(true)}>
            <Settings size={16} />
          </button>
          <button className="btn btn-outline btn-small" onClick={() => navigate('/nutrition/analytics')}>
            <BarChart3 size={16} />
          </button>
        </div>
      </div>

      {/* Calorie + Macro Summary */}
      <div className="nutrition-summary-card">
        <CalorieRing consumed={dailySummary.total_calories} target={calorieTarget} />
        <div className="nutrition-macros">
          <MacroBar label="Protein" current={dailySummary.total_protein} target={proteinTarget} color="var(--protein-color)" />
          <MacroBar label="Carbs" current={dailySummary.total_carbs} target={carbsTarget} color="var(--carbs-color)" />
          <MacroBar label="Fat" current={dailySummary.total_fat} target={fatTarget} color="var(--fat-color)" />
        </div>
      </div>

      {/* Food Log */}
      {loading ? (
        <div className="health-loading">Loading...</div>
      ) : (
        <div className="nutrition-food-log">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mt) => {
            const mealLogs = dailySummary.meals[mt];
            const mealCals = mealLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
            if (mealLogs.length === 0) return null;
            return (
              <div key={mt} className="nutrition-meal-group">
                <div className="nutrition-meal-header">
                  <span className="nutrition-meal-name">{MEAL_LABELS[mt]}</span>
                  <span className="nutrition-meal-cals">{Math.round(mealCals)} cal</span>
                </div>
                {mealLogs.map((log) => (
                  <div
                    key={log.id}
                    className="nutrition-food-item"
                    onClick={() => setExpandedMeal(expandedMeal === log.id ? null : log.id)}
                  >
                    <div className="nutrition-food-main">
                      <div className="nutrition-food-name">
                        {log.food_name}
                        {log.serving_description && (
                          <span className="nutrition-food-serving"> · {log.serving_description}</span>
                        )}
                      </div>
                      <div className="nutrition-food-cals">{Math.round(log.calories)} cal</div>
                      <button
                        className="nutrition-food-delete"
                        onClick={(e) => { e.stopPropagation(); deleteFoodLog(log.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {expandedMeal === log.id && (
                      <div className="nutrition-food-detail">
                        <span>P: {Math.round(log.protein_g)}g</span>
                        <span>C: {Math.round(log.carbs_g)}g</span>
                        <span>F: {Math.round(log.fat_g)}g</span>
                        {log.fiber_g != null && <span>Fiber: {Math.round(log.fiber_g)}g</span>}
                        {log.sugar_g != null && <span>Sugar: {Math.round(log.sugar_g)}g</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {logs.length === 0 && (
            <div className="empty-state">
              <p>No food logged yet. Tap + to add.</p>
            </div>
          )}
        </div>
      )}

      {/* Floating Add Button */}
      <button className="nutrition-fab" onClick={() => { setShowInput(true); setMealType(getMealDefault()); }}>
        <Plus size={24} />
      </button>

      {/* Food Input Modal */}
      {showInput && (
        <div className="nutrition-modal-overlay" onClick={() => { setShowInput(false); clear(); setReviewItems([]); }}>
          <div className="nutrition-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nutrition-modal-header">
              <h3>Log Food</h3>
              <button className="nutrition-modal-close" onClick={() => { setShowInput(false); clear(); setReviewItems([]); }}>
                <X size={20} />
              </button>
            </div>

            {/* Meal type selector */}
            <div className="nutrition-meal-select">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mt) => (
                <button
                  key={mt}
                  className={`btn btn-small ${mealType === mt ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setMealType(mt)}
                >
                  {MEAL_LABELS[mt]}
                </button>
              ))}
            </div>

            {/* Natural language input */}
            <textarea
              className="nutrition-input-text"
              placeholder="e.g., 3 eggs, 150g egg whites, 1 cup oatmeal with honey"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={3}
              autoFocus
            />

            <button
              className="btn btn-primary btn-large nutrition-parse-btn"
              onClick={handleParse}
              disabled={parsing || !inputText.trim()}
            >
              {parsing ? 'Analyzing...' : 'Analyze Food'}
            </button>

            {parseError && <p className="nutrition-error">{parseError}</p>}

            {/* Review parsed items */}
            {reviewItems.length > 0 && (
              <div className="nutrition-review">
                <h4 className="nutrition-review-title">Review Items</h4>
                {reviewItems.map((item, idx) => (
                  <div key={idx} className="nutrition-review-item">
                    <div className="nutrition-review-item-header">
                      <div>
                        <div className="nutrition-review-item-name">{item.food_name}</div>
                        <div className="nutrition-review-item-serving">{item.serving_description}</div>
                      </div>
                      <button
                        className="nutrition-food-delete"
                        onClick={() => handleRemoveReviewItem(idx)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="nutrition-review-macros">
                      <span className="nutrition-review-cal">{Math.round(item.calories)} cal</span>
                      <span style={{ color: 'var(--protein-color)' }}>P: {Math.round(item.protein_g)}g</span>
                      <span style={{ color: 'var(--carbs-color)' }}>C: {Math.round(item.carbs_g)}g</span>
                      <span style={{ color: 'var(--fat-color)' }}>F: {Math.round(item.fat_g)}g</span>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary btn-large nutrition-save-btn" onClick={handleSave}>
                  Save {reviewItems.length} Item{reviewItems.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoals && (
        <div className="nutrition-modal-overlay" onClick={() => setShowGoals(false)}>
          <div className="nutrition-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nutrition-modal-header">
              <h3>Daily Goals</h3>
              <button className="nutrition-modal-close" onClick={() => setShowGoals(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="nutrition-goals-form">
              <label>
                <span>Calories</span>
                <input
                  type="number"
                  value={goalForm.calorie_target}
                  onChange={(e) => setGoalForm((p) => ({ ...p, calorie_target: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Protein (g)</span>
                <input
                  type="number"
                  value={goalForm.protein_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, protein_g: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Carbs (g)</span>
                <input
                  type="number"
                  value={goalForm.carbs_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, carbs_g: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Fat (g)</span>
                <input
                  type="number"
                  value={goalForm.fat_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, fat_g: Number(e.target.value) }))}
                />
              </label>
              <div className="nutrition-goals-calc">
                Macro calories: {Math.round(goalForm.protein_g * 4 + goalForm.carbs_g * 4 + goalForm.fat_g * 9)} cal
              </div>
              <button className="btn btn-primary btn-large" onClick={handleSaveGoals}>
                Save Goals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
