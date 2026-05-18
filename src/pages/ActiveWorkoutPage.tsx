import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Plus, Minus, ChevronDown, ChevronUp, RefreshCw, Trash2, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTemplateExercises } from '../hooks/useTemplates';
import { useExercises } from '../hooks/useExercises';
import { usePreviousSets } from '../hooks/useWorkoutHistory';
import type { ActiveExercise, ActiveSet, SplitTemplate, WorkoutSet } from '../types/database';
import { PRESET_EXERCISES, MUSCLE_GROUPS } from '../lib/exercises';
import LoadingSpinner from '../components/LoadingSpinner';
import RestTimer from '../components/RestTimer';
import { format } from 'date-fns';

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

function ExercisePicker({
  onPick,
  onClose,
  excludeNames,
  exercises: userExercises,
  addExercise,
}: {
  onPick: (exerciseId: string, exerciseName: string) => void;
  onClose: () => void;
  excludeNames: Set<string>;
  exercises: { id: string; name: string; muscle_group: string | null }[];
  addExercise: (name: string, muscleGroup?: string) => Promise<{ id: string; name: string } | null>;
}) {
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const presetNames = new Set(PRESET_EXERCISES.map((p) => p.name.toLowerCase()));
  const customExercises = userExercises
    .filter((e) => !presetNames.has(e.name.toLowerCase()))
    .map((e) => ({ name: e.name, muscleGroup: e.muscle_group || 'Other' }));
  const allExercises = [...PRESET_EXERCISES, ...customExercises];

  const filtered = allExercises.filter((p) => {
    if (excludeNames.has(p.name.toLowerCase())) return false;
    if (muscleFilter !== 'All' && p.muscleGroup !== muscleFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handlePick = async (name: string, muscleGroup: string) => {
    setAdding(name);
    try {
      const existing = userExercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
      let exerciseId: string;
      if (existing) {
        exerciseId = existing.id;
      } else {
        const created = await addExercise(name, muscleGroup);
        if (!created) return;
        exerciseId = created.id;
      }
      onPick(exerciseId, name);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="exercise-picker workout-picker">
      <div className="picker-search">
        <Search size={16} className="picker-search-icon" />
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="picker-search-input"
          autoFocus
        />
        <button className="btn-icon-small" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="picker-filters">
        <button className={`filter-chip ${muscleFilter === 'All' ? 'active' : ''}`} onClick={() => setMuscleFilter('All')}>All</button>
        {MUSCLE_GROUPS.map((mg) => (
          <button key={mg} className={`filter-chip ${muscleFilter === mg ? 'active' : ''}`} onClick={() => setMuscleFilter(mg)}>{mg}</button>
        ))}
      </div>
      <div className="picker-list">
        {filtered.map((p) => (
          <button
            key={p.name}
            className="picker-item"
            onClick={() => handlePick(p.name, p.muscleGroup)}
            disabled={adding !== null}
          >
            <span className="picker-item-name">{adding === p.name ? 'Adding...' : p.name}</span>
            <span className="picker-item-group">{p.muscleGroup}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="empty-text" style={{ padding: '0.75rem 0', textAlign: 'center' }}>No matching exercises.</p>}
      </div>
    </div>
  );
}

export default function ActiveWorkoutPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templateExercises, loading: teLoading } = useTemplateExercises(templateId);
  const { getPreviousSets } = usePreviousSets(user?.id);
  const { exercises: userExercises, addExercise } = useExercises(user?.id);

  const [template, setTemplate] = useState<SplitTemplate | null>(null);
  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  const [startedAt] = useState(new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [swappingExercise, setSwappingExercise] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const previousDataRef = useRef<Record<string, WorkoutSet[]>>({});

  useEffect(() => {
    if (!templateId) return;
    supabase
      .from('split_templates')
      .select('*')
      .eq('id', templateId)
      .single()
      .then(({ data }) => {
        if (data) setTemplate(data);
      });
  }, [templateId]);

  useEffect(() => {
    if (teLoading || initialized) return;
    if (templateExercises.length === 0) {
      setInitialized(true);
      return;
    }

    const buildExercises = async () => {
      const activeExercises: ActiveExercise[] = [];

      for (const te of templateExercises) {
        const exercise = te.exercise;
        if (!exercise) continue;

        const prevSets = await getPreviousSets(exercise.id);
        previousDataRef.current[exercise.id] = prevSets;

        const sets: ActiveSet[] = [];

        for (let i = 1; i <= te.default_sets; i++) {
          const prev = prevSets.find((ps) => ps.set_number === i);
          sets.push({
            id: generateId(),
            exercise_id: exercise.id,
            exercise_name: exercise.name,
            set_number: i,
            reps: '',
            weight: '',
            previous_reps: prev?.reps ?? null,
            previous_weight: prev?.weight ?? null,
          });
        }

        activeExercises.push({
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          sets,
        });
      }

      setExercises(activeExercises);
      setInitialized(true);
    };

    buildExercises();
  }, [teLoading, templateExercises, getPreviousSets, initialized]);

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const completedCount = completedSets.size;
  const progressPercent = totalSets > 0 ? Math.round((completedCount / totalSets) * 100) : 0;

  const updateSet = useCallback(
    (exerciseId: string, setId: string, field: 'reps' | 'weight', value: string) => {
      setExercises((prev) =>
        prev.map((ex) =>
          ex.exercise_id === exerciseId
            ? {
                ...ex,
                sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
              }
            : ex
        )
      );
    },
    []
  );

  const toggleSetComplete = useCallback((setId: string) => {
    setCompletedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
        setShowTimer(true);
      }
      return next;
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exercise_id !== exerciseId) return ex;
        const newSetNum = ex.sets.length + 1;
        const prevSets = previousDataRef.current[exerciseId] ?? [];
        const prev_data = prevSets.find((ps) => ps.set_number === newSetNum);
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: generateId(),
              exercise_id: exerciseId,
              exercise_name: ex.exercise_name,
              set_number: newSetNum,
              reps: '',
              weight: '',
              previous_reps: prev_data?.reps ?? null,
              previous_weight: prev_data?.weight ?? null,
            },
          ],
        };
      })
    );
  }, []);

  const removeSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exercise_id !== exerciseId || ex.sets.length <= 1) return ex;
        const removed = ex.sets[ex.sets.length - 1];
        setCompletedSets((cs) => {
          const next = new Set(cs);
          next.delete(removed.id);
          return next;
        });
        return { ...ex, sets: ex.sets.slice(0, -1) };
      })
    );
  }, []);

  const toggleCollapse = useCallback((exerciseId: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }, []);

  // Swap an exercise mid-workout
  const handleSwapExercise = useCallback(async (oldExerciseId: string, newExerciseId: string, newExerciseName: string) => {
    const prevSets = await getPreviousSets(newExerciseId);
    previousDataRef.current[newExerciseId] = prevSets;

    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exercise_id !== oldExerciseId) return ex;
        // Clear completed status for old sets
        const oldSetIds = ex.sets.map((s) => s.id);
        setCompletedSets((cs) => {
          const next = new Set(cs);
          oldSetIds.forEach((id) => next.delete(id));
          return next;
        });
        // Build new sets with same count
        const newSets: ActiveSet[] = ex.sets.map((_, i) => {
          const prev = prevSets.find((ps) => ps.set_number === i + 1);
          return {
            id: generateId(),
            exercise_id: newExerciseId,
            exercise_name: newExerciseName,
            set_number: i + 1,
            reps: '',
            weight: '',
            previous_reps: prev?.reps ?? null,
            previous_weight: prev?.weight ?? null,
          };
        });
        return {
          exercise_id: newExerciseId,
          exercise_name: newExerciseName,
          sets: newSets,
        };
      })
    );
    setSwappingExercise(null);
  }, [getPreviousSets]);

  // Remove an exercise from the workout entirely
  const handleRemoveExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => {
      const ex = prev.find((e) => e.exercise_id === exerciseId);
      if (ex) {
        setCompletedSets((cs) => {
          const next = new Set(cs);
          ex.sets.forEach((s) => next.delete(s.id));
          return next;
        });
      }
      return prev.filter((e) => e.exercise_id !== exerciseId);
    });
  }, []);

  // Add a brand new exercise to the workout
  const handleAddExercise = useCallback(async (exerciseId: string, exerciseName: string) => {
    const prevSets = await getPreviousSets(exerciseId);
    previousDataRef.current[exerciseId] = prevSets;

    const defaultSetCount = 3;
    const newSets: ActiveSet[] = Array.from({ length: defaultSetCount }, (_, i) => {
      const prev = prevSets.find((ps) => ps.set_number === i + 1);
      return {
        id: generateId(),
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        set_number: i + 1,
        reps: '',
        weight: '',
        previous_reps: prev?.reps ?? null,
        previous_weight: prev?.weight ?? null,
      };
    });

    setExercises((prev) => [
      ...prev,
      {
        exercise_id: exerciseId,
        exercise_name: exerciseName,
        sets: newSets,
      },
    ]);
    setShowAddExercise(false);
  }, [getPreviousSets]);

  const currentExerciseNames = new Set(exercises.map((ex) => ex.exercise_name.toLowerCase()));

  const finishWorkout = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { data: session, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: user.id,
          template_id: templateId || null,
          template_name: template?.name || 'Custom Workout',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const allSets = exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.reps || s.weight)
          .map((s) => ({
            session_id: session.id,
            exercise_id: s.exercise_id,
            exercise_name: s.exercise_name,
            set_number: s.set_number,
            reps: s.reps ? parseInt(s.reps) : null,
            weight: s.weight ? parseFloat(s.weight) : null,
          }))
      );

      if (allSets.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(allSets);
        if (setsError) throw setsError;
      }

      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error saving workout:', err);
      alert('Failed to save workout. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (teLoading || !initialized) {
    return <LoadingSpinner message="Preparing workout..." />;
  }

  const today = new Date();
  const dayName = format(today, 'EEEE');

  return (
    <div className="workout-page">
      {/* Header */}
      <div className="workout-header">
        <div className="workout-header-left">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <p className="workout-day-label">{dayName}'s Workout</p>
            <h1 className="workout-title">{template?.name || 'Workout'}</h1>
          </div>
        </div>
        <button
          className="btn btn-finish"
          onClick={finishWorkout}
          disabled={saving}
        >
          <CheckCircle2 size={18} />
          {saving ? 'Saving...' : 'Finish'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-text">
          <span>{completedCount}/{totalSets} Completed</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Exercises */}
      <div className="exercises-list">
        {exercises.map((ex) => {
          const isCollapsed = collapsedExercises.has(ex.exercise_id);
          const isSwapping = swappingExercise === ex.exercise_id;
          return (
            <div key={ex.exercise_id} className="exercise-card">
              <div className="exercise-card-header" onClick={() => toggleCollapse(ex.exercise_id)}>
                <div className="exercise-name-section">
                  <h3 className="exercise-name">{ex.exercise_name}</h3>
                </div>
                <div className="exercise-header-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`btn-icon-small ${isSwapping ? 'swap-active' : ''}`}
                    title="Swap exercise"
                    onClick={() => setSwappingExercise(isSwapping ? null : ex.exercise_id)}
                  >
                    <RefreshCw size={16} />
                  </button>
                  {exercises.length > 1 && (
                    <button
                      className="btn-icon-small danger"
                      title="Remove exercise"
                      onClick={() => handleRemoveExercise(ex.exercise_id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button className="btn-icon-small" onClick={() => toggleCollapse(ex.exercise_id)}>
                    {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                  </button>
                </div>
              </div>

              {/* Swap picker */}
              {isSwapping && (
                <div style={{ padding: '0 0.75rem 0.75rem' }}>
                  <ExercisePicker
                    onPick={(id, name) => handleSwapExercise(ex.exercise_id, id, name)}
                    onClose={() => setSwappingExercise(null)}
                    excludeNames={currentExerciseNames}
                    exercises={userExercises}
                    addExercise={addExercise}
                  />
                </div>
              )}

              {!isCollapsed && !isSwapping && (
                <>
                  {/* Column headers */}
                  <div className="set-row set-header-row">
                    <div className="set-col set-num">SET</div>
                    <div className="set-col set-prev">PREVIOUS</div>
                    <div className="set-col set-input">LBS</div>
                    <div className="set-col set-input">REPS</div>
                    <div className="set-col set-check"></div>
                  </div>

                  {/* Sets */}
                  {ex.sets.map((s) => {
                    const isDone = completedSets.has(s.id);
                    const prevText =
                      s.previous_weight !== null && s.previous_reps !== null
                        ? `${s.previous_weight} x ${s.previous_reps}`
                        : '-';

                    return (
                      <div key={s.id} className={`set-row ${isDone ? 'set-done' : ''}`}>
                        <div className="set-col set-num">
                          <span className="set-number">{s.set_number}</span>
                        </div>
                        <div className="set-col set-prev">
                          <span className="prev-text">{prevText}</span>
                        </div>
                        <div className="set-col set-input">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="set-input-field"
                            value={s.weight}
                            onChange={(e) => updateSet(ex.exercise_id, s.id, 'weight', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="set-col set-input">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="set-input-field"
                            value={s.reps}
                            onChange={(e) => updateSet(ex.exercise_id, s.id, 'reps', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="set-col set-check">
                          <button
                            className={`check-btn ${isDone ? 'checked' : ''}`}
                            onClick={() => toggleSetComplete(s.id)}
                          >
                            {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add/Remove set */}
                  <div className="set-actions">
                    <button className="btn-icon-small" onClick={() => removeSet(ex.exercise_id)}>
                      <Minus size={16} />
                    </button>
                    <span className="set-actions-label">{ex.sets.length} sets</span>
                    <button className="btn-icon-small" onClick={() => addSet(ex.exercise_id)}>
                      <Plus size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Add Exercise button */}
        {!showAddExercise ? (
          <button
            className="btn btn-outline btn-full workout-add-exercise-btn"
            onClick={() => setShowAddExercise(true)}
          >
            <Plus size={16} /> Add Exercise
          </button>
        ) : (
          <div className="exercise-card" style={{ padding: '0.75rem' }}>
            <ExercisePicker
              onPick={handleAddExercise}
              onClose={() => setShowAddExercise(false)}
              excludeNames={currentExerciseNames}
              exercises={userExercises}
              addExercise={addExercise}
            />
          </div>
        )}
      </div>

      {/* Rest Timer */}
      {showTimer && (
        <RestTimer onClose={() => setShowTimer(false)} />
      )}
    </div>
  );
}
