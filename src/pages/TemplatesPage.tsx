import { useState } from 'react';
import { Plus, Trash2, Edit3, X, Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTemplates, useTemplateExercises } from '../hooks/useTemplates';
import { useExercises } from '../hooks/useExercises';
import { useSchedule } from '../hooks/useSchedule';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { DAY_NAMES, type DayOfWeek } from '../types/database';

function TemplateDetail({
  templateId,
  userId,
}: {
  templateId: string;
  userId: string;
}) {
  const { templateExercises, loading, addExerciseToTemplate, removeExerciseFromTemplate } =
    useTemplateExercises(templateId);
  const { exercises, addExercise } = useExercises(userId);
  const [showAdd, setShowAdd] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscle, setNewExMuscle] = useState('');
  const [selectedExId, setSelectedExId] = useState('');

  const handleAddExisting = async () => {
    if (!selectedExId) return;
    const nextOrder = templateExercises.length;
    await addExerciseToTemplate(selectedExId, nextOrder);
    setSelectedExId('');
  };

  const handleCreateAndAdd = async () => {
    if (!newExName.trim()) return;
    const ex = await addExercise(newExName.trim(), newExMuscle.trim());
    if (ex) {
      const nextOrder = templateExercises.length;
      await addExerciseToTemplate(ex.id, nextOrder);
    }
    setNewExName('');
    setNewExMuscle('');
    setShowAdd(false);
  };

  // Exercises not already in this template
  const availableExercises = exercises.filter(
    (e) => !templateExercises.some((te) => te.exercise_id === e.id)
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="template-detail">
      {/* Exercise list */}
      {templateExercises.length === 0 && (
        <p className="empty-text">No exercises yet. Add some below.</p>
      )}

      {templateExercises.map((te) => (
        <div key={te.id} className="template-exercise-item">
          <GripVertical size={16} className="grip-icon" />
          <span className="te-name">{te.exercise?.name ?? 'Unknown'}</span>
          <span className="te-sets">{te.default_sets} sets</span>
          <button
            className="btn-icon-small danger"
            onClick={() => removeExerciseFromTemplate(te.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* Add exercise controls */}
      <div className="add-exercise-section">
        {availableExercises.length > 0 && (
          <div className="add-existing">
            <select
              value={selectedExId}
              onChange={(e) => setSelectedExId(e.target.value)}
              className="select-field"
            >
              <option value="">Select exercise...</option>
              {availableExercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-outline btn-small"
              onClick={handleAddExisting}
              disabled={!selectedExId}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        )}

        {!showAdd ? (
          <button className="btn btn-outline btn-small" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> New Exercise
          </button>
        ) : (
          <div className="new-exercise-form">
            <input
              type="text"
              placeholder="Exercise name"
              value={newExName}
              onChange={(e) => setNewExName(e.target.value)}
              className="input-field"
              autoFocus
            />
            <input
              type="text"
              placeholder="Muscle group (optional)"
              value={newExMuscle}
              onChange={(e) => setNewExMuscle(e.target.value)}
              className="input-field"
            />
            <div className="form-actions">
              <button className="btn btn-primary btn-small" onClick={handleCreateAndAdd}>
                <Check size={14} /> Add
              </button>
              <button className="btn btn-outline btn-small" onClick={() => setShowAdd(false)}>
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { user } = useAuth();
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTemplates(
    user?.id
  );
  const { schedule, setDayTemplate } = useSchedule(user?.id);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  if (loading) return <LoadingSpinner message="Loading templates..." />;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const created = await createTemplate(newName.trim());
    setNewName('');
    setShowCreate(false);
    if (created) setExpandedId(created.id);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;
    await updateTemplate(id, editName.trim());
    setEditingId(null);
  };

  const getDayTemplate = (day: DayOfWeek) => {
    const entry = schedule.find((s) => s.day_of_week === day);
    return entry?.template_id ?? '';
  };

  return (
    <div className="page">
      <AppHeader title="Workout Splits" />

      {/* Template list */}
      <div className="template-list">
        {templates.map((t) => (
          <div key={t.id} className="template-card">
            <div className="template-card-header" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
              <div className="template-card-title">
                {editingId === t.id ? (
                  <div className="inline-edit" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(t.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button className="btn-icon-small" onClick={() => handleSaveRename(t.id)}>
                      <Check size={14} />
                    </button>
                    <button className="btn-icon-small" onClick={() => setEditingId(null)}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <h3>{t.name}</h3>
                )}
              </div>
              <div className="template-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon-small"
                  onClick={() => {
                    setEditingId(t.id);
                    setEditName(t.name);
                  }}
                >
                  <Edit3 size={14} />
                </button>
                <button className="btn-icon-small danger" onClick={() => deleteTemplate(t.id)}>
                  <Trash2 size={14} />
                </button>
                {expandedId === t.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {expandedId === t.id && user && (
              <TemplateDetail templateId={t.id} userId={user.id} />
            )}
          </div>
        ))}
      </div>

      {/* Create new */}
      {showCreate ? (
        <div className="create-template-form">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name (e.g., Push)"
            className="input-field"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
          />
          <div className="form-actions">
            <button className="btn btn-primary btn-small" onClick={handleCreate}>
              Create
            </button>
            <button className="btn btn-outline btn-small" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary btn-full" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> New Split Template
        </button>
      )}

      {/* Weekly Schedule */}
      <section className="section" style={{ marginTop: '1.5rem' }}>
        <div
          className="section-title-row"
          onClick={() => setShowSchedule(!showSchedule)}
          style={{ cursor: 'pointer' }}
        >
          <h3 className="section-title">Weekly Schedule</h3>
          {showSchedule ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>

        {showSchedule && (
          <div className="schedule-grid">
            {([0, 1, 2, 3, 4, 5, 6] as DayOfWeek[]).map((day) => (
              <div key={day} className="schedule-row">
                <span className="schedule-day">{DAY_NAMES[day]}</span>
                <select
                  className="select-field"
                  value={getDayTemplate(day)}
                  onChange={(e) =>
                    setDayTemplate(day, e.target.value || null)
                  }
                >
                  <option value="">Rest Day</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
