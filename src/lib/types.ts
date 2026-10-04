// ─── Section ────────────────────────────────────────────────────────────────

export type SectionType =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "solo"
  | "spoken"
  | "custom";

export interface CueCard {
  id: string;
  label: string;       // Text shown on the cue card
  countdownSec: number; // 0 = no countdown, just pause
  autoResume: boolean;
}

export interface Section {
  id: string;
  type: SectionType;
  label: string;       // "Verse 1", "Chorus", etc.
  content: string;     // Plain text (no chord notation for general use)
  cueCard?: CueCard;   // Optional cue card before this section
  completed?: boolean; // Track reading progress
}

// ─── Script ─────────────────────────────────────────────────────────────────

export interface Script {
  id: string;
  title: string;
  description: string;
  tags: string[];
  sections: Section[];
  createdAt: number;
  updatedAt: number;
  wordCount: number;   // Derived, stored for quick display
  readingTimeSec: number; // Derived
  // Music metadata (optional — for HiWire-style live show workflow)
  key?: string;        // Musical key: C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B
  bpm?: number;        // Beats per minute
  artist?: string;     // Artist / performer name
  hasChords?: boolean; // Whether sections use ChordPro notation
  smpteCues?: SmpteCue[];
  durationMs?: number; // Expected song length; clock and lyric mapping use this
}

export type SmpteFps = 23.98 | 24 | 25 | 29.97 | 30 | 47.95 | 48 | 50 | 59.94 | 60;

export interface SmpteCue {
  id: string;
  timecode: string; // HH:MM:SS:FF
  sectionIndex: number;
  lineIndex?: number;
  label: string;
}

export interface SmpteSettings {
  fps: SmpteFps;
  fpsAuto: boolean;
  dropFrame: boolean;
}

// ─── Setlist ─────────────────────────────────────────────────────────────────

export interface Setlist {
  id: string;
  name: string;        // e.g. "Night 1 – Madison Square Garden"
  date: string;        // ISO date: "2026-09-21"
  venue: string;
  scriptIds: string[]; // Ordered song IDs
  songSync?: Record<string, SongSync>; // Per-song show overrides
  createdAt: number;
  updatedAt: number;
}

/** Show-level sync for one song in a setlist. Overrides the library chart. */
export interface SongSync {
  bpm?: number;
  durationMs?: number;
  smpteStart?: string; // HH:MM:SS:FF — clock origin for this song
}

// ─── Perform Settings ────────────────────────────────────────────────────────

export type PlaybackMode = "scroll" | "highlight" | "line" | "arrow";
export type ColorScheme = "dark" | "light" | "amber" | "green";
export type FontFamily = "sans" | "mono" | "serif";

export interface PerformSettings {
  mode: PlaybackMode;
  fontSize: number;         // px, 16–120
  scrollSpeed: number;      // px/sec for scroll mode
  lineSpacing: number;      // 1–3 (CSS line-height multiplier)
  fontFamily: FontFamily;
  colorScheme: ColorScheme;
  isMirrored: boolean;
  horizontalMargin: number; // 0–40% each side
  showProgress: boolean;    // Show section progress bar
  showSectionNav: boolean;  // Show section names during perform
}

// ─── Console Command (operator → display sync) ────────────────────────────────

export type ConsoleCommand =
  | { type: "GOTO_SCRIPT"; scriptId: string }
  | { type: "GOTO_SECTION"; index: number }
  | { type: "GOTO_LINE"; sectionIndex: number; lineIndex: number }
  | { type: "NEXT_SECTION" }
  | { type: "PREV_SECTION" }
  | { type: "NEXT_LINE" }
  | { type: "PREV_LINE" }
  | { type: "NEXT_SCRIPT" }
  | { type: "PREV_SCRIPT" }
  | { type: "PLAY_PAUSE" }
  | { type: "UPDATE_SETTINGS"; settings: Partial<PerformSettings> }
  | { type: "TRANSPOSE"; steps: number }
  | { type: "SET_TRANSPOSE"; steps: number }
  | { type: "BLANKING"; on: boolean }
  | { type: "STANDBY"; on: boolean }
  | { type: "SMPTE_LOCK"; locked: boolean; timecode: string };

// ─── App State ───────────────────────────────────────────────────────────────

export interface AppState {
  scripts: Record<string, Script>;
  setlists: Record<string, Setlist>;
  activeScriptId: string | null;
  activeSetlistId: string | null;
  performSettings: PerformSettings;
  smpteSettings: SmpteSettings;
  // Perform runtime state
  isPerforming: boolean;
  currentSectionIndex: number;
  currentLineIndex: number;
  transposeSteps: number; // Live transposition (overrides per-song key)
}

// ─── Collab ──────────────────────────────────────────────────────────────────

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { sectionId: string; offset: number };
}

export interface CollabRoom {
  id: string;
  scriptId: string;
  users: CollabUser[];
}
