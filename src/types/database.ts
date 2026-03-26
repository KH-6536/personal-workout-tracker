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
