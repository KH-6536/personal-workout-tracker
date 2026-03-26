import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTemplateExercises } from '../hooks/useTemplates';
import { usePreviousSets } from '../hooks/useWorkoutHistory';
import type { ActiveExercise, ActiveSet, SplitTemplate } from '../types/database';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export default function ActiveWorkoutPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templateExercises, loading: teLoading } = useTemplateExercises(templateId);
  const { getPreviousSets } = usePreviousSets(user?.id);

  const [template, setTemplate] = useState<SplitTemplate | null>(null);
  const [exercises, setExercises] = useState<ActiveExercise[]>([]);
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());
  const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());
  const [startedAt] = useState(new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch template info
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

  // Build active exercises from template + previous data
  useEffect(() => {
    if (teLoading || initialized || templateExercises.length === 0) return;

    const buildExercises = async () => {
      const activeExercises: ActiveExercise[] = [];

      for (const te of templateExercises) {
        const exercise = te.exercise;
        if (!exercise) continue;

        const prevSets = await getPreviousSets(exercise.id);
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
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }, []);

  const addSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.exercise_id !== exerciseId) return ex;
        const newSetNum = ex.sets.length + 1;
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
              previous_reps: null,
              previous_weight: null,
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

  const finishWorkout = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Create session
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

      // Build all sets
      const allSets = exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.reps || s.weight) // only save sets with data
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
          return (
            <div key={ex.exercise_id} className="exercise-card">
              <div className="exercise-card-header" onClick={() => toggleCollapse(ex.exercise_id)}>
                <div className="exercise-name-section">
                  <h3 className="exercise-name">{ex.exercise_name}</h3>
                </div>
                <div className="exercise-header-actions">
                  {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
              </div>

              {!isCollapsed && (
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
      </div>
    </div>
  );
}
