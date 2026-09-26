import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Palette, Circle,
  Dumbbell, Brain, Phone, Utensils, Moon, BookOpen, Footprints, Coffee, Mail, NotebookPen,
  CalendarSync, RefreshCw, Link2, Link2Off, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTimeBlocks, iconForTitle } from '../hooks/useTimeBlocks';
import { useGcalConnection } from '../hooks/useGcalConnection';
import { AppHeader } from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import type { TimeBlockWithCategory, BlockCategory, GcalConnection } from '../types/database';
import { addDays, format, formatDistanceToNow, isSameDay } from 'date-fns';

// Map the icon-name strings we persist to actual lucide components.
const ICON_MAP: Record<string, LucideIcon> = {
  Dumbbell, Brain, Phone, Utensils, Moon, BookOpen, Footprints, Coffee, Mail, NotebookPen, Circle,
};

const ICON_CHOICES: string[] = [
  'Dumbbell', 'Brain', 'Phone', 'Utensils', 'Moon',
  'BookOpen', 'Footprints', 'Coffee', 'Mail', 'NotebookPen', 'Circle',
];

const COLOR_CHOICES: string[] = [
  '#22c55e', '#3b82f6', '#a855f7', '#f97316',
  '#ec4899', '#14b8a6', '#eab308', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f59e0b', '#64748b',
];

// YYYY-MM-DD in local time
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "13:45:00" -> "1:45 PM"
function fmtTime(t: string): string {
  const [hh, mm] = t.split(':');
  const h = Number(hh);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${period}`;
}

// Duration in minutes between two HH:MM:SS strings.
function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const dateStr = ymd(anchorDate);

  const {
    blocks, categories, loading,
    createBlock, updateBlock, deleteBlock, toggleComplete, updateCategory,
    refetch,
  } = useTimeBlocks(user?.id, dateStr);
  const gcal = useGcalConnection(user?.id);

  const [showAdd, setShowAdd] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlockWithCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<BlockCategory | null>(null);
  const [showGcalModal, setShowGcalModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  // Track the id of a block that was JUST completed so we can show the reward burst.
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const doneCount = blocks.filter((b) => b.completed_at).length;
  const totalCount = blocks.length;
  const isToday = isSameDay(anchorDate, new Date());

  const handleToggle = (block: TimeBlockWithCategory) => {
    const wasCompleted = !!block.completed_at;
    toggleComplete(block.id);
    if (!wasCompleted) {
      setCelebratingId(block.id);
      window.setTimeout(() => setCelebratingId((id) => (id === block.id ? null : id)), 900);
    }
  };

  const handleSync = async (icalUrl?: string) => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await gcal.sync(dateStr, icalUrl);
      const parts = [];
      if (result.added) parts.push(`+${result.added} new`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.removed) parts.push(`-${result.removed} removed`);
      setSyncMessage(parts.length ? parts.join(' · ') : `${result.event_count} events, nothing changed`);
      await refetch();
      setShowGcalModal(false);
    } catch (err) {
      setSyncMessage((err as Error).message);
    } finally {
      setSyncing(false);
      window.setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  return (
    <div className="page">
      <AppHeader title="Schedule" subtitle="Time blocks" />

      {/* Date navigator */}
      <div className="sched-datebar">
        <button
          className="sched-datebar-btn"
          onClick={() => setAnchorDate((d) => addDays(d, -1))}
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="sched-datebar-label"
          onClick={() => setAnchorDate(new Date())}
          title="Jump to today"
        >
          <span className="sched-datebar-day">{format(anchorDate, 'EEEE')}</span>
          <span className="sched-datebar-date">
            {isToday ? 'Today · ' : ''}{format(anchorDate, 'MMM d')}
          </span>
        </button>
        <button
          className="sched-datebar-btn"
          onClick={() => setAnchorDate((d) => addDays(d, 1))}
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Progress ring */}
      <div className="sched-progress">
        <ProgressRing done={doneCount} total={totalCount} />
        <div className="sched-progress-text">
          <div className="sched-progress-count">
            {doneCount} <span>of {totalCount}</span>
          </div>
          <div className="sched-progress-label">
            {totalCount === 0 ? 'No blocks yet' :
              doneCount === totalCount ? 'All done — nice work' :
              `${totalCount - doneCount} to go`}
          </div>
        </div>
      </div>

      <GcalConnectCard
        connection={gcal.connection}
        loading={gcal.loading}
        syncing={syncing}
        syncMessage={syncMessage}
        onConnect={() => setShowGcalModal(true)}
        onSync={() => handleSync()}
        onDisconnect={async () => {
          await gcal.disconnect();
          setSyncMessage('Disconnected');
          window.setTimeout(() => setSyncMessage(null), 3000);
        }}
      />

      {loading ? (
        <LoadingSpinner message="Loading schedule..." />
      ) : blocks.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <div className="sched-timeline">
          {blocks.map((block) => (
            <TimeBlockRow
              key={block.id}
              block={block}
              celebrating={celebratingId === block.id}
              onToggle={() => handleToggle(block)}
              onEditBlock={() => setEditingBlock(block)}
              onEditCategory={() => block.category && setEditingCategory(block.category)}
            />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add block">
        <Plus size={22} />
      </button>

      {showAdd && (
        <BlockModal
          initial={null}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSubmit={async (values) => {
            await createBlock(values);
            setShowAdd(false);
          }}
        />
      )}

      {editingBlock && (
        <BlockModal
          initial={editingBlock}
          categories={categories}
          onClose={() => setEditingBlock(null)}
          onSubmit={async (values) => {
            await updateBlock(editingBlock.id, values);
            setEditingBlock(null);
          }}
          onDelete={async () => {
            await deleteBlock(editingBlock.id);
            setEditingBlock(null);
          }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={async (updates) => {
            await updateCategory(editingCategory.id, updates);
            setEditingCategory(null);
          }}
        />
      )}

      {showGcalModal && (
        <GcalConnectModal
          initialUrl={gcal.connection?.ical_url ?? ''}
          syncing={syncing}
          errorMessage={syncMessage && !syncing ? syncMessage : null}
          onClose={() => setShowGcalModal(false)}
          onSave={(url) => handleSync(url)}
        />
      )}
    </div>
  );
}

// ============================================
// TimeBlockRow — a single row in the timeline
// ============================================
function TimeBlockRow({
  block,
  celebrating,
  onToggle,
  onEditBlock,
  onEditCategory,
}: {
  block: TimeBlockWithCategory;
  celebrating: boolean;
  onToggle: () => void;
  onEditBlock: () => void;
  onEditCategory: () => void;
}) {
  const color = block.category?.color ?? '#3b82f6';
  const iconName = block.category?.icon ?? iconForTitle(block.title);
  const Icon = ICON_MAP[iconName] ?? Circle;
  const isDone = !!block.completed_at;
  const mins = durationMinutes(block.start_time, block.end_time);

  // Row height scales with duration but with sensible floor/ceiling so a 15-min
  // block is still tappable and a 4h block doesn't dominate the viewport.
  const height = Math.max(72, Math.min(200, 60 + mins * 0.7));

  return (
    <div className={`sched-row ${isDone ? 'is-done' : ''} ${celebrating ? 'is-celebrating' : ''}`}>
      <div className="sched-row-time">
        <div className="sched-row-time-start">{fmtTime(block.start_time)}</div>
        <div className="sched-row-time-dur">{fmtDuration(mins)}</div>
      </div>

      <button
        className="sched-row-block"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
          minHeight: height,
        }}
        onClick={onEditBlock}
      >
        <button
          className="sched-row-icon"
          onClick={(e) => { e.stopPropagation(); onEditCategory(); }}
          title="Change color / icon for all blocks in this category"
          aria-label="Edit category"
        >
          <Icon size={22} />
        </button>
        <div className="sched-row-body">
          <div className="sched-row-title">{block.title}</div>
          {block.category && (
            <div className="sched-row-cat">{block.category.name}</div>
          )}
        </div>
      </button>

      <button
        className={`sched-check ${isDone ? 'checked' : ''}`}
        onClick={onToggle}
        aria-label={isDone ? 'Mark not done' : 'Mark done'}
        style={{ '--check-color': color } as React.CSSProperties}
      >
        {isDone && <Check size={18} strokeWidth={3} />}
        {celebrating && <span className="sched-check-burst" />}
      </button>
    </div>
  );
}

// ============================================
// Empty state
// ============================================
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="sched-empty">
      <div className="sched-empty-icon">
        <Circle size={40} />
      </div>
      <h3>No blocks for this day</h3>
      <p>Add a time block for what you're planning to do.</p>
      <button className="btn-primary" onClick={onAdd}>
        <Plus size={18} /> Add block
      </button>
    </div>
  );
}

// ============================================
// ProgressRing — SVG donut showing done/total
// ============================================
function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 56;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? done / total : 0;
  const dash = circumference * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="sched-ring">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--success)" strokeWidth={stroke}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 400ms ease' }}
      />
    </svg>
  );
}

// ============================================
// BlockModal — create / edit a time block
// ============================================
function BlockModal({
  initial,
  categories,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: TimeBlockWithCategory | null;
  categories: BlockCategory[];
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    start_time: string;
    end_time: string;
    category_name: string | null;
    notes: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [start, setStart] = useState(initial?.start_time?.slice(0, 5) ?? '09:00');
  const [end, setEnd] = useState(initial?.end_time?.slice(0, 5) ?? '10:00');
  const [category, setCategory] = useState(initial?.category_name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && end > start;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      category_name: category.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{initial ? 'Edit block' : 'New block'}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <label className="form-label">
            Title
            <input
              className="input"
              placeholder="e.g. Workout, Deep work, Lunch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <div className="sched-modal-row">
            <label className="form-label" style={{ flex: 1 }}>
              Start
              <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="form-label" style={{ flex: 1 }}>
              End
              <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="form-label">
            Category <span className="form-hint">shares color with other blocks by this name</span>
            <input
              className="input"
              list="sched-cat-list"
              placeholder={title || 'e.g. workout'}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="sched-cat-list">
              {categories.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </label>
          <label className="form-label">
            Notes
            <textarea
              className="input"
              rows={2}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-foot">
          {onDelete ? (
            <button className="btn-danger-outline" onClick={onDelete} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          ) : <span />}
          <div className="modal-foot-right">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={!canSave || saving}>
              {saving ? 'Saving...' : initial ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// CategoryModal — edit color/icon for a category
// (changes propagate to every block sharing this category)
// ============================================
function CategoryModal({
  category,
  onClose,
  onSave,
}: {
  category: BlockCategory;
  onClose: () => void;
  onSave: (updates: { color?: string; icon?: string | null }) => Promise<void>;
}) {
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon ?? 'Circle');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ color, icon });
    setSaving(false);
  };

  const PreviewIcon = ICON_MAP[icon] ?? Circle;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Edit "{category.name}"</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="sched-cat-preview" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}>
            <PreviewIcon size={22} />
            <span>{category.name}</span>
          </div>
          <div className="form-label">
            <span>Color <span className="form-hint">applies to every "{category.name}" block</span></span>
            <div className="sched-swatches">
              {COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  className={`sched-swatch ${c === color ? 'is-selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Set color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="form-label">
            <span>Icon</span>
            <div className="sched-iconpick">
              {ICON_CHOICES.map((name) => {
                const I = ICON_MAP[name] ?? Circle;
                return (
                  <button
                    key={name}
                    className={`sched-iconpick-btn ${name === icon ? 'is-selected' : ''}`}
                    onClick={() => setIcon(name)}
                    aria-label={name}
                    style={name === icon ? { borderColor: color, color } : undefined}
                  >
                    <I size={18} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <Palette size={14} color="var(--text-muted)" />
          <div className="modal-foot-right">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// GcalConnectCard — inline banner shown above the timeline
// ============================================
function GcalConnectCard({
  connection,
  loading,
  syncing,
  syncMessage,
  onConnect,
  onSync,
  onDisconnect,
}: {
  connection: GcalConnection | null;
  loading: boolean;
  syncing: boolean;
  syncMessage: string | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  if (loading) return null;

  if (!connection) {
    return (
      <button className="sched-gcal-card sched-gcal-connect" onClick={onConnect}>
        <CalendarSync size={18} />
        <div className="sched-gcal-text">
          <div className="sched-gcal-title">Connect Google Calendar</div>
          <div className="sched-gcal-sub">Pull events for the day into your schedule</div>
        </div>
        <Link2 size={16} />
      </button>
    );
  }

  const lastSyncLabel = connection.last_synced_at
    ? `Synced ${formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}`
    : 'Not synced yet';

  return (
    <div className={`sched-gcal-card sched-gcal-connected ${connection.last_error ? 'has-error' : ''}`}>
      <CalendarSync size={18} />
      <div className="sched-gcal-text">
        <div className="sched-gcal-title">Google Calendar</div>
        <div className="sched-gcal-sub">
          {connection.last_error ? (
            <span className="sched-gcal-error">
              <AlertTriangle size={12} /> {connection.last_error}
            </span>
          ) : syncMessage ? (
            <span className="sched-gcal-flash">{syncMessage}</span>
          ) : (
            lastSyncLabel
          )}
        </div>
      </div>
      <button
        className="sched-gcal-btn"
        onClick={onSync}
        disabled={syncing}
        aria-label="Sync now"
        title="Sync now"
      >
        <RefreshCw size={16} className={syncing ? 'sched-spin' : ''} />
      </button>
      <button
        className="sched-gcal-btn"
        onClick={onDisconnect}
        disabled={syncing}
        aria-label="Disconnect"
        title="Disconnect"
      >
        <Link2Off size={16} />
      </button>
    </div>
  );
}

// ============================================
// GcalConnectModal — paste your iCal URL
// ============================================
function GcalConnectModal({
  initialUrl,
  syncing,
  errorMessage,
  onClose,
  onSave,
}: {
  initialUrl: string;
  syncing: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSave: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const canSave = url.trim().startsWith('https://') && !syncing;

  return (
    <div className="modal-backdrop" onClick={syncing ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Connect Google Calendar</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close" disabled={syncing}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p className="sched-gcal-help">
            In Google Calendar: <strong>Settings → your calendar → "Secret address in
            iCal format"</strong>. Copy that URL and paste it below. It's private to
            you — treat it like a password.
          </p>
          <label className="form-label">
            iCal URL
            <input
              className="input"
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          </label>
          {errorMessage && (
            <div className="sched-gcal-error-box">
              <AlertTriangle size={14} /> {errorMessage}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <span />
          <div className="modal-foot-right">
            <button className="btn-ghost" onClick={onClose} disabled={syncing}>Cancel</button>
            <button className="btn-primary" onClick={() => onSave(url.trim())} disabled={!canSave}>
              {syncing ? 'Syncing...' : 'Save & sync'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
