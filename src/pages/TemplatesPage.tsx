import { useState } from 'react';
import { Plus, Trash2, Edit3, X, Check, ChevronDown, ChevronUp, GripVertical, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTemplates, useTemplateExercises } from '../hooks/useTemplates';
import { useExercises } from '../hooks/useExercises';
import { useSchedule } from '../hooks/useSchedule';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { DAY_NAMES, type DayOfWeek } from '../types/database';
import { PRESET_EXERCISES, MUSCLE_GROUPS } from '../lib/exercises';

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
  const [showPicker, setShowPicker] = useState(false);
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customMuscle, setCustomMuscle] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  // Names already in this template
  const templateExerciseNames = new Set(
    templateExercises.map((te) => te.exercise?.name?.toLowerCase())
  );

  // Filter presets by muscle group and search, excluding already-added
  const filteredPresets = PRESET_EXERCISES.filter((p) => {
    if (templateExerciseNames.has(p.name.toLowerCase())) return false;
    if (muscleFilter !== 'All' && p.muscleGroup !== muscleFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handlePickPreset = async (name: string, muscleGroup: string) => {
    setAdding(name);
    try {
      // Check if exercise already exists in user's library
      const existing = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
      let exerciseId: string;

      if (existing) {
        exerciseId = existing.id;
      } else {
        const created = await addExercise(name, muscleGroup);
        if (!created) return;
        exerciseId = created.id;
      }

      const nextOrder = templateExercises.length;
      await addExerciseToTemplate(exerciseId, nextOrder);
    } finally {
      setAdding(null);
    }
  };

  const handleAddCustom = async () => {
    if (!customName.trim()) return;
    setAdding(customName);
    try {
      const ex = await addExercise(customName.trim(), customMuscle.trim() || undefined);
      if (ex) {
        const nextOrder = templateExercises.length;
        await addExerciseToTemplate(ex.id, nextOrder);
      }
      setCustomName('');
      setCustomMuscle('');
      setShowCustom(false);
    } finally {
      setAdding(null);
    }
  };

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

      {/* Add exercise */}
      {!showPicker ? (
        <button
          className="btn btn-outline btn-full"
          style={{ marginTop: '0.75rem' }}
          onClick={() => setShowPicker(true)}
        >
          <Plus size={16} /> Add Exercise
        </button>
      ) : (
        <div className="exercise-picker">
          {/* Search bar */}
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
            <button className="btn-icon-small" onClick={() => { setShowPicker(false); setSearchQuery(''); setMuscleFilter('All'); }}>
              <X size={16} />
            </button>
          </div>

          {/* Muscle group filter chips */}
          <div className="picker-filters">
            <button
              className={`filter-chip ${muscleFilter === 'All' ? 'active' : ''}`}
              onClick={() => setMuscleFilter('All')}
            >
              All
            </button>
            {MUSCLE_GROUPS.map((mg) => (
              <button
                key={mg}
                className={`filter-chip ${muscleFilter === mg ? 'active' : ''}`}
                onClick={() => setMuscleFilter(mg)}
              >
                {mg}
              </button>
            ))}
          </div>

          {/* Exercise list */}
          <div className="picker-list">
            {filteredPresets.map((p) => (
              <button
                key={p.name}
                className="picker-item"
                onClick={() => handlePickPreset(p.name, p.muscleGroup)}
                disabled={adding !== null}
              >
                <span className="picker-item-name">
                  {adding === p.name ? 'Adding...' : p.name}
                </span>
                <span className="picker-item-group">{p.muscleGroup}</span>
              </button>
            ))}
            {filteredPresets.length === 0 && (
              <p className="empty-text" style={{ padding: '0.75rem 0' }}>
                No matching exercises.
              </p>
            )}
          </div>

          {/* Custom exercise option */}
          {!showCustom ? (
            <button
              className="btn btn-outline btn-small"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setShowCustom(true)}
            >
              <Plus size={14} /> Custom Exercise
            </button>
          ) : (
            <div className="new-exercise-form">
              <input
                type="text"
                placeholder="Exercise name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="input-field"
                autoFocus
              />
              <select
                value={customMuscle}
                onChange={(e) => setCustomMuscle(e.target.value)}
                className="select-field"
              >
                <option value="">Muscle group (optional)</option>
                {MUSCLE_GROUPS.map((mg) => (
                  <option key={mg} value={mg}>{mg}</option>
                ))}
              </select>
              <div className="form-actions">
                <button className="btn btn-primary btn-small" onClick={handleAddCustom} disabled={adding !== null}>
                  <Check size={14} /> Add
                </button>
                <button className="btn btn-outline btn-small" onClick={() => setShowCustom(false)}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
