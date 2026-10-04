"use client";

import { Plus, Trash2 } from "lucide-react";
import { Script, SmpteCue, SmpteFps } from "@/lib/types";
import { supportsDropFrame, timecodeToFrames } from "@/lib/ltc-decoder";

export function SmpteTimeline({
  script,
  cues,
  fps,
  dropFrame,
  currentSectionIndex,
  liveTc,
  onAdd,
  onUpdate,
  onDelete,
  onJump,
  onDropFrame,
}: {
  script: Script | null;
  cues: SmpteCue[];
  fps: SmpteFps;
  dropFrame: boolean;
  currentSectionIndex: number;
  liveTc: string;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<SmpteCue>) => void;
  onDelete: (id: string) => void;
  onJump: (sectionIndex: number, lineIndex: number) => void;
  onDropFrame: (on: boolean) => void;
}) {
  const sorted = [...cues].sort(
    (a, b) => timecodeToFrames(a.timecode, fps, dropFrame) - timecodeToFrames(b.timecode, fps, dropFrame)
  );

  return (
    <div className="shrink-0 bg-[#353535] border-t border-black/40 px-3 py-2 max-h-56 overflow-y-auto">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-semibold text-zinc-200">
          SMPTE Timecode Automation
        </span>
        <span className="text-[10px] text-zinc-500 truncate">
          {script ? script.title : "No song"}
          {script?.artist ? ` — ${script.artist}` : ""}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onDropFrame(!dropFrame)}
          disabled={!supportsDropFrame(fps)}
          className={`h-5 px-1.5 text-[10px] rounded-sm border ${
            dropFrame && supportsDropFrame(fps)
              ? "bg-[#1e5aa8] border-[#3d7ad1] text-white"
              : "bg-[#5c5c5c] border-[#6e6e6e] text-zinc-300"
          } disabled:opacity-40`}
        >
          DF
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!script}
          className="h-5 px-2 text-[10px] rounded-sm border bg-[#5c5c5c] border-[#6e6e6e] text-zinc-100 hover:bg-[#6a6a6a] disabled:opacity-40 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add Cue
        </button>
      </div>

      {sorted.length === 0 && (
        <p className="text-[11px] text-zinc-500 py-3 text-center">
          No cues on this song. Add a cue at {liveTc} to jump the script when LTC hits that time.
        </p>
      )}

      <div className="space-y-1">
        {sorted.map((cue) => {
          const active = cue.sectionIndex === currentSectionIndex;
          return (
            <div
              key={cue.id}
              className={`flex items-center gap-1.5 rounded-sm px-1.5 py-1 ${
                active ? "bg-[#1e5aa8]/40" : "bg-[#2a2a2a]"
              }`}
            >
              <input
                type="text"
                value={cue.timecode}
                onChange={(e) => onUpdate(cue.id, { timecode: e.target.value })}
                spellCheck={false}
                className="w-[7.5rem] h-6 bg-[#1a1a1a] border border-black/50 rounded-sm px-1.5 font-mono text-[11px] text-green-400 select-text focus:outline-none focus:border-[#3d7ad1]"
              />
              <select
                value={cue.sectionIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  onUpdate(cue.id, {
                    sectionIndex: idx,
                    lineIndex: 0,
                    label: script?.sections[idx]?.label ?? cue.label,
                  });
                }}
                className="flex-1 min-w-0 h-6 bg-[#1a1a1a] border border-black/50 rounded-sm px-1 text-[11px] text-zinc-100 focus:outline-none focus:border-[#3d7ad1]"
              >
                {script?.sections.map((sec, i) => (
                  <option key={sec.id} value={i}>
                    {sec.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onJump(cue.sectionIndex, cue.lineIndex ?? 0)}
                className="h-6 px-2 text-[10px] rounded-sm border bg-[#5c5c5c] border-[#6e6e6e] text-zinc-100 hover:bg-[#6a6a6a]"
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => onDelete(cue.id)}
                className="h-6 w-6 flex items-center justify-center text-zinc-500 hover:text-red-400"
                aria-label="Delete cue"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
