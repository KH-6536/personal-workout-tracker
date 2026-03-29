export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string | null;
  created_at: string;
}

export interface SplitTemplate {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  sort_order: number;
  default_sets: number;
  created_at: string;
  exercise?: Exercise;
}

export interface WeeklySchedule {
  id: string;
  user_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  template_id: string | null;
  template?: SplitTemplate;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  template_name: string | null;
  started_at: string;
  completed_at: string;
  notes: string | null;
  created_at: string;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  created_at: string;
}

// For active workout tracking (in-memory before save)
export interface ActiveSet {
  id: string; // temp client ID
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  reps: string;
  weight: string;
  previous_reps: number | null;
  previous_weight: number | null;
}

export interface ActiveExercise {
  exercise_id: string;
  exercise_name: string;
  sets: ActiveSet[];
}

export interface HealthMetric {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  weight: number | null;
  weight_unit: string | null;
  body_fat_pct: number | null;
  lean_mass_kg: number | null;
  recovery_score: number | null;
  resting_heart_rate: number | null;
  hrv: number | null;
  spo2: number | null;
  skin_temp: number | null;
  strain_score: number | null;
  calories: number | null;
  sleep_duration_minutes: number | null;
  sleep_efficiency: number | null;
  sleep_performance: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface WhoopConnection {
  id: string;
  user_id: string;
  expires_at: string;
  whoop_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

// ============================================
// Nutrition Tracking
// ============================================

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export interface Micronutrients {
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  potassium_mg?: number;
  magnesium_mg?: number;
  zinc_mg?: number;
  [key: string]: number | undefined;
}

export interface NutritionGoals {
  id: string;
  user_id: string;
  calorie_target: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  updated_at: string;
}

export interface FoodLog {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  food_name: string;
  serving_description: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  micronutrients: Micronutrients;
  source: string;
  raw_input: string | null;
  created_at: string;
}

export interface ParsedFoodItem {
  food_name: string;
  serving_description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  micronutrients: Micronutrients;
}

export interface DailyNutritionSummary {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: Record<MealType, FoodLog[]>;
}
