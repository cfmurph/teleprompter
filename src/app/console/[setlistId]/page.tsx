"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronUp,
  ChevronDown,
  Monitor,
  Music,
  Plus,
  Trash2,
  GripVertical,
  ExternalLink,
  ChevronRight,
  Settings,
  Minus,
  Hash,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ConsoleCommand, Script } from "@/lib/types";
import { useBroadcastSender } from "@/lib/broadcast";
import { ALL_KEYS, transposeKey, transposeLabel } from "@/lib/chord-utils";
import { Button } from "@/components/ui/button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KEY_COLORS: Record<string, string> = {
  C: "bg-red-500/20 text-red-300", "C#": "bg-orange-500/20 text-orange-300",
  D: "bg-yellow-500/20 text-yellow-300", Eb: "bg-lime-500/20 text-lime-300",
  E: "bg-green-500/20 text-green-300", F: "bg-teal-500/20 text-teal-300",
  "F#": "bg-cyan-500/20 text-cyan-300", G: "bg-blue-500/20 text-blue-300",
  Ab: "bg-indigo-500/20 text-indigo-300", A: "bg-violet-500/20 text-violet-300",
  Bb: "bg-purple-500/20 text-purple-300", B: "bg-pink-500/20 text-pink-300",
};

function KeyBadge({ songKey, transpose }: { songKey?: string; transpose: number }) {
  if (!songKey) return null;
  const displayed = transposeKey(songKey, transpose);
  const color = KEY_COLORS[displayed] || "bg-zinc-500/20 text-zinc-300";
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {displayed}
    </span>
  );
}

// ─── Setlist sidebar ──────────────────────────────────────────────────────────

function SetlistSidebar({
  setlistId,
  activeScriptId,
  transpose,
  onSelectScript,
  onSend,
}: {
  setlistId: string;
  activeScriptId: string | null;
  transpose: number;
  onSelectScript: (id: string) => void;
  onSend: (cmd: ConsoleCommand) => void;
}) {
  const { setlists, scripts, removeScriptFromSetlist, reorderSetlist, updateSetlist } = useStore();
  const setlist = setlists[setlistId];
  if (!setlist) return null;

  const songs = setlist.scriptIds
    .map((id) => scripts[id])
    .filter(Boolean) as Script[];

  function moveUp(idx: number) {
    if (idx === 0) return;
    const ids = [...setlist.scriptIds];
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderSetlist(setlistId, ids);
  }

  function moveDown(idx: number) {
    if (idx === songs.length - 1) return;
    const ids = [...setlist.scriptIds];
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderSetlist(setlistId, ids);
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Setlist header */}
      <div className="p-3 border-b border-zinc-800 space-y-1">
        <input
          className="w-full bg-transparent text-sm font-bold text-white focus:outline-none placeholder:text-zinc-600"
          value={setlist.name}
          onChange={(e) => updateSetlist(setlistId, { name: e.target.value })}
          placeholder="Setlist name"
        />
        <div className="flex gap-2">
          <input
            className="flex-1 bg-transparent text-xs text-zinc-500 focus:outline-none"
            value={setlist.date}
            onChange={(e) => updateSetlist(setlistId, { date: e.target.value })}
            type="date"
          />
          <input
            className="flex-1 bg-transparent text-xs text-zinc-500 focus:outline-none placeholder:text-zinc-700"
            value={setlist.venue}
            onChange={(e) => updateSetlist(setlistId, { venue: e.target.value })}
            placeholder="Venue"
          />
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-8 px-3">
            No songs yet. Add songs from the library below.
          </p>
        )}
        {songs.map((song, idx) => {
          const isActive = song.id === activeScriptId;
          return (
            <div
              key={song.id}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-zinc-900 transition-colors ${
                isActive
                  ? "bg-blue-600/20 border-l-2 border-l-blue-500"
                  : "hover:bg-zinc-900"
              }`}
              onClick={() => {
                onSelectScript(song.id);
                onSend({ type: "GOTO_SCRIPT", scriptId: song.id });
              }}
            >
              {/* Index */}
              <span className="text-[10px] text-zinc-600 w-5 text-right shrink-0 font-mono">
                {idx + 1}
              </span>

              {/* Title + key */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium truncate ${isActive ? "text-white" : "text-zinc-300"}`}>
                    {song.title}
                  </span>
                  <KeyBadge songKey={song.key} transpose={transpose} />
                </div>
                {song.bpm && (
                  <span className="text-[10px] text-zinc-600">{song.bpm} BPM</span>
                )}
              </div>

              {/* Reorder + remove */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); moveUp(idx); }} className="text-zinc-600 hover:text-zinc-300 p-0.5">
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveDown(idx); }} className="text-zinc-600 hover:text-zinc-300 p-0.5">
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeScriptFromSetlist(setlistId, song.id); }} className="text-zinc-600 hover:text-red-400 p-0.5">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add song picker */}
      <AddSongPicker setlistId={setlistId} existingIds={setlist.scriptIds} />
    </div>
  );
}

function AddSongPicker({ setlistId, existingIds }: { setlistId: string; existingIds: string[] }) {
  const { scripts, addScriptToSetlist } = useStore();
  const [open, setOpen] = useState(false);
  const available = Object.values(scripts).filter((s) => !existingIds.includes(s.id));

  return (
    <div className="border-t border-zinc-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add song to setlist
      </button>
      {open && (
        <div className="max-h-48 overflow-y-auto bg-zinc-900 border-t border-zinc-800">
          {available.length === 0 && (
            <p className="text-xs text-zinc-600 px-3 py-2">All scripts are already in this setlist</p>
          )}
          {available.map((s) => (
            <button
              key={s.id}
              onClick={() => { addScriptToSetlist(setlistId, s.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <Music className="h-3 w-3 text-zinc-600 shrink-0" />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section navigator ────────────────────────────────────────────────────────

function SectionNavigator({
  script,
  currentSectionIndex,
  onJump,
}: {
  script: Script;
  currentSectionIndex: number;
  onJump: (idx: number) => void;
}) {
  const SECTION_COLORS: Record<string, string> = {
    intro: "text-violet-400", verse: "text-blue-400", "pre-chorus": "text-cyan-400",
    chorus: "text-emerald-400", bridge: "text-amber-400", outro: "text-rose-400",
    solo: "text-orange-400", spoken: "text-pink-400", custom: "text-zinc-400",
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-3 border-b border-zinc-800 bg-zinc-950">
      {script.sections.map((sec, idx) => (
        <button
          key={sec.id}
          onClick={() => onJump(idx)}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all border ${
            idx === currentSectionIndex
              ? "bg-blue-600 text-white border-blue-500"
              : `border-zinc-800 bg-zinc-900 hover:bg-zinc-800 ${SECTION_COLORS[sec.type] || "text-zinc-400"}`
          }`}
        >
          {sec.label}
        </button>
      ))}
    </div>
  );
}

// ─── Transport controls ───────────────────────────────────────────────────────

function TransportBar({
  isPlaying,
  transpose,
  songKey,
  onSend,
  onTogglePlay,
  onTransposeChange,
}: {
  isPlaying: boolean;
  transpose: number;
  songKey?: string;
  onSend: (cmd: ConsoleCommand) => void;
  onTogglePlay: () => void;
  onTransposeChange: (steps: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
      {/* Prev song */}
      <button onClick={() => onSend({ type: "PREV_SCRIPT" })} className="text-zinc-400 hover:text-white transition-colors">
        <SkipBack className="h-4 w-4" />
      </button>

      {/* Prev section */}
      <button onClick={() => onSend({ type: "PREV_SECTION" })} className="text-zinc-400 hover:text-white transition-colors">
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Play/pause */}
      <button
        onClick={onTogglePlay}
        className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 transition-colors"
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
      </button>

      {/* Next section */}
      <button onClick={() => onSend({ type: "NEXT_SECTION" })} className="text-zinc-400 hover:text-white transition-colors">
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Next song */}
      <button onClick={() => onSend({ type: "NEXT_SCRIPT" })} className="text-zinc-400 hover:text-white transition-colors">
        <SkipForward className="h-4 w-4" />
      </button>

      <div className="flex-1" />

      {/* Key transposition */}
      <div className="flex items-center gap-2 bg-zinc-900 rounded-xl px-3 py-1.5">
        <Hash className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-400 w-24 text-center">
          {songKey ? (
            <>
              <span className="font-bold text-white">{transposeKey(songKey, transpose)}</span>
              {transpose !== 0 && <span className="text-zinc-500 ml-1">{transposeLabel(transpose)}</span>}
            </>
          ) : transposeLabel(transpose)}
        </span>
        <button onClick={() => { const n = transpose - 1; onTransposeChange(n); onSend({ type: "SET_TRANSPOSE", steps: n }); }} className="text-zinc-400 hover:text-white">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { const n = transpose + 1; onTransposeChange(n); onSend({ type: "SET_TRANSPOSE", steps: n }); }} className="text-zinc-400 hover:text-white">
          <Plus className="h-3.5 w-3.5" />
        </button>
        {transpose !== 0 && (
          <button onClick={() => { onTransposeChange(0); onSend({ type: "SET_TRANSPOSE", steps: 0 }); }} className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-1">
            reset
          </button>
        )}
      </div>

      {/* Open display */}
      <a
        href={`/perform/display?setlist=${encodeURIComponent("")}`}
        target="_blank"
        rel="noopener"
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg px-3 py-1.5 transition-colors"
        title="Open Artist Display in new window"
      >
        <Monitor className="h-3.5 w-3.5" />
        <span className="hidden lg:block">Open Display</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

// ─── Live editor ──────────────────────────────────────────────────────────────

function LiveEditor({ script, setlistId }: { script: Script; setlistId: string }) {
  const { updateScript, updateSection } = useStore();
  const [activeSection, setActiveSection] = useState(0);
  const sec = script.sections[activeSection];

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-950 shrink-0">
        {script.sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(i)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
              i === activeSection
                ? "border-blue-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {sec && (
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="mb-2 flex items-center gap-2">
            <input
              className="text-sm font-semibold bg-transparent text-zinc-300 focus:outline-none flex-1"
              value={sec.label}
              onChange={(e) => updateSection(script.id, sec.id, { label: e.target.value })}
            />
          </div>
          <textarea
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[200px]"
            value={sec.content}
            onChange={(e) => updateSection(script.id, sec.id, { content: e.target.value })}
            placeholder="Type lyrics here. Use [G] [Am] notation for chords."
            rows={10}
          />
          <p className="text-[10px] text-zinc-600 mt-1">
            Tip: Chords in [brackets] appear above lyrics on the artist display.
          </p>
        </div>
      )}

      {/* Song metadata */}
      <div className="border-t border-zinc-800 p-3 grid grid-cols-3 gap-2 bg-zinc-950 shrink-0">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Key</label>
          <select
            value={script.key || ""}
            onChange={(e) => updateScript(script.id, { key: e.target.value || undefined })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
          >
            <option value="">—</option>
            {ALL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">BPM</label>
          <input
            type="number"
            min={20}
            max={300}
            value={script.bpm || ""}
            onChange={(e) => updateScript(script.id, { bpm: parseInt(e.target.value) || undefined })}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
            placeholder="—"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Chords</label>
          <button
            onClick={() => updateScript(script.id, { hasChords: !script.hasChords })}
            className={`w-full py-1 rounded text-xs font-medium transition-colors ${
              script.hasChords ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {script.hasChords ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Console Page ─────────────────────────────────────────────────────────────

export default function ConsolePage({
  params,
}: {
  params: Promise<{ setlistId: string }>;
}) {
  const { setlistId } = use(params);
  const router = useRouter();
  const {
    setlists, scripts,
    activeScriptId, setActiveScript,
    currentSectionIndex, setCurrentSection,
    nextSection, prevSection,
    transposeSteps, setTranspose,
    updatePerformSettings,
  } = useStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const { send } = useBroadcastSender(setlistId);

  const setlist = setlists[setlistId];
  const activeScript = activeScriptId ? scripts[activeScriptId] : null;

  // Auto-select first song if none selected
  useEffect(() => {
    if (!activeScriptId && setlist?.scriptIds.length) {
      setActiveScript(setlist.scriptIds[0]);
    }
  }, [setlist, activeScriptId]);

  const dispatch = useCallback(
    (cmd: ConsoleCommand) => {
      send(cmd);
      // Also update local store so the console reflects current state
      switch (cmd.type) {
        case "GOTO_SCRIPT":
          setActiveScript(cmd.scriptId);
          setCurrentSection(0);
          break;
        case "GOTO_SECTION":
          setCurrentSection(cmd.index);
          break;
        case "NEXT_SECTION":
          nextSection();
          break;
        case "PREV_SECTION":
          prevSection();
          break;
        case "NEXT_SCRIPT": {
          if (!setlist) break;
          const idx = setlist.scriptIds.indexOf(activeScriptId || "");
          if (idx < setlist.scriptIds.length - 1) {
            const next = setlist.scriptIds[idx + 1];
            setActiveScript(next);
            setCurrentSection(0);
          }
          break;
        }
        case "PREV_SCRIPT": {
          if (!setlist) break;
          const idx = setlist.scriptIds.indexOf(activeScriptId || "");
          if (idx > 0) {
            const prev = setlist.scriptIds[idx - 1];
            setActiveScript(prev);
            setCurrentSection(0);
          }
          break;
        }
        case "SET_TRANSPOSE":
          setTranspose(cmd.steps);
          break;
        case "PLAY_PAUSE":
          setIsPlaying((v) => !v);
          break;
      }
    },
    [send, setlist, activeScriptId, setActiveScript, setCurrentSection, nextSection, prevSection, setTranspose]
  );

  function openDisplay() {
    window.open(`/perform/display?setlist=${setlistId}`, "_blank", "width=1280,height=720,menubar=no,toolbar=no");
  }

  if (!setlist) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4">
        <p className="text-zinc-400">Setlist not found.</p>
        <Button variant="outline" onClick={() => router.push("/")}>Back to Library</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
      {/* Top header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <button onClick={() => router.push("/")} className="text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-sm">Operator Console</span>
        </div>
        <ChevronRight className="h-3 w-3 text-zinc-600" />
        <span className="text-sm text-zinc-400 truncate">{setlist.name}</span>
        <div className="flex-1" />
        <button
          onClick={openDisplay}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 transition-colors"
        >
          <Monitor className="h-3.5 w-3.5" />
          Open Artist Display
          <ExternalLink className="h-3 w-3" />
        </button>
      </header>

      {/* Main layout: sidebar | main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: setlist */}
        <div className="w-56 shrink-0 flex flex-col overflow-hidden border-r border-zinc-800">
          <SetlistSidebar
            setlistId={setlistId}
            activeScriptId={activeScriptId}
            transpose={transposeSteps}
            onSelectScript={(id) => dispatch({ type: "GOTO_SCRIPT", scriptId: id })}
            onSend={dispatch}
          />
        </div>

        {/* Right: controls + editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Transport */}
          <TransportBar
            isPlaying={isPlaying}
            transpose={transposeSteps}
            songKey={activeScript?.key}
            onSend={dispatch}
            onTogglePlay={() => { setIsPlaying((v) => !v); dispatch({ type: "PLAY_PAUSE" }); }}
            onTransposeChange={setTranspose}
          />

          {/* Section nav */}
          {activeScript && (
            <SectionNavigator
              script={activeScript}
              currentSectionIndex={currentSectionIndex}
              onJump={(idx) => dispatch({ type: "GOTO_SECTION", index: idx })}
            />
          )}

          {/* Live editor */}
          <div className="flex-1 overflow-hidden">
            {activeScript ? (
              <LiveEditor script={activeScript} setlistId={setlistId} />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                Select a song from the setlist
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
