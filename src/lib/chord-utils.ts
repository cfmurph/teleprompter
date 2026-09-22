"use client";

// ─── Note tables ──────────────────────────────────────────────────────────────

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const ALL_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function noteIndex(note: string): number {
  let i = SHARP.indexOf(note);
  if (i === -1) i = FLAT.indexOf(note);
  return i;
}

function transposeNote(note: string, steps: number): string {
  const idx = noteIndex(note);
  if (idx === -1) return note;
  const newIdx = ((idx + steps) % 12 + 12) % 12;
  // Prefer flats when transposing down, sharps when up
  return steps < 0 ? FLAT[newIdx] : SHARP[newIdx];
}

// Matches a chord root like C, C#, Db — followed by optional suffix and optional /bass
const CHORD_RE = /\b([A-G][#b]?)((?:maj|min|aug|dim|sus|add|M|m|°|ø)?[0-9]*)(?:\/([A-G][#b]?))?\b/g;

export function transposeChord(chord: string, steps: number): string {
  if (steps === 0) return chord;
  return chord.replace(CHORD_RE, (_full, root, suffix, bass) => {
    const newRoot = transposeNote(root, steps);
    const newBass = bass ? "/" + transposeNote(bass, steps) : "";
    return newRoot + suffix + newBass;
  });
}

export function transposeKey(key: string, steps: number): string {
  return transposeNote(key, steps);
}

// ─── ChordPro parser ──────────────────────────────────────────────────────────
//
// Input line: "[G]Just a small town [Am]girl"
// Output: array of { chord, text } segments
//
// When rendering, each segment is laid out as:
//   chord (above, in smaller text)
//   text  (below, full size)

export interface ChordSegment {
  chord: string | null; // null = plain text with no chord above it
  text: string;
}

export interface ParsedLine {
  segments: ChordSegment[];
  hasChords: boolean;
}

export function parseLine(line: string, transposeSteps = 0): ParsedLine {
  const segments: ChordSegment[] = [];
  let hasChords = false;
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    hasChords = true;
    // Plain text before this chord
    if (match.index > last) {
      segments.push({ chord: null, text: line.slice(last, match.index) });
    }
    const rawChord = match[1];
    const chord = transposeSteps !== 0 ? transposeChord(rawChord, transposeSteps) : rawChord;
    segments.push({ chord, text: "" });
    last = match.index + match[0].length;
  }

  // Remaining text after the last chord (attach to previous chord segment)
  if (last < line.length) {
    const tail = line.slice(last);
    if (segments.length > 0 && segments[segments.length - 1].chord !== null) {
      segments[segments.length - 1].text = tail;
    } else {
      segments.push({ chord: null, text: tail });
    }
  }

  if (segments.length === 0) {
    segments.push({ chord: null, text: line });
  }

  return { segments, hasChords };
}

export function parseContent(content: string, transposeSteps = 0): ParsedLine[] {
  return content.split("\n").map((l) => parseLine(l, transposeSteps));
}

export function stripChords(content: string): string {
  return content.replace(/\[[^\]]+\]/g, "");
}

// ─── Key display helpers ──────────────────────────────────────────────────────

export function displayKey(key: string, transposeSteps: number): string {
  if (transposeSteps === 0) return key;
  return transposeKey(key, transposeSteps);
}

export function transposeLabel(steps: number): string {
  if (steps === 0) return "Original key";
  return steps > 0 ? `+${steps} semitone${steps !== 1 ? "s" : ""}` : `${steps} semitone${steps !== -1 ? "s" : ""}`;
}
