"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  Monitor,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ConsoleCommand, FontFamily, Script, SmpteFps } from "@/lib/types";
import { useBroadcastSender } from "@/lib/broadcast";
import { stripChords } from "@/lib/chord-utils";
import { TapTempo, bpmToScrollSpeed, clampBpm } from "@/lib/bpm-sync";
import { DurationField } from "@/components/DurationField";
import {
  capElapsed,
  clockFromElapsed,
  countLyricLines,
  durationFromBpm,
  elapsedForLine,
  formatDurationInput,
  formatRemainingLabel,
  lineAtElapsed,
  parseDurationInput,
  remapPlayback,
  resolveSongSync,
  shouldBroadcastClock,
  usesInternalClock,
  elapsedAfterSongChange,
} from "@/lib/song-sync";
import { gotoLineCommand, gotoScriptCommand, smpteLockCommand } from "@/lib/console-commands";
import {
  LTCDecoder,
  LTCTimecode,
  SMPTE_RATES,
  detectedToSmpteFps,
  formatSmpte,
  resolveActiveCue,
  supportsDropFrame,
  timecodeToFrames,
  trueFps,
} from "@/lib/ltc-decoder";
import { SmpteTimeline } from "@/components/SmpteTimeline";

const FPS_CHIPS: { label: string; fpsAuto: boolean; fps?: SmpteFps }[] = [
  { label: "Auto", fpsAuto: true },
  ...SMPTE_RATES.map((fps) => ({ label: String(fps), fpsAuto: false, fps })),
];

const LINES_PER_BEAT = [0.5, 1, 1.5, 2] as const;

type SyncMode = "bpm" | "smpte";

// ─── Script line flattening ───────────────────────────────────────────────────

type ScriptRow = {
  key: string;
  sectionIndex: number;
  lineIndex: number;
  text: string;
  isHeader: boolean;
};

function flattenScript(script: Script): ScriptRow[] {
  const rows: ScriptRow[] = [];
  script.sections.forEach((sec, si) => {
    rows.push({
      key: `${sec.id}-h`,
      sectionIndex: si,
      lineIndex: -1,
      text: sec.label,
      isHeader: true,
    });
    sec.content.split("\n").forEach((line, li) => {
      rows.push({
        key: `${sec.id}-${li}`,
        sectionIndex: si,
        lineIndex: li,
        text: line,
        isHeader: false,
      });
    });
  });
  return rows;
}

function BevelBtn({
  children,
  onClick,
  active = false,
  wide = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  wide?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 px-3 text-[14px] leading-none rounded-sm border shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ${
        active
          ? "bg-[#1e5aa8] border-[#3d7ad1] text-white"
          : "bg-[#5c5c5c] border-[#6e6e6e] text-zinc-100 hover:bg-[#6a6a6a]"
      } ${wide ? "flex-1" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Left: Catalog + Setlist ──────────────────────────────────────────────────

function LeftRail({
  setlistId,
  activeScriptId,
  onSelect,
}: {
  setlistId: string;
  activeScriptId: string | null;
  onSelect: (id: string) => void;
}) {
  const {
    scripts,
    setlists,
    addScriptToSetlist,
    removeScriptFromSetlist,
    reorderSetlist,
    updateSetlist,
    updateSongSync,
  } = useStore();
  const setlist = setlists[setlistId];
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  const catalog = useMemo(() => {
    const q = catalogQuery.toLowerCase();
    return Object.values(scripts)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [scripts, catalogQuery]);

  if (!setlist) return null;

  const songs = setlist.scriptIds.map((id) => scripts[id]).filter(Boolean) as Script[];

  function addSelected() {
    const id = selectedCatalogId;
    if (!id) return;
    addScriptToSetlist(setlistId, id);
  }

  function removeActive() {
    if (!activeScriptId) return;
    removeScriptFromSetlist(setlistId, activeScriptId);
  }

  return (
    <div className="w-full min-w-0 flex flex-col bg-[#3a3a3a] border-r border-black/40">
      <div className="px-2 pt-2 pb-1 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-200">Catalog</span>
        <span className="text-[10px] text-zinc-500">{catalog.length} files</span>
      </div>
      <div className="px-2 pb-2">
        <div className="flex items-center gap-1 bg-[#2b2b2b] border border-black/40 rounded-sm px-1.5 h-6">
          <Search className="h-3 w-3 text-zinc-500" />
          <input
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Filter"
            className="flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto border-t border-black/30">
        {catalog.map((s) => {
          const selected = s.id === selectedCatalogId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedCatalogId(s.id)}
              onDoubleClick={() => addScriptToSetlist(setlistId, s.id)}
              className={`w-full text-left px-2 py-[3px] text-[11px] truncate ${
                selected ? "bg-[#1e5aa8] text-white" : "text-zinc-200 hover:bg-white/5"
              }`}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      <div className="px-2 pt-2 pb-1 border-t border-black/40 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-200">Setlist</span>
        <span className="text-[10px] text-zinc-500">{songs.length} files</span>
      </div>
      <input
        value={setlist.name}
        onChange={(e) => updateSetlist(setlistId, { name: e.target.value })}
        className="mx-2 mb-1 bg-[#2b2b2b] border border-black/40 rounded-sm px-1.5 h-6 text-[11px] text-zinc-300 focus:outline-none"
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {songs.map((song, idx) => {
          const isActive = song.id === activeScriptId;
          const sync = resolveSongSync(setlist, song);
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => onSelect(song.id)}
              className={`w-full text-left px-2 py-[4px] text-[11px] flex items-center gap-1 ${
                isActive ? "bg-[#1e5aa8] text-white" : "text-zinc-200 hover:bg-white/5"
              }`}
            >
              <span className="w-4 text-[10px] text-zinc-500 shrink-0">{idx + 1}</span>
              <span className="truncate flex-1 min-w-0">{song.title}</span>
              <span className={`text-[10px] tabular-nums shrink-0 ${isActive ? "text-white/80" : "text-zinc-500"}`}>
                {sync.bpm} · {sync.durationMs ? formatDurationInput(sync.durationMs) : "--:--"}
              </span>
            </button>
          );
        })}
      </div>
      {activeScriptId && scripts[activeScriptId] && (
        <div className="px-2 py-1.5 border-t border-black/40 space-y-1 bg-[#333]">
          <div className="text-[10px] font-semibold text-zinc-400">Song sync</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-8">BPM</span>
            <input
              type="number"
              min={20}
              max={300}
              value={resolveSongSync(setlist, scripts[activeScriptId]).bpm}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v)) updateSongSync(setlistId, activeScriptId, { bpm: Math.max(20, Math.min(300, v)) });
              }}
              className="w-12 h-5 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[11px] text-white select-text focus:outline-none"
            />
            <span className="text-[10px] text-zinc-500 ml-1">Time</span>
            <DurationField
              valueMs={resolveSongSync(setlist, scripts[activeScriptId]).durationMs}
              onCommit={(raw) => {
                const ms = parseDurationInput(raw);
                if (ms != null) updateSongSync(setlistId, activeScriptId, { durationMs: ms });
              }}
              className="w-14 h-5 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[11px] text-white select-text focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const song = scripts[activeScriptId];
                if (!song) return;
                const sync = resolveSongSync(setlist, song);
                updateSongSync(setlistId, activeScriptId, {
                  durationMs: durationFromBpm(countLyricLines(song), sync.bpm, 1),
                });
              }}
              className="h-5 px-1 text-[9px] rounded-sm border bg-[#5c5c5c] border-[#6e6e6e] text-zinc-200"
            >
              from BPM
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-8">TC</span>
            <input
              value={resolveSongSync(setlist, scripts[activeScriptId]).smpteStart}
              onChange={(e) => updateSongSync(setlistId, activeScriptId, { smpteStart: e.target.value })}
              placeholder="00:00:00:00"
              className="flex-1 h-5 bg-[#1a1a1a] border border-black/50 rounded-sm px-1 font-mono text-[11px] text-green-400 select-text focus:outline-none"
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 p-1.5 border-t border-black/40">
        <BevelBtn onClick={addSelected} className="w-7 px-0">
          <Plus className="h-3 w-3 mx-auto" />
        </BevelBtn>
        <BevelBtn onClick={removeActive} className="w-7 px-0">
          <Minus className="h-3 w-3 mx-auto" />
        </BevelBtn>
        <BevelBtn
          onClick={() => {
            if (!activeScriptId) return;
            const idx = setlist.scriptIds.indexOf(activeScriptId);
            if (idx <= 0) return;
            const ids = [...setlist.scriptIds];
            [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
            reorderSetlist(setlistId, ids);
          }}
          className="w-7 px-0"
        >
          ↑
        </BevelBtn>
        <BevelBtn
          onClick={() => {
            if (!activeScriptId) return;
            const idx = setlist.scriptIds.indexOf(activeScriptId);
            if (idx < 0 || idx >= setlist.scriptIds.length - 1) return;
            const ids = [...setlist.scriptIds];
            [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
            reorderSetlist(setlistId, ids);
          }}
          className="w-7 px-0"
        >
          ↓
        </BevelBtn>
        <button
          type="button"
          onClick={removeActive}
          className="ml-auto text-zinc-500 hover:text-red-400"
          title="Remove from setlist"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Center preview ───────────────────────────────────────────────────────────

function PreviewStage({
  script,
  sectionIndex,
  lineIndex,
  footerHidden,
  blanking,
  standBy,
  fontSize,
  lineSpacing,
  fontFamily,
}: {
  script: Script | null;
  sectionIndex: number;
  lineIndex: number;
  footerHidden: boolean;
  blanking: boolean;
  standBy: boolean;
  fontSize: number;
  lineSpacing: number;
  fontFamily: FontFamily;
}) {
  const section = script?.sections[sectionIndex];
  const lines = section?.content.split("\n").map((l) => stripChords(l)) ?? [];
  const fonts: Record<FontFamily, string> = {
    sans: "Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, Menlo, monospace",
  };

  return (
    <div className="relative flex-1 min-h-0 bg-black overflow-hidden">
      {script && section && !blanking && !standBy && (
        <div
          className="h-full flex flex-col items-center justify-center px-10 text-center"
          style={{ fontFamily: fonts[fontFamily] }}
        >
          <p className="text-white/90 font-semibold mb-6 tracking-wide" style={{ fontSize: Math.max(18, fontSize * 0.55) }}>
            {script.title}
          </p>
          <div className="w-full max-w-3xl space-y-1">
            {lines.map((line, i) => {
              const isCurrent = i === lineIndex;
              return (
                <div key={i} className="flex items-center justify-center min-h-[1.2em]">
                  <p
                    className="leading-snug"
                    style={{
                      fontSize,
                      lineHeight: lineSpacing,
                      color: isCurrent ? "#facc15" : "#ffffff",
                      opacity: isCurrent || Math.abs(i - lineIndex) <= 3 ? 1 : 0.35,
                    }}
                  >
                    {line || "\u00A0"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {standBy && !blanking && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-zinc-500 tracking-[0.5em] text-2xl font-bold">STAND BY</p>
        </div>
      )}
      {blanking && <div className="absolute inset-0 bg-black" />}
      {!footerHidden && script && (
        <div className="absolute bottom-2 left-3 right-3 flex justify-between text-[10px] text-white/40">
          <span>{script.title}</span>
          <span>{section?.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Transport deck ───────────────────────────────────────────────────────────

function TransportDeck({
  isPlaying,
  displayTc,
  durationMs,
  remainingLabel,
  fps,
  fpsAuto,
  cueCount,
  timelineOpen,
  syncMode,
  bpm,
  linesPerBeat,
  footerHidden,
  blanking,
  standBy,
  syncOn,
  syncWaiting,
  syncError,
  layer,
  onTogglePlay,
  onPrevLine,
  onNextLine,
  onPrevMarker,
  onNextMarker,
  onPrevSong,
  onNextSong,
  onFooter,
  onBlanking,
  onStandBy,
  onSync,
  onFps,
  onTimeline,
  onSyncMode,
  onBpm,
  onTap,
  onLinesPerBeat,
  onDuration,
  onLayer,
  onMonitor,
}: {
  isPlaying: boolean;
  displayTc: string;
  durationMs: number;
  remainingLabel: string;
  fps: SmpteFps;
  fpsAuto: boolean;
  cueCount: number;
  timelineOpen: boolean;
  syncMode: SyncMode;
  bpm: number;
  linesPerBeat: number;
  footerHidden: boolean;
  blanking: boolean;
  standBy: boolean;
  syncOn: boolean;
  syncWaiting: boolean;
  syncError: string | null;
  layer: "A" | "B";
  onTogglePlay: () => void;
  onPrevLine: () => void;
  onNextLine: () => void;
  onPrevMarker: () => void;
  onNextMarker: () => void;
  onPrevSong: () => void;
  onNextSong: () => void;
  onFooter: () => void;
  onBlanking: () => void;
  onStandBy: () => void;
  onSync: () => void;
  onFps: (fpsAuto: boolean, fps?: SmpteFps) => void;
  onTimeline: () => void;
  onSyncMode: (mode: SyncMode) => void;
  onBpm: (bpm: number) => void;
  onTap: () => void;
  onLinesPerBeat: (n: number) => void;
  onDuration: (raw: string) => void;
  onLayer: (l: "A" | "B") => void;
  onMonitor: () => void;
}) {
  return (
    <div className="shrink-0 bg-[#3f3f3f] border-t border-black/40 px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <BevelBtn active={syncMode === "bpm"} onClick={() => onSyncMode("bpm")} className="h-11 px-3 font-semibold">
          BPM
        </BevelBtn>
        <BevelBtn active={syncMode === "smpte"} onClick={() => onSyncMode("smpte")} className="h-11 px-3 font-semibold">
          SMPTE
        </BevelBtn>
        {syncMode === "bpm" ? (
          <div className="flex-1 bg-[#2a2a2a] border border-black/50 rounded-sm h-11 flex items-center gap-1.5 px-2 min-w-0">
            <button
              type="button"
              onClick={() => onBpm(bpm - 1)}
              className="h-6 w-6 text-[14px] text-zinc-300 hover:text-white"
              aria-label="Decrease BPM"
            >
              −
            </button>
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => onBpm(parseInt(e.target.value, 10) || bpm)}
              className="w-12 h-7 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[13px] text-white select-text focus:outline-none focus:border-[#3d7ad1]"
            />
            <button
              type="button"
              onClick={() => onBpm(bpm + 1)}
              className="h-6 w-6 text-[14px] text-zinc-300 hover:text-white"
              aria-label="Increase BPM"
            >
              +
            </button>
            <button
              type="button"
              onClick={onTap}
              className="h-6 px-2 text-[11px] rounded-sm border bg-[#5c5c5c] border-[#6e6e6e] text-zinc-100 hover:bg-[#6a6a6a]"
            >
              Tap
            </button>
            <input
              type="range"
              min={40}
              max={220}
              value={Math.min(220, Math.max(40, bpm))}
              onChange={(e) => onBpm(parseInt(e.target.value, 10))}
              className="flex-1 min-w-[80px] accent-zinc-300 h-1"
            />
            <span className="text-[10px] text-zinc-500 shrink-0">lines/beat</span>
            {LINES_PER_BEAT.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onLinesPerBeat(v)}
                className={`h-6 px-1.5 text-[11px] rounded-sm border ${
                  linesPerBeat === v
                    ? "bg-[#1e5aa8] border-[#3d7ad1] text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-200"
                }`}
              >
                {v}×
              </button>
            ))}
          </div>
        ) : (
          <>
            <BevelBtn active={syncOn} onClick={onSync} className="h-11 px-4 font-semibold">
              Sync
            </BevelBtn>
            <div className="flex-1 bg-[#2a2a2a] border border-black/50 rounded-sm h-11 flex items-center gap-2 px-2 min-w-0">
              <div className="flex items-center gap-0.5 shrink-0 flex-wrap">
                <span className="text-[10px] text-zinc-500 mr-0.5">FPS</span>
                {FPS_CHIPS.map((chip) => {
                  const active = chip.fpsAuto ? fpsAuto : !fpsAuto && chip.fps === fps;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => onFps(chip.fpsAuto, chip.fps)}
                      className={`h-6 px-1.5 text-[11px] rounded-sm border ${
                        active
                          ? "bg-[#1e5aa8] border-[#3d7ad1] text-white"
                          : "border-transparent text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <span
                className={`flex-1 text-center font-mono text-[15px] tracking-wider tabular-nums ${
                  syncOn ? "text-green-400" : "text-white"
                }`}
              >
                {syncWaiting ? "Waiting LTC…" : displayTc}
              </span>
              <button
                type="button"
                onClick={onTimeline}
                className={`shrink-0 h-6 px-2 text-[11px] rounded-sm border ${
                  timelineOpen
                    ? "bg-[#1e5aa8] border-[#3d7ad1] text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-200"
                }`}
              >
                Timeline{cueCount ? ` (${cueCount})` : ""}
              </button>
            </div>
          </>
        )}
      </div>
      {syncError && (
        <p className="text-[10px] text-red-400 px-1">{syncError}</p>
      )}

      <div className="flex items-center gap-2 bg-[#2a2a2a] border border-black/50 rounded-sm h-10 px-2">
        <span
          className={`flex-1 text-center font-mono text-[20px] tracking-wider tabular-nums ${
            isPlaying || syncOn ? "text-green-400" : "text-white"
          }`}
        >
          {syncWaiting ? "Waiting LTC…" : displayTc}
        </span>
        <span className="text-zinc-600">/</span>
        <label className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-500">
          Time
          <DurationField
            valueMs={durationMs}
            onCommit={onDuration}
            className="w-14 h-6 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[13px] text-white select-text focus:outline-none focus:border-[#3d7ad1]"
          />
        </label>
        <span className="text-[11px] text-zinc-400 tabular-nums w-16 text-right shrink-0">
          {remainingLabel}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col gap-1">
          <BevelBtn onClick={onPrevLine} wide>Previous Line</BevelBtn>
          <BevelBtn onClick={onPrevMarker} wide>Previous Marker</BevelBtn>
          <BevelBtn onClick={onPrevSong} wide>Previous Song</BevelBtn>
        </div>

        <button
          type="button"
          onClick={onTogglePlay}
          className="h-[88px] w-[160px] rounded-sm bg-[#5c5c5c] border border-[#6e6e6e] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] text-white hover:bg-[#6a6a6a]"
        >
          <div className="text-[26px] font-semibold leading-none">{isPlaying ? "Pause" : "Start"}</div>
          <div className={`text-[11px] mt-1 font-mono tabular-nums ${isPlaying ? "text-green-400" : "text-zinc-300"}`}>
            {displayTc}
          </div>
        </button>

        <div className="flex flex-col gap-1">
          <BevelBtn onClick={onNextLine} wide>Next Line</BevelBtn>
          <BevelBtn onClick={onNextMarker} wide>Next Marker</BevelBtn>
          <BevelBtn onClick={onNextSong} wide>Next Song</BevelBtn>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <BevelBtn onClick={onFooter} className="h-11 px-3 leading-tight">
          <div>Footer</div>
          <div className="text-[10px] text-zinc-300">{footerHidden ? "Hidden" : "Shown"}</div>
        </BevelBtn>
        <BevelBtn className="h-11 px-3 leading-tight">
          <div>Elapsed</div>
          <div className={`text-[10px] font-mono ${isPlaying ? "text-green-300" : "text-zinc-300"}`}>{displayTc}</div>
        </BevelBtn>
        <BevelBtn onClick={onBlanking} className="h-11 px-3 leading-tight">
          <div>Blanking</div>
          <div className="text-[10px] text-zinc-300">{blanking ? "On" : "Off"}</div>
        </BevelBtn>
        <div className="flex-1" />
        <BevelBtn active={layer === "A"} onClick={() => onLayer("A")} className="h-11 w-11 px-0 font-semibold">A</BevelBtn>
        <BevelBtn active={layer === "B"} onClick={() => onLayer("B")} className="h-11 w-11 px-0 font-semibold">B</BevelBtn>
        <BevelBtn onClick={onMonitor} className="h-11 px-3">Monitor</BevelBtn>
        <BevelBtn active={standBy} onClick={onStandBy} className="h-11 px-3">Stand By</BevelBtn>
      </div>
    </div>
  );
}

// ─── Right script panel ───────────────────────────────────────────────────────

function ScriptPanel({
  script,
  sectionIndex,
  lineIndex,
  onJump,
  toMonitor,
  moveToLine,
  onToMonitor,
  onMoveToLine,
  onBpm,
  onDuration,
}: {
  script: Script | null;
  sectionIndex: number;
  lineIndex: number;
  onJump: (sectionIndex: number, lineIndex: number) => void;
  toMonitor: boolean;
  moveToLine: boolean;
  onToMonitor: () => void;
  onMoveToLine: () => void;
  onBpm: (bpm: number) => void;
  onDuration: (raw: string) => void;
}) {
  const { performSettings, updatePerformSettings, updateSection, updateScript } = useStore();
  const activeRef = useRef<HTMLInputElement | null>(null);
  const pendingFocus = useRef(false);
  const rows = script ? flattenScript(script) : [];

  useEffect(() => {
    if (pendingFocus.current) {
      pendingFocus.current = false;
      activeRef.current?.focus();
      return;
    }
    if (document.activeElement?.tagName === "INPUT") return;
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [sectionIndex, lineIndex]);

  const s = performSettings;

  function setLineText(row: ScriptRow, text: string) {
    if (!script) return;
    const section = script.sections[row.sectionIndex];
    if (!section) return;
    if (row.isHeader) {
      updateSection(script.id, section.id, { label: text });
      return;
    }
    const lines = section.content.split("\n");
    lines[row.lineIndex] = text;
    updateSection(script.id, section.id, { content: lines.join("\n") });
  }

  function insertLine(row: ScriptRow) {
    if (!script || row.isHeader) return;
    const section = script.sections[row.sectionIndex];
    const lines = section.content.split("\n");
    lines.splice(row.lineIndex + 1, 0, "");
    updateSection(script.id, section.id, { content: lines.join("\n") });
    pendingFocus.current = true;
    onJump(row.sectionIndex, row.lineIndex + 1);
  }

  function removeLine(row: ScriptRow) {
    if (!script || row.isHeader) return;
    const section = script.sections[row.sectionIndex];
    const lines = section.content.split("\n");
    if (lines.length <= 1) {
      setLineText(row, "");
      return;
    }
    lines.splice(row.lineIndex, 1);
    updateSection(script.id, section.id, { content: lines.join("\n") });
    onJump(row.sectionIndex, Math.max(0, row.lineIndex - 1));
  }

  return (
    <div className="w-full min-w-0 flex flex-col bg-[#3a3a3a] border-l border-black/40">
      <div className="px-2 py-1.5 border-b border-black/30">
        {script ? (
          <div className="flex items-center gap-2">
            <input
              value={script.title}
              onChange={(e) => updateScript(script.id, { title: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold text-zinc-200 focus:outline-none"
            />
            <label className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-500">
              BPM
              <input
                type="number"
                min={20}
                max={300}
                value={script.bpm ?? ""}
                placeholder="—"
                onChange={(e) => {
                  const raw = e.target.value;
                  const v = parseInt(raw, 10);
                  if (Number.isFinite(v)) onBpm(v);
                }}
                className="w-12 h-5 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[11px] text-white select-text focus:outline-none focus:border-[#3d7ad1]"
              />
            </label>
            <label className="flex items-center gap-1 shrink-0 text-[10px] text-zinc-500">
              Time
              <DurationField
                valueMs={script.durationMs ?? 0}
                onCommit={onDuration}
                className="w-14 h-5 bg-[#1a1a1a] border border-black/50 rounded-sm text-center font-mono text-[11px] text-white select-text focus:outline-none focus:border-[#3d7ad1]"
              />
            </label>
          </div>
        ) : (
          <span className="text-[12px] font-semibold text-zinc-500">No song</span>
        )}
        <p className="text-[10px] text-zinc-500 mt-0.5">Click a line to cue it · type to edit · Enter for a new line</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto font-mono text-[11px]">
        {rows.map((row, n) => {
          const isActive = !row.isHeader && row.sectionIndex === sectionIndex && row.lineIndex === lineIndex;
          return (
            <div
              key={row.key}
              className={`w-full flex gap-2 px-1.5 py-[1px] ${
                isActive ? "bg-[#1e5aa8]" : row.isHeader ? "bg-black/20" : "hover:bg-white/5"
              }`}
            >
              <span className="w-5 text-right text-zinc-500 shrink-0 leading-6">{n + 1}</span>
              <input
                ref={isActive ? activeRef : undefined}
                value={row.text}
                onFocus={() => {
                  if (row.isHeader) onJump(row.sectionIndex, 0);
                  else onJump(row.sectionIndex, row.lineIndex);
                }}
                onChange={(e) => setLineText(row, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLine(row);
                  } else if (e.key === "Backspace" && row.text === "" && !row.isHeader) {
                    e.preventDefault();
                    removeLine(row);
                  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    // let the field move caret on same line; console hotkeys are ignored while typing
                  }
                }}
                className={`flex-1 min-w-0 bg-transparent focus:outline-none leading-6 ${
                  isActive ? "text-white" : row.isHeader ? "text-zinc-400 uppercase tracking-wide text-[10px]" : "text-zinc-200"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="border-t border-black/40 p-2 space-y-1.5 bg-[#333]">
        <div className="flex gap-1">
          <BevelBtn wide onClick={onToMonitor}>To Monitor</BevelBtn>
          <BevelBtn active={toMonitor} onClick={onToMonitor} className="w-14">Auto</BevelBtn>
        </div>
        <div className="flex gap-1">
          <BevelBtn wide onClick={onMoveToLine}>Move to Line</BevelBtn>
          <BevelBtn active={moveToLine} onClick={onMoveToLine} className="w-14">Auto</BevelBtn>
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Line Spacing</div>
          <div className="flex gap-1">
            {([1, 1.2, 1.5, 2] as const).map((v) => (
              <BevelBtn
                key={v}
                wide
                active={s.lineSpacing === v}
                onClick={() => updatePerformSettings({ lineSpacing: v })}
              >
                {v}
              </BevelBtn>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Font Family</div>
          <select
            value={s.fontFamily}
            onChange={(e) => updatePerformSettings({ fontFamily: e.target.value as FontFamily })}
            className="w-full h-7 bg-[#5c5c5c] border border-[#6e6e6e] rounded-sm text-[11px] text-white px-1"
          >
            <option value="sans">Helvetica</option>
            <option value="serif">Georgia</option>
            <option value="mono">Courier</option>
          </select>
        </div>
        <div>
          <div className="text-[10px] text-zinc-400 mb-1">Font Size</div>
          <div className="flex items-center gap-1">
            <BevelBtn onClick={() => updatePerformSettings({ fontSize: Math.max(16, s.fontSize - 2) })} className="w-8 px-0">
              <ChevronLeft className="h-3.5 w-3.5 mx-auto" />
            </BevelBtn>
            <div className="flex-1 text-center text-[12px] text-white bg-[#2b2b2b] border border-black/40 rounded-sm h-7 leading-7">
              {s.fontSize}
            </div>
            <BevelBtn onClick={() => updatePerformSettings({ fontSize: Math.min(120, s.fontSize + 2) })} className="w-8 px-0">
              <ChevronRight className="h-3.5 w-3.5 mx-auto" />
            </BevelBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConsolePage({
  params,
}: {
  params: Promise<{ setlistId: string }>;
}) {
  const { setlistId } = use(params);
  const router = useRouter();
  const {
    setlists,
    scripts,
    activeScriptId,
    setActiveScript,
    currentSectionIndex,
    currentLineIndex,
    setCurrentSection,
    setCurrentLine,
    nextSection,
    prevSection,
    nextLine,
    prevLine,
    performSettings,
    updatePerformSettings,
    updateScript,
    smpteSettings,
    updateSmpteSettings,
    setSmpteCues,
    updateSongSync,
  } = useStore();

  const { send } = useBroadcastSender(setlistId);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [footerHidden, setFooterHidden] = useState(true);
  const [blanking, setBlanking] = useState(false);
  const [standBy, setStandBy] = useState(false);
  const [syncOn, setSyncOn] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [ltcTc, setLtcTc] = useState<LTCTimecode | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>("bpm");
  const [linesPerBeat, setLinesPerBeat] = useState(1);
  const [layer, setLayer] = useState<"A" | "B">("A");
  const [toMonitor, setToMonitor] = useState(true);
  const [moveToLine, setMoveToLine] = useState(true);

  const decoderRef = useRef<LTCDecoder | null>(null);
  const lastCueRef = useRef<string | null>(null);
  const lastFlatRef = useRef(-1);
  const elapsedRef = useRef(0);
  const tapRef = useRef(new TapTempo());
  const lastClockSentRef = useRef("");
  elapsedRef.current = elapsedMs;

  const setlist = setlists[setlistId];
  const activeScript = activeScriptId ? scripts[activeScriptId] : null;
  const cues = activeScript?.smpteCues ?? [];
  const fps = smpteSettings.fps;
  const songSync = resolveSongSync(setlist, activeScript);
  const bpm = clampBpm(songSync.bpm);
  const durationMs = songSync.durationMs;
  const displayTc = ltcTc
    ? formatSmpte(ltcTc.hours, ltcTc.minutes, ltcTc.seconds, ltcTc.frames, smpteSettings.dropFrame || ltcTc.dropFrame)
    : clockFromElapsed(elapsedMs, songSync.smpteStart, fps, smpteSettings.dropFrame);
  const remainingLabel = formatRemainingLabel(durationMs, elapsedMs);

  useEffect(() => {
    if (!activeScriptId && setlist?.scriptIds.length) {
      setActiveScript(setlist.scriptIds[0]);
    }
  }, [setlist, activeScriptId, setActiveScript]);

  useEffect(() => {
    send({ type: "UPDATE_SETTINGS", settings: performSettings });
  }, [performSettings, send]);

  const dispatch = useCallback(
    (cmd: ConsoleCommand) => {
      send(cmd);
      switch (cmd.type) {
        case "GOTO_SCRIPT":
          setActiveScript(cmd.scriptId);
          setCurrentSection(0);
          setElapsedMs(elapsedAfterSongChange());
          break;
        case "GOTO_SECTION":
          setCurrentSection(cmd.index);
          break;
        case "GOTO_LINE":
          setCurrentSection(cmd.sectionIndex);
          setCurrentLine(cmd.lineIndex);
          break;
        case "NEXT_SECTION":
          nextSection();
          break;
        case "PREV_SECTION":
          prevSection();
          break;
        case "NEXT_LINE":
          nextLine();
          break;
        case "PREV_LINE":
          prevLine();
          break;
        case "NEXT_SCRIPT": {
          if (!setlist) break;
          const idx = setlist.scriptIds.indexOf(activeScriptId || "");
          if (idx < setlist.scriptIds.length - 1) {
            setActiveScript(setlist.scriptIds[idx + 1]);
            setCurrentSection(0);
            setElapsedMs(elapsedAfterSongChange());
          }
          break;
        }
        case "PREV_SCRIPT": {
          if (!setlist) break;
          const idx = setlist.scriptIds.indexOf(activeScriptId || "");
          if (idx > 0) {
            setActiveScript(setlist.scriptIds[idx - 1]);
            setCurrentSection(0);
            setElapsedMs(elapsedAfterSongChange());
          }
          break;
        }
        case "PLAY_PAUSE":
          setIsPlaying((v) => !v);
          break;
        case "BLANKING":
          setBlanking(cmd.on);
          break;
        case "STANDBY":
          setStandBy(cmd.on);
          break;
      }
    },
    [send, setlist, activeScriptId, setActiveScript, setCurrentSection, setCurrentLine, nextSection, prevSection, nextLine, prevLine]
  );

  const handleLtcFrame = useCallback(
    (tc: LTCTimecode) => {
      setLtcTc(tc);
      const mapped = detectedToSmpteFps(tc.fps);
      if (smpteSettings.fpsAuto && mapped !== smpteSettings.fps) {
        updateSmpteSettings({ fps: mapped, dropFrame: tc.dropFrame || smpteSettings.dropFrame });
      }
      const effectiveFps = smpteSettings.fpsAuto ? mapped : smpteSettings.fps;
      const drop = tc.dropFrame || smpteSettings.dropFrame;
      setElapsedMs((timecodeToFrames(tc.raw, effectiveFps, drop) / trueFps(effectiveFps)) * 1000);
      const active = resolveActiveCue(tc, cues, effectiveFps, drop);
      if (active && active.id !== lastCueRef.current) {
        lastCueRef.current = active.id;
        dispatch({
          type: "GOTO_LINE",
          sectionIndex: active.sectionIndex,
          lineIndex: active.lineIndex ?? 0,
        });
      }
      send(smpteLockCommand(tc.raw, true));
    },
    [cues, dispatch, send, smpteSettings.dropFrame, smpteSettings.fps, smpteSettings.fpsAuto, updateSmpteSettings]
  );

  const frameRef = useRef(handleLtcFrame);
  frameRef.current = handleLtcFrame;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    lastCueRef.current = null;
    lastFlatRef.current = -1;
    tapRef.current.reset();
  }, [activeScriptId]);

  useEffect(() => {
    if (!usesInternalClock(isPlaying, syncOn)) return;
    const script = activeScript;
    const origin = performance.now() - elapsedRef.current;
    const startTc = songSync.smpteStart;
    const drop = smpteSettings.dropFrame;
    let raf = 0;
    const tick = (now: number) => {
      const capped = capElapsed(now - origin, durationMs);
      setElapsedMs(capped);
      if (script) {
        const pos = lineAtElapsed(script, capped, durationMs, bpm, linesPerBeat);
        if (pos.flat !== lastFlatRef.current) {
          lastFlatRef.current = pos.flat;
          dispatchRef.current(gotoLineCommand(pos.sectionIndex, pos.lineIndex));
        }
      }
      const tc = clockFromElapsed(capped, startTc, fps, drop);
      if (shouldBroadcastClock(lastClockSentRef.current, tc)) {
        lastClockSentRef.current = tc;
        sendRef.current(smpteLockCommand(tc, true));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    isPlaying,
    syncOn,
    durationMs,
    bpm,
    linesPerBeat,
    activeScript,
    fps,
    songSync.smpteStart,
    smpteSettings.dropFrame,
  ]);

  useEffect(() => {
    return () => {
      decoderRef.current?.stop();
      decoderRef.current = null;
    };
  }, []);

  async function toggleSync() {
    if (syncOn) {
      decoderRef.current?.stop();
      decoderRef.current = null;
      setSyncOn(false);
      setLtcTc(null);
      setSyncError(null);
      send(smpteLockCommand(displayTc, false));
      return;
    }
    try {
      const decoder = new LTCDecoder((tc) => frameRef.current(tc));
      await decoder.start();
      decoderRef.current = decoder;
      setSyncOn(true);
      setSyncError(null);
    } catch {
      setSyncError("Could not access audio input for LTC. Allow microphone/line-in, then try Sync again.");
    }
  }

  function addCue() {
    if (!activeScript) return;
    const next = [
      ...cues,
      {
        id: crypto.randomUUID(),
        timecode: displayTc,
        sectionIndex: currentSectionIndex,
        lineIndex: currentLineIndex,
        label: activeScript.sections[currentSectionIndex]?.label ?? "Cue",
      },
    ];
    setSmpteCues(activeScript.id, next);
  }

  function updateCue(id: string, updates: Partial<(typeof cues)[number]>) {
    if (!activeScript) return;
    setSmpteCues(
      activeScript.id,
      cues.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  function deleteCue(id: string) {
    if (!activeScript) return;
    setSmpteCues(
      activeScript.id,
      cues.filter((c) => c.id !== id)
    );
  }

  function applyBpm(next: number) {
    const value = clampBpm(next);
    if (activeScript) {
      updateSongSync(setlistId, activeScript.id, { bpm: value });
      updateScript(activeScript.id, { bpm: value });
    }
    const speed = Math.round(
      bpmToScrollSpeed({
        bpm: value,
        fontSize: performSettings.fontSize,
        lineSpacing: performSettings.lineSpacing,
        linesPerBeat,
      })
    );
    updatePerformSettings({ scrollSpeed: speed });
    send({ type: "UPDATE_SETTINGS", settings: { scrollSpeed: speed } });
  }

  function applyDuration(raw: string) {
    if (!activeScript) return;
    const parsed = parseDurationInput(raw);
    if (parsed == null) return;
    updateSongSync(setlistId, activeScript.id, { durationMs: parsed });
    updateScript(activeScript.id, { durationMs: parsed });
  }

  function jumpTo(si: number, li: number) {
    dispatch({ type: "GOTO_LINE", sectionIndex: si, lineIndex: li });
    if (!activeScript) return;
    const elapsed = elapsedForLine(activeScript, si, li, durationMs, bpm, linesPerBeat);
    const remapped = remapPlayback(activeScript, elapsed, durationMs, bpm, linesPerBeat);
    lastFlatRef.current = remapped.flat;
    setElapsedMs(remapped.elapsed);
  }

  function applyLinesPerBeat(next: number) {
    setLinesPerBeat(next);
    const speed = Math.round(
      bpmToScrollSpeed({
        bpm,
        fontSize: performSettings.fontSize,
        lineSpacing: performSettings.lineSpacing,
        linesPerBeat: next,
      })
    );
    updatePerformSettings({ scrollSpeed: speed });
    send({ type: "UPDATE_SETTINGS", settings: { scrollSpeed: speed } });
  }

  function tapBpm() {
    const result = tapRef.current.tap();
    if (result) applyBpm(result);
  }

  function openDisplay() {
    window.open(`/perform/display?setlist=${setlistId}`, "_blank", "width=1280,height=720,menubar=no,toolbar=no");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        dispatch({ type: "PLAY_PAUSE" });
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "NEXT_LINE" });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "PREV_LINE" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  if (!setlist) {
    return (
      <div className="h-screen bg-[#2e2e2e] text-zinc-400 flex items-center justify-center flex-col gap-3">
        <p>Setlist not found.</p>
        <button type="button" onClick={() => router.push("/")} className="text-sm text-white underline">
          Back to library
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#2e2e2e] text-white flex flex-col overflow-hidden select-none">
      <header className="h-8 shrink-0 flex items-center gap-3 px-2 bg-[#3a3a3a] border-b border-black/50 text-[12px]">
        <button type="button" onClick={() => router.push("/")} className="text-zinc-400 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-zinc-300">
          Flow Prompter — {setlist.name}
          {setlist.venue ? ` - ${setlist.venue}` : ""}
        </span>
        <div className="flex-1" />
        <span className="text-zinc-500 text-[11px]">Main Layer</span>
        <a
          href={`/remote/${setlistId}`}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white"
        >
          <Smartphone className="h-3 w-3" /> Remote
        </a>
        <button
          type="button"
          onClick={openDisplay}
          className="flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white"
        >
          <Monitor className="h-3 w-3" /> Display <ExternalLink className="h-3 w-3" />
        </button>
      </header>

      <div className="flex-1 grid grid-cols-[232px_minmax(0,1fr)_260px] min-h-0 min-w-0">
        <LeftRail
          setlistId={setlistId}
          activeScriptId={activeScriptId}
          onSelect={(id) => dispatch(gotoScriptCommand(id))}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <PreviewStage
            script={activeScript}
            sectionIndex={currentSectionIndex}
            lineIndex={currentLineIndex}
            footerHidden={footerHidden}
            blanking={blanking}
            standBy={standBy}
            fontSize={Math.min(32, Math.max(22, performSettings.fontSize * 0.55))}
            lineSpacing={performSettings.lineSpacing}
            fontFamily={performSettings.fontFamily}
          />
          {timelineOpen && syncMode === "smpte" && (
            <SmpteTimeline
              script={activeScript}
              cues={cues}
              fps={fps}
              dropFrame={smpteSettings.dropFrame}
              currentSectionIndex={currentSectionIndex}
              liveTc={displayTc}
              onAdd={addCue}
              onUpdate={updateCue}
              onDelete={deleteCue}
              onJump={jumpTo}
              onDropFrame={(on) => updateSmpteSettings({ dropFrame: on })}
            />
          )}
          <TransportDeck
            isPlaying={isPlaying}
            displayTc={displayTc}
            durationMs={durationMs}
            remainingLabel={remainingLabel}
            fps={fps}
            fpsAuto={smpteSettings.fpsAuto}
            cueCount={cues.length}
            timelineOpen={timelineOpen}
            syncMode={syncMode}
            bpm={bpm}
            linesPerBeat={linesPerBeat}
            footerHidden={footerHidden}
            blanking={blanking}
            standBy={standBy}
            syncOn={syncOn}
            syncWaiting={syncOn && !ltcTc}
            syncError={syncError}
            layer={layer}
            onTogglePlay={() => dispatch({ type: "PLAY_PAUSE" })}
            onPrevLine={() => dispatch({ type: "PREV_LINE" })}
            onNextLine={() => dispatch({ type: "NEXT_LINE" })}
            onPrevMarker={() => dispatch({ type: "PREV_SECTION" })}
            onNextMarker={() => dispatch({ type: "NEXT_SECTION" })}
            onPrevSong={() => dispatch({ type: "PREV_SCRIPT" })}
            onNextSong={() => dispatch({ type: "NEXT_SCRIPT" })}
            onFooter={() => setFooterHidden((v) => !v)}
            onBlanking={() => dispatch({ type: "BLANKING", on: !blanking })}
            onStandBy={() => dispatch({ type: "STANDBY", on: !standBy })}
            onSync={() => void toggleSync()}
            onFps={(auto, nextFps) => {
              if (auto) updateSmpteSettings({ fpsAuto: true });
              else if (nextFps) {
                updateSmpteSettings({
                  fpsAuto: false,
                  fps: nextFps,
                  dropFrame: supportsDropFrame(nextFps) ? smpteSettings.dropFrame : false,
                });
              }
            }}
            onTimeline={() => setTimelineOpen((v) => !v)}
            onSyncMode={(mode) => {
              setSyncMode(mode);
              if (mode === "bpm") setTimelineOpen(false);
            }}
            onBpm={applyBpm}
            onTap={tapBpm}
            onLinesPerBeat={applyLinesPerBeat}
            onDuration={applyDuration}
            onLayer={setLayer}
            onMonitor={openDisplay}
          />
        </div>

        <ScriptPanel
          script={activeScript}
          sectionIndex={currentSectionIndex}
          lineIndex={currentLineIndex}
          onJump={jumpTo}
          toMonitor={toMonitor}
          moveToLine={moveToLine}
          onToMonitor={() => setToMonitor((v) => !v)}
          onMoveToLine={() => setMoveToLine((v) => !v)}
          onBpm={applyBpm}
          onDuration={applyDuration}
        />
      </div>
    </div>
  );
}
