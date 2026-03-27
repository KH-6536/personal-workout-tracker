import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, X } from 'lucide-react';

const TIMER_PRESETS = [60, 90, 120, 150, 180, 300];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RestTimer({
  onClose,
}: {
  onClose: () => void;
}) {
  const [duration, setDuration] = useState(120); // default 2 min
  const [remaining, setRemaining] = useState(120);
  const [isRunning, setIsRunning] = useState(true); // auto-start
  const [isFinished, setIsFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // Countdown logic
  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsFinished(true);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remaining]);

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      const ctx = audioRef.current;
      // Play 3 short beeps
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + i * 0.2);
        osc.stop(ctx.currentTime + i * 0.2 + 0.15);
      }
    } catch {
      // Audio not available
    }
  }, []);

  const togglePause = useCallback(() => {
    if (isFinished) return;
    setIsRunning((prev) => !prev);
  }, [isFinished]);

  const resetTimer = useCallback(() => {
    setRemaining(duration);
    setIsRunning(true);
    setIsFinished(false);
  }, [duration]);

  const adjustDuration = useCallback((delta: number) => {
    setDuration((prev) => {
      const next = Math.max(15, prev + delta);
      return next;
    });
    setRemaining((prev) => {
      const next = Math.max(15, prev + delta);
      return next;
    });
    setIsFinished(false);
    setIsRunning(true);
  }, []);

  const setPreset = useCallback((seconds: number) => {
    setDuration(seconds);
    setRemaining(seconds);
    setIsRunning(true);
    setIsFinished(false);
  }, []);

  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;
  const circumference = 2 * Math.PI * 54; // radius 54
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="rest-timer-overlay">
      <div className="rest-timer-card">
        <div className="rest-timer-header">
          <h3 className="rest-timer-title">Rest Timer</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Circular progress */}
        <div className="timer-circle-container">
          <svg className="timer-circle-svg" viewBox="0 0 120 120">
            <circle
              className="timer-circle-bg"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="6"
            />
            <circle
              className="timer-circle-progress"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
                transition: 'stroke-dashoffset 0.3s linear',
              }}
            />
          </svg>
          <div className={`timer-display ${isFinished ? 'timer-finished' : ''}`}>
            {formatTime(remaining)}
          </div>
        </div>

        {/* Adjust +/- 15s */}
        <div className="timer-adjust">
          <button className="btn btn-outline btn-small" onClick={() => adjustDuration(-15)}>
            <Minus size={14} /> 15s
          </button>
          <button className="timer-pause-btn" onClick={togglePause}>
            {isRunning ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button className="btn btn-outline btn-small" onClick={() => adjustDuration(15)}>
            <Plus size={14} /> 15s
          </button>
        </div>

        {/* Preset buttons */}
        <div className="timer-presets">
          {TIMER_PRESETS.map((sec) => (
            <button
              key={sec}
              className={`timer-preset-btn ${duration === sec ? 'active' : ''}`}
              onClick={() => setPreset(sec)}
            >
              {formatTime(sec)}
            </button>
          ))}
        </div>

        {/* Reset / Dismiss */}
        <div className="timer-actions">
          <button className="btn btn-outline btn-small" onClick={resetTimer}>
            <RotateCcw size={14} /> Reset
          </button>
          <button className="btn btn-primary btn-small" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
