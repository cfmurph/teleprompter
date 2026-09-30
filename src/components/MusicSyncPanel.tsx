"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Music,
  Radio,
  Mic,
  MicOff,
  Zap,
  Plus,
  Trash2,
  X,
  Volume2,
  ChevronRight,
} from "lucide-react";
import { TapTempo, bpmToScrollSpeed } from "@/lib/bpm-sync";
import { LTCDecoder, LTCTimecode, detectedToSmpteFps, resolveActiveCue } from "@/lib/ltc-decoder";
import type { SmpteCue } from "@/lib/types";
import { VoiceTracker, VoiceTrackState } from "@/lib/voice-track";
import { useStore } from "@/lib/store";

// ─── Tab type ─────────────────────────────────────────────────────────────────

type SyncTab = "bpm" | "smpte" | "voice";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MusicSyncPanelProps {
  scriptId: string;
  onScrollSpeedChange: (speed: number) => void;
  onSectionChange: (index: number) => void;
  onLineChange: (index: number) => void;
  onClose: () => void;
}

// ─── BPM Tab ─────────────────────────────────────────────────────────────────

function BpmTab({
  scriptId,
  onScrollSpeedChange,
}: {
  scriptId: string;
  onScrollSpeedChange: (speed: number) => void;
}) {
  const { scripts, performSettings, updatePerformSettings, updateScript } = useStore();
  const script = scripts[scriptId];
  const bpm = script?.bpm ?? 120;
  const [linesPerBeat, setLinesPerBeat] = useState(1);
  const [active, setActive] = useState(false);
  const tapRef = useRef(new TapTempo());

  function calcSpeed(b = bpm, l = linesPerBeat) {
    return bpmToScrollSpeed({
      bpm: b,
      fontSize: performSettings.fontSize,
      lineSpacing: performSettings.lineSpacing,
      linesPerBeat: l,
    });
  }

  function apply(b = bpm, l = linesPerBeat) {
    const speed = calcSpeed(b, l);
    onScrollSpeedChange(speed);
    updatePerformSettings({ scrollSpeed: speed });
  }

  function setBpmValue(v: number) {
    const next = Math.max(20, Math.min(300, v));
    updateScript(scriptId, { bpm: next });
    if (active) apply(next, linesPerBeat);
  }

  function handleTap() {
    const result = tapRef.current.tap();
    if (result) setBpmValue(result);
  }

  function toggle() {
    if (active) {
      setActive(false);
    } else {
      setActive(true);
      apply();
    }
  }

  const speed = calcSpeed();

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Lock scroll speed to a song's tempo. The prompter advances at exactly
        one line per beat, so lyrics arrive in time with the music.
      </p>

      {/* BPM input + tap */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Tempo (BPM)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={20}
            max={300}
            value={bpm}
            onChange={(e) => {
              setBpmValue(parseInt(e.target.value) || 120);
            }}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-mono"
          />
          <button
            onClick={handleTap}
            className="flex-1 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors active:scale-95"
          >
            Tap Tempo
          </button>
        </div>
        <input
          type="range"
          min={20}
          max={300}
          step={1}
          value={bpm}
          onChange={(e) => {
            setBpmValue(parseInt(e.target.value));
          }}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Lines per beat */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">
          Lines per beat — {linesPerBeat}×
        </label>
        <div className="flex gap-1">
          {[0.5, 1, 1.5, 2].map((v) => (
            <button
              key={v}
              onClick={() => {
                setLinesPerBeat(v);
                if (active) apply(bpm, v);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                linesPerBeat === v
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      {/* Calculated speed */}
      <div className="bg-zinc-800 rounded-lg p-3 text-center">
        <p className="text-xs text-zinc-500">Calculated scroll speed</p>
        <p className="text-xl font-mono text-white mt-0.5">
          {Math.round(speed)}{" "}
          <span className="text-xs text-zinc-400">px/s</span>
        </p>
      </div>

      {/* Toggle */}
      <button
        onClick={toggle}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
          active
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {active ? "✓ BPM Sync Active" : "Activate BPM Sync"}
      </button>
    </div>
  );
}

// ─── SMPTE Tab ────────────────────────────────────────────────────────────────

function SmpteTab({
  scriptId,
  onSectionChange,
}: {
  scriptId: string;
  onSectionChange: (index: number) => void;
}) {
  const { scripts, smpteSettings, setSmpteCues, updateSmpteSettings } = useStore();
  const script = scripts[scriptId];
  const cues = script?.smpteCues ?? [];
  const [listening, setListening] = useState(false);
  const [currentTc, setCurrentTc] = useState<LTCTimecode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const decoderRef = useRef<LTCDecoder | null>(null);
  const lastCueRef = useRef<string | null>(null);

  const handleFrame = useCallback(
    (tc: LTCTimecode) => {
      setCurrentTc(tc);
      const mapped = detectedToSmpteFps(tc.fps);
      if (smpteSettings.fpsAuto && mapped !== smpteSettings.fps) {
        updateSmpteSettings({ fps: mapped });
      }
      const fps = smpteSettings.fpsAuto ? mapped : smpteSettings.fps;
      const active = resolveActiveCue(tc, cues, fps);
      if (active && active.id !== lastCueRef.current) {
        lastCueRef.current = active.id;
        onSectionChange(active.sectionIndex);
      }
    },
    [cues, onSectionChange, smpteSettings.fps, smpteSettings.fpsAuto, updateSmpteSettings]
  );

  const frameRef = useRef(handleFrame);
  frameRef.current = handleFrame;

  async function toggleListen() {
    if (listening) {
      decoderRef.current?.stop();
      decoderRef.current = null;
      setListening(false);
      setCurrentTc(null);
      return;
    }

    try {
      const decoder = new LTCDecoder((tc) => frameRef.current(tc));
      await decoder.start();
      decoderRef.current = decoder;
      setListening(true);
      setError(null);
    } catch {
      setError("Could not access audio input. Check microphone permissions.");
    }
  }

  useEffect(() => {
    return () => {
      decoderRef.current?.stop();
    };
  }, []);

  function addCue() {
    const tc = currentTc ? currentTc.raw : "00:00:00:00";
    setSmpteCues(scriptId, [
      ...cues,
      {
        id: crypto.randomUUID(),
        timecode: tc,
        sectionIndex: 0,
        label: script?.sections[0]?.label ?? "Section 1",
      },
    ]);
  }

  function updateCue(id: string, updates: Partial<SmpteCue>) {
    setSmpteCues(
      scriptId,
      cues.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  function deleteCue(id: string) {
    setSmpteCues(
      scriptId,
      cues.filter((c) => c.id !== id)
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Listens for SMPTE LTC timecode on the audio input (mic/line-in) and
        automatically jumps to the correct section when the timecode hits a cue.
      </p>

      {/* Audio input indicator */}
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
          listening
            ? "border-green-500/50 bg-green-500/10"
            : "border-zinc-700 bg-zinc-800"
        }`}
      >
        <div
          className={`w-3 h-3 rounded-full ${
            listening ? "bg-green-400 animate-pulse" : "bg-zinc-600"
          }`}
        />
        <div className="flex-1">
          <p className="text-xs font-medium text-white">
            {listening ? "Listening for LTC…" : "Audio Input"}
          </p>
          {currentTc && (
            <p className="text-lg font-mono text-green-400 mt-0.5">
              {currentTc.raw}
              <span className="text-xs text-zinc-400 ml-2">
                ~{currentTc.fps}fps
              </span>
            </p>
          )}
          {!currentTc && listening && (
            <p className="text-xs text-zinc-500">Waiting for signal…</p>
          )}
        </div>
        <button
          onClick={toggleListen}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            listening
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-zinc-700 text-white hover:bg-zinc-600"
          }`}
        >
          {listening ? "Stop" : "Start"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          {error}
        </p>
      )}

      {/* Cue list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-400 font-semibold">Cue List</label>
          <button
            onClick={addCue}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add Cue
          </button>
        </div>

        {cues.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">
            No cues yet. Add a cue to map timecodes to sections.
          </p>
        )}

        {cues.map((cue) => (
          <div
            key={cue.id}
            className="flex items-center gap-2 bg-zinc-800 rounded-lg p-2.5"
          >
            <input
              type="text"
              value={cue.timecode}
              onChange={(e) => updateCue(cue.id, { timecode: e.target.value })}
              placeholder="HH:MM:SS:FF"
              className="w-28 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-green-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" />
            <select
              value={cue.sectionIndex}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                updateCue(cue.id, {
                  sectionIndex: idx,
                  label: script?.sections[idx]?.label ?? "",
                });
              }}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
            >
              {script?.sections.map((sec, i) => (
                <option key={sec.id} value={i}>
                  {sec.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => deleteCue(cue.id)}
              className="text-zinc-600 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Tip: Route your DAW's LTC output to a free audio input on your device. 
        Disable noise suppression and echo cancellation on that input.
      </p>
    </div>
  );
}

// ─── Voice Tab ────────────────────────────────────────────────────────────────

function VoiceTab({
  scriptId,
  onLineChange,
}: {
  scriptId: string;
  onLineChange: (index: number) => void;
}) {
  const { scripts, currentSectionIndex } = useStore();
  const script = scripts[scriptId];
  const [state, setState] = useState<VoiceTrackState>({
    isListening: false,
    wordIndex: 0,
    lineIndex: 0,
    confidence: 0,
    transcript: "",
    error: null,
  });
  const trackerRef = useRef<VoiceTracker | null>(null);

  useEffect(() => {
    const tracker = new VoiceTracker((s) => {
      setState(s);
      onLineChange(s.lineIndex);
    });
    trackerRef.current = tracker;
    return () => {
      tracker.stop();
    };
  }, [onLineChange]);

  // Update content when section changes
  useEffect(() => {
    const section = script?.sections[currentSectionIndex];
    if (section && trackerRef.current) {
      trackerRef.current.setContent(section.content);
      trackerRef.current.resetPosition();
    }
  }, [script, currentSectionIndex]);

  const tracker = trackerRef.current;
  const isSupported = tracker?.isSupported ?? false;

  function toggle() {
    tracker?.toggle();
  }

  const currentSection = script?.sections[currentSectionIndex];
  const lines = currentSection?.content.split("\n") ?? [];
  const progress = lines.length > 0 ? (state.lineIndex / lines.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Your microphone listens as you speak. The prompter automatically
        highlights the line matching your current words in real time.
      </p>

      {!isSupported && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-xs text-amber-300">
            Voice tracking requires Chrome or Edge. Firefox and Safari are not supported.
          </p>
        </div>
      )}

      {/* Main toggle */}
      <button
        onClick={toggle}
        disabled={!isSupported}
        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          state.isListening
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {state.isListening ? (
          <>
            <MicOff className="h-4 w-4" /> Stop Voice Tracking
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" /> Start Voice Tracking
          </>
        )}
      </button>

      {/* Status */}
      {state.isListening && (
        <div className="space-y-3">
          {/* Mic indicator */}
          <div className="flex items-center gap-2 text-xs text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Listening…
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-500">
              <span>Section progress</span>
              <span>Line {state.lineIndex + 1} / {lines.length}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Live transcript */}
          {state.transcript && (
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-[10px] text-zinc-500 mb-1">Heard:</p>
              <p className="text-xs text-zinc-200 italic leading-relaxed">
                "{state.transcript.slice(-120)}"
              </p>
              {state.confidence > 0 && (
                <p className="text-[10px] text-zinc-600 mt-1">
                  Confidence: {Math.round(state.confidence * 100)}%
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {state.error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          {state.error}
        </p>
      )}

      <p className="text-[10px] text-zinc-600 leading-relaxed">
        Best used with Highlight or Arrow mode. Speak clearly and at a natural pace.
        The tracker will catch up if it falls behind.
      </p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function MusicSyncPanel({
  scriptId,
  onScrollSpeedChange,
  onSectionChange,
  onLineChange,
  onClose,
}: MusicSyncPanelProps) {
  const [tab, setTab] = useState<SyncTab>("bpm");

  const TABS: { id: SyncTab; label: string; icon: React.ReactNode }[] = [
    { id: "bpm", label: "BPM", icon: <Music className="h-3.5 w-3.5" /> },
    { id: "smpte", label: "SMPTE", icon: <Radio className="h-3.5 w-3.5" /> },
    { id: "voice", label: "Voice", icon: <Mic className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="absolute right-4 top-16 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-400" />
          <span className="font-semibold text-sm">Music Sync</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
              tab === id
                ? "text-blue-400 border-b-2 border-blue-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 max-h-[70vh] overflow-y-auto">
        {tab === "bpm" && (
          <BpmTab scriptId={scriptId} onScrollSpeedChange={onScrollSpeedChange} />
        )}
        {tab === "smpte" && (
          <SmpteTab scriptId={scriptId} onSectionChange={onSectionChange} />
        )}
        {tab === "voice" && (
          <VoiceTab scriptId={scriptId} onLineChange={onLineChange} />
        )}
      </div>
    </div>
  );
}
