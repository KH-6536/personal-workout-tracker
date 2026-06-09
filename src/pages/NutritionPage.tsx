import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Trash2, Settings, BarChart3, X, Send, Star, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNutritionGoals, useFoodLogs } from '../hooks/useNutrition';
import { useCustomFoods, useRecentFoods } from '../hooks/useCustomFoods';
import { useFoodParser } from '../hooks/useFoodParser';
import { AppHeader } from '../components/Layout';
import type { MealType, ParsedFoodItem, CustomFood } from '../types/database';
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
  const { foods: customFoods, addCustomFood, bumpUsage } = useCustomFoods(user?.id);
  const { recentFoods, refetch: refetchRecent } = useRecentFoods(user?.id);

  const [inputText, setInputText] = useState('');
  const [mealType, setMealType] = useState<MealType>(getMealDefault);
  const [reviewItems, setReviewItems] = useState<ParsedFoodItem[]>([]);

  // Goals modal
  const [showGoals, setShowGoals] = useState(false);
  // Macros only — calorie target is auto-computed from these (4/4/9 kcal/g)
  const [goalForm, setGoalForm] = useState({
    protein_g: goals?.protein_g ?? 180,
    carbs_g: goals?.carbs_g ?? 250,
    fat_g: goals?.fat_g ?? 80,
  });

  // Sync form state from the fetched goals once they arrive.
  // (Was a useMemo before, which doesn't reliably commit setState during render
  // and was a likely cause of "refresh shows defaults".)
  useEffect(() => {
    if (goals) {
      setGoalForm({
        protein_g: goals.protein_g,
        carbs_g: goals.carbs_g,
        fat_g: goals.fat_g,
      });
    }
  }, [goals]);

  // Live-computed calorie target (4 kcal/g protein + 4 kcal/g carbs + 9 kcal/g fat)
  const computedCalories = useMemo(
    () => Math.round(goalForm.protein_g * 4 + goalForm.carbs_g * 4 + goalForm.fat_g * 9),
    [goalForm]
  );

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
    setInputText('');
    setReviewItems([]);
    clear();
    refetchRecent();
  }, [reviewItems, addFoodLogs, selectedDate, mealType, result, inputText, clear, refetchRecent]);

  const handleRemoveReviewItem = useCallback((idx: number) => {
    setReviewItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveGoals = useCallback(async () => {
    const result = await updateGoals({
      ...goalForm,
      calorie_target: computedCalories,
    });
    if (result?.error) {
      // Keep modal open so user knows save didn't land
      return;
    }
    setShowGoals(false);
  }, [goalForm, computedCalories, updateGoals]);

  // Quick-log a custom or recent food in one tap
  const handleQuickLog = useCallback(async (food: Pick<CustomFood, 'food_name' | 'serving_description' | 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg' | 'micronutrients'> & { id?: string }) => {
    await addFoodLogs([{
      date: selectedDate,
      meal_type: mealType,
      food_name: food.food_name,
      serving_description: food.serving_description,
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g,
      sugar_g: food.sugar_g,
      sodium_mg: food.sodium_mg,
      micronutrients: food.micronutrients ?? {},
      source: 'quick',
      raw_input: null,
    }]);
    if (food.id) bumpUsage(food.id);
    refetchRecent();
  }, [addFoodLogs, selectedDate, mealType, bumpUsage, refetchRecent]);

  // Save a food log entry as a custom food
  const handleSaveAsCustom = useCallback(async (log: { food_name: string; serving_description: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; sugar_g: number | null; sodium_mg: number | null; micronutrients: Record<string, number | undefined> }) => {
    await addCustomFood({
      food_name: log.food_name,
      serving_description: log.serving_description,
      calories: log.calories,
      protein_g: log.protein_g,
      carbs_g: log.carbs_g,
      fat_g: log.fat_g,
      fiber_g: log.fiber_g,
      sugar_g: log.sugar_g,
      sodium_mg: log.sodium_mg,
      micronutrients: log.micronutrients ?? {},
    });
  }, [addCustomFood]);

  // Merge custom + recent for quick access, custom foods first
  const quickAccessFoods = useMemo(() => {
    const items: { key: string; name: string; serving: string | null; calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; sugar_g: number | null; sodium_mg: number | null; micronutrients: Record<string, number | undefined>; isCustom: boolean; id?: string }[] = [];
    const seen = new Set<string>();

    for (const cf of customFoods) {
      const key = cf.food_name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ key, name: cf.food_name, serving: cf.serving_description, calories: cf.calories, protein_g: cf.protein_g, carbs_g: cf.carbs_g, fat_g: cf.fat_g, fiber_g: cf.fiber_g, sugar_g: cf.sugar_g, sodium_mg: cf.sodium_mg, micronutrients: cf.micronutrients, isCustom: true, id: cf.id });
      }
    }
    for (const rf of recentFoods) {
      const key = rf.food_name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ key, name: rf.food_name, serving: rf.serving_description, calories: rf.calories, protein_g: rf.protein_g, carbs_g: rf.carbs_g, fat_g: rf.fat_g, fiber_g: rf.fiber_g, sugar_g: rf.sugar_g, sodium_mg: rf.sodium_mg, micronutrients: rf.micronutrients ?? {}, isCustom: false });
      }
    }
    return items.slice(0, 12);
  }, [customFoods, recentFoods]);

  const calorieTarget = goals?.calorie_target ?? 2500;
  const proteinTarget = goals?.protein_g ?? 180;
  const carbsTarget = goals?.carbs_g ?? 250;
  const fatTarget = goals?.fat_g ?? 80;

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);

  return (
    <div className="page">
      <AppHeader title="Nutrition" />

      {/* Inline Food Input - always visible */}
      <div className="nutrition-inline-input">
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
        <div className="nutrition-input-row">
          <textarea
            className="nutrition-input-text"
            placeholder="3 eggs, 150g egg whites, 1 cup oatmeal..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleParse();
              }
            }}
          />
          <button
            className="nutrition-send-btn"
            onClick={handleParse}
            disabled={parsing || !inputText.trim()}
          >
            {parsing ? <div className="nutrition-send-spinner" /> : <Send size={20} />}
          </button>
        </div>

        {parseError && <p className="nutrition-error">{parseError}</p>}

        {/* Review parsed items inline */}
        {reviewItems.length > 0 && (
          <div className="nutrition-review">
            {reviewItems.map((item, idx) => (
              <div key={idx} className="nutrition-review-item">
                <div className="nutrition-review-item-header">
                  <div>
                    <div className="nutrition-review-item-name">{item.food_name}</div>
                    <div className="nutrition-review-item-serving">{item.serving_description}</div>
                  </div>
                  <button className="nutrition-food-delete" onClick={() => handleRemoveReviewItem(idx)}>
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
            <button className="btn btn-primary nutrition-save-btn" onClick={handleSave}>
              Save {reviewItems.length} Item{reviewItems.length > 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>

      {/* Quick Access Foods */}
      {quickAccessFoods.length > 0 && (
        <div className="nutrition-quick-access">
          <div className="nutrition-quick-label"><Zap size={14} /> Quick Add</div>
          <div className="nutrition-quick-chips">
            {quickAccessFoods.map((food) => (
              <button
                key={food.key}
                className={`nutrition-quick-chip ${food.isCustom ? 'nutrition-quick-chip--saved' : ''}`}
                onClick={() => handleQuickLog({
                  food_name: food.name,
                  serving_description: food.serving,
                  calories: food.calories,
                  protein_g: food.protein_g,
                  carbs_g: food.carbs_g,
                  fat_g: food.fat_g,
                  fiber_g: food.fiber_g,
                  sugar_g: food.sugar_g,
                  sodium_mg: food.sodium_mg,
                  micronutrients: food.micronutrients,
                  id: food.id,
                })}
              >
                {food.isCustom && <Star size={12} />}
                <span className="nutrition-quick-chip-name">{food.name}</span>
                <span className="nutrition-quick-chip-cal">{Math.round(food.calories)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                        className="nutrition-food-save"
                        title="Save as custom food"
                        onClick={(e) => { e.stopPropagation(); handleSaveAsCustom(log); }}
                      >
                        <Star size={14} />
                      </button>
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
              <p>No food logged yet. Type above to add.</p>
            </div>
          )}
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
              {/* Auto-computed calorie target — the macros drive this. */}
              <div className="nutrition-goals-calorie-display">
                <div className="ngc-label">Calorie target</div>
                <div className="ngc-value">{computedCalories.toLocaleString()}</div>
                <div className="ngc-hint">Auto-calculated from macros · 4·4·9 kcal/g</div>
              </div>

              <label>
                <span>Protein (g)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalForm.protein_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, protein_g: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Carbs (g)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalForm.carbs_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, carbs_g: Number(e.target.value) }))}
                />
              </label>
              <label>
                <span>Fat (g)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={goalForm.fat_g}
                  onChange={(e) => setGoalForm((p) => ({ ...p, fat_g: Number(e.target.value) }))}
                />
              </label>
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
