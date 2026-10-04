import type { Script, Setlist, SongSync, SmpteFps } from "./types";
import { framesToTimecode, parseTimecode, timecodeToFrames, trueFps } from "./ltc-decoder";

export function countLyricLines(script: Script): number {
  return script.sections.reduce((n, sec) => {
    const lines = sec.content.split("\n");
    return n + Math.max(1, lines.length);
  }, 0);
}

export function flattenLineIndex(script: Script, sectionIndex: number, lineIndex: number): number {
  let n = 0;
  for (let i = 0; i < script.sections.length; i++) {
    const lines = script.sections[i].content.split("\n");
    const count = Math.max(1, lines.length);
    if (i === sectionIndex) return n + Math.max(0, Math.min(count - 1, lineIndex));
    n += count;
  }
  return n;
}

export function lineAtFlatIndex(
  script: Script,
  flatIndex: number
): { sectionIndex: number; lineIndex: number } {
  let remaining = Math.max(0, Math.floor(flatIndex));
  for (let i = 0; i < script.sections.length; i++) {
    const count = Math.max(1, script.sections[i].content.split("\n").length);
    if (remaining < count) return { sectionIndex: i, lineIndex: remaining };
    remaining -= count;
  }
  const last = script.sections.length - 1;
  const lastCount = last >= 0 ? Math.max(1, script.sections[last].content.split("\n").length) : 1;
  return { sectionIndex: Math.max(0, last), lineIndex: Math.max(0, lastCount - 1) };
}

export function resolveSongSync(setlist: Setlist | undefined, script: Script | null): Required<SongSync> {
  const over = script && setlist?.songSync?.[script.id];
  return {
    bpm: over?.bpm ?? script?.bpm ?? 120,
    durationMs: over?.durationMs ?? script?.durationMs ?? 0,
    smpteStart: over?.smpteStart ?? "00:00:00:00",
  };
}

export function msPerLyricLine(
  durationMs: number,
  lineCount: number,
  bpm: number,
  linesPerBeat: number
): number {
  if (durationMs > 0 && lineCount > 0) return durationMs / lineCount;
  return 60_000 / (Math.max(20, bpm) * Math.max(0.25, linesPerBeat));
}

export function durationFromBpm(lineCount: number, bpm: number, linesPerBeat: number): number {
  return Math.round(msPerLyricLine(0, lineCount, bpm, linesPerBeat) * Math.max(1, lineCount));
}

/** Accepts M:SS, MM:SS, H:MM:SS, seconds, or SMPTE HH:MM:SS:FF */
export function parseDurationInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Math.max(0, parseInt(text, 10)) * 1000;
  if (
    !/^\d{1,2}:\d{2}$/.test(text) &&
    !/^\d{1,2}:\d{2}:\d{2}$/.test(text) &&
    !/^\d{2}:\d{2}:\d{2}[:;]\d{2}$/.test(text)
  ) {
    return null;
  }
  const parts = text.split(/[:;]/).map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  const { hours, minutes, seconds, frames } = parseTimecode(text);
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + Math.round((frames / 30) * 1000);
}

export function formatDurationInput(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function clockFromElapsed(
  elapsedMs: number,
  smpteStart: string,
  fps: SmpteFps,
  dropFrame: boolean
): string {
  const start = timecodeToFrames(smpteStart, fps, dropFrame);
  const extra = Math.floor((Math.max(0, elapsedMs) / 1000) * trueFps(fps));
  return framesToTimecode(start + extra, fps, dropFrame);
}

/** Clamp elapsed to [0, duration] when the song has a length; otherwise only floor at 0. */
export function capElapsed(elapsedMs: number, durationMs: number): number {
  const raw = Math.max(0, elapsedMs);
  return durationMs > 0 ? Math.min(raw, durationMs) : raw;
}

export function remainingClockMs(durationMs: number, elapsedMs: number): number {
  return durationMs > 0 ? Math.max(0, durationMs - elapsedMs) : 0;
}

export function formatRemainingLabel(durationMs: number, elapsedMs: number): string {
  if (durationMs <= 0) return "";
  return `-${formatDurationInput(remainingClockMs(durationMs, elapsedMs))}`;
}

/** Keep the previous length when the Time field is empty or malformed. */
export function applyDurationInput(raw: string, currentMs: number): number {
  const parsed = parseDurationInput(raw);
  return parsed == null ? currentMs : parsed;
}

export function lineAtElapsed(
  script: Script,
  elapsedMs: number,
  durationMs: number,
  bpm: number,
  linesPerBeat: number
): { sectionIndex: number; lineIndex: number; flat: number } {
  const lineCount = countLyricLines(script);
  const capped = capElapsed(elapsedMs, durationMs);
  const perLine = msPerLyricLine(durationMs, lineCount, bpm, linesPerBeat);
  if (lineCount <= 0 || !(perLine > 0)) {
    return { sectionIndex: 0, lineIndex: 0, flat: 0 };
  }
  const flat = Math.min(lineCount - 1, Math.floor(capped / perLine));
  const pos = lineAtFlatIndex(script, flat);
  return { ...pos, flat };
}

export function elapsedForLine(
  script: Script,
  sectionIndex: number,
  lineIndex: number,
  durationMs: number,
  bpm: number,
  linesPerBeat: number
): number {
  const count = countLyricLines(script);
  const flat = flattenLineIndex(script, sectionIndex, lineIndex);
  return flat * msPerLyricLine(durationMs, count, bpm, linesPerBeat);
}

export function shouldBroadcastClock(previous: string, next: string): boolean {
  return previous !== next;
}

/** Internal rAF clock runs only while playing and LTC is off. */
export function usesInternalClock(isPlaying: boolean, ltcSyncOn: boolean): boolean {
  return isPlaying && !ltcSyncOn;
}

export function elapsedAfterSongChange(): number {
  return 0;
}

export function playbackOrigin(nowMs: number, elapsedMs: number): number {
  return nowMs - Math.max(0, elapsedMs);
}

/** Recompute line + cap when the operator changes Time/BPM mid-song. */
export function remapPlayback(
  script: Script,
  elapsedMs: number,
  durationMs: number,
  bpm: number,
  linesPerBeat: number
): { elapsed: number; sectionIndex: number; lineIndex: number; flat: number } {
  const elapsed = capElapsed(elapsedMs, durationMs);
  const pos = lineAtElapsed(script, elapsed, durationMs, bpm, linesPerBeat);
  return { elapsed, ...pos };
}
