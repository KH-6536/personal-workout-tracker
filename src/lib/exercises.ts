export interface PresetExercise {
  name: string;
  muscleGroup: string;
}

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
] as const;

export const PRESET_EXERCISES: PresetExercise[] = [
  // Chest
  { name: 'Flat Barbell Bench Press', muscleGroup: 'Chest' },
  { name: 'Incline Barbell Bench Press', muscleGroup: 'Chest' },
  { name: 'Decline Barbell Bench Press', muscleGroup: 'Chest' },
  { name: 'Flat Dumbbell Press', muscleGroup: 'Chest' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest' },
  { name: 'Dumbbell Fly', muscleGroup: 'Chest' },
  { name: 'Incline Dumbbell Fly', muscleGroup: 'Chest' },
  { name: 'Cable Fly', muscleGroup: 'Chest' },
  { name: 'Pec Deck', muscleGroup: 'Chest' },
  { name: 'Machine Chest Press', muscleGroup: 'Chest' },
  { name: 'Push Up', muscleGroup: 'Chest' },
  { name: 'Dip (Chest)', muscleGroup: 'Chest' },

  // Back
  { name: 'Barbell Row', muscleGroup: 'Back' },
  { name: 'Dumbbell Row', muscleGroup: 'Back' },
  { name: 'Seated Cable Row', muscleGroup: 'Back' },
  { name: 'Lat Pulldown', muscleGroup: 'Back' },
  { name: 'Pull Up', muscleGroup: 'Back' },
  { name: 'Chin Up', muscleGroup: 'Back' },
  { name: 'T-Bar Row', muscleGroup: 'Back' },
  { name: 'Machine Row', muscleGroup: 'Back' },
  { name: 'Face Pull', muscleGroup: 'Back' },
  { name: 'Straight Arm Pulldown', muscleGroup: 'Back' },
  { name: 'Deadlift', muscleGroup: 'Back' },
  { name: 'Rack Pull', muscleGroup: 'Back' },

  // Shoulders
  { name: 'Overhead Press (Barbell)', muscleGroup: 'Shoulders' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders' },
  { name: 'Arnold Press', muscleGroup: 'Shoulders' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders' },
  { name: 'Cable Lateral Raise', muscleGroup: 'Shoulders' },
  { name: 'Front Raise', muscleGroup: 'Shoulders' },
  { name: 'Reverse Fly', muscleGroup: 'Shoulders' },
  { name: 'Machine Shoulder Press', muscleGroup: 'Shoulders' },
  { name: 'Upright Row', muscleGroup: 'Shoulders' },
  { name: 'Shrug', muscleGroup: 'Shoulders' },

  // Biceps
  { name: 'Barbell Curl', muscleGroup: 'Biceps' },
  { name: 'Dumbbell Curl', muscleGroup: 'Biceps' },
  { name: 'Hammer Curl', muscleGroup: 'Biceps' },
  { name: 'Incline Dumbbell Curl', muscleGroup: 'Biceps' },
  { name: 'Preacher Curl', muscleGroup: 'Biceps' },
  { name: 'Cable Curl', muscleGroup: 'Biceps' },
  { name: 'EZ Bar Curl', muscleGroup: 'Biceps' },
  { name: 'Concentration Curl', muscleGroup: 'Biceps' },

  // Triceps
  { name: 'Tricep Pushdown', muscleGroup: 'Triceps' },
  { name: 'Overhead Tricep Extension', muscleGroup: 'Triceps' },
  { name: 'Skull Crusher', muscleGroup: 'Triceps' },
  { name: 'Close Grip Bench Press', muscleGroup: 'Triceps' },
  { name: 'Dip (Tricep)', muscleGroup: 'Triceps' },
  { name: 'Cable Overhead Extension', muscleGroup: 'Triceps' },
  { name: 'Kickback', muscleGroup: 'Triceps' },

  // Quads
  { name: 'Barbell Squat', muscleGroup: 'Quads' },
  { name: 'Front Squat', muscleGroup: 'Quads' },
  { name: 'Leg Press', muscleGroup: 'Quads' },
  { name: 'Leg Extension', muscleGroup: 'Quads' },
  { name: 'Hack Squat', muscleGroup: 'Quads' },
  { name: 'Goblet Squat', muscleGroup: 'Quads' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'Quads' },
  { name: 'Lunge', muscleGroup: 'Quads' },
  { name: 'Walking Lunge', muscleGroup: 'Quads' },

  // Hamstrings
  { name: 'Romanian Deadlift', muscleGroup: 'Hamstrings' },
  { name: 'Lying Leg Curl', muscleGroup: 'Hamstrings' },
  { name: 'Seated Leg Curl', muscleGroup: 'Hamstrings' },
  { name: 'Stiff Leg Deadlift', muscleGroup: 'Hamstrings' },
  { name: 'Good Morning', muscleGroup: 'Hamstrings' },
  { name: 'Nordic Curl', muscleGroup: 'Hamstrings' },

  // Glutes
  { name: 'Hip Thrust', muscleGroup: 'Glutes' },
  { name: 'Glute Bridge', muscleGroup: 'Glutes' },
  { name: 'Cable Kickback', muscleGroup: 'Glutes' },
  { name: 'Hip Abduction', muscleGroup: 'Glutes' },

  // Calves
  { name: 'Standing Calf Raise', muscleGroup: 'Calves' },
  { name: 'Seated Calf Raise', muscleGroup: 'Calves' },
  { name: 'Leg Press Calf Raise', muscleGroup: 'Calves' },

  // Core
  { name: 'Crunch', muscleGroup: 'Core' },
  { name: 'Cable Crunch', muscleGroup: 'Core' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core' },
  { name: 'Plank', muscleGroup: 'Core' },
  { name: 'Ab Wheel Rollout', muscleGroup: 'Core' },
  { name: 'Russian Twist', muscleGroup: 'Core' },
  { name: 'Decline Sit Up', muscleGroup: 'Core' },
];
