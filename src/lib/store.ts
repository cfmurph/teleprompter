"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  Script,
  Section,
  SectionType,
  PerformSettings,
  PlaybackMode,
  CueCard,
  Setlist,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

function now(): number {
  return Date.now();
}

function computeWordCount(sections: Section[]): number {
  return sections
    .map((s) => s.content.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
}

function computeReadingTime(wordCount: number): number {
  // ~150 wpm for teleprompter (slower reading aloud)
  return Math.ceil((wordCount / 150) * 60);
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const DEMO_SCRIPT_1: Script = {
  id: "demo-1",
  title: "Product Launch Keynote",
  description: "Annual product announcement speech for Q4 2026",
  tags: ["keynote", "product", "launch"],
  createdAt: now() - 300000,
  updatedAt: now() - 300000,
  wordCount: 0,
  readingTimeSec: 0,
  sections: [
    {
      id: "d1-s1",
      type: "intro",
      label: "Opening",
      content:
        "Good morning, everyone. Thank you for joining us today.\n\nToday is a day we've been working toward for the past two years. A day that represents not just a new product, but a new chapter for our company and for our customers.",
    },
    {
      id: "d1-s2",
      type: "custom",
      label: "The Problem",
      content:
        "We've all experienced the frustration of tools that don't work the way we think.\n\nYou start with a simple task and suddenly you're buried in menus, settings, and workarounds. You lose focus. You lose momentum. You lose time.\n\nWe asked ourselves: what if technology just got out of the way?",
    },
    {
      id: "d1-s3",
      type: "custom",
      label: "The Solution",
      content:
        "Introducing Flow — the simplest way to get work done.\n\nFlow learns how you work. It adapts to your habits, your pace, your preferences. It's not just software. It's a collaborator.\n\nWe built Flow because we believe your tools should amplify your thinking, not interrupt it.",
      cueCard: {
        id: "cue-1",
        label: "🎉 Product reveal — pause for applause",
        countdownSec: 5,
        autoResume: true,
      },
    },
    {
      id: "d1-s4",
      type: "custom",
      label: "Key Features",
      content:
        "Let me walk you through what makes Flow different.\n\nFirst: Speed. Flow opens in under a second and stays out of your way.\n\nSecond: Intelligence. Flow understands context and offers suggestions at exactly the right moment.\n\nThird: Collaboration. Flow makes working together feel like working alone — seamless, fluid, natural.",
    },
    {
      id: "d1-s5",
      type: "outro",
      label: "Closing",
      content:
        "We built Flow because we love what great software can do for people.\n\nWe believe in a world where technology empowers creativity, enables connection, and removes friction from human potential.\n\nToday, that world gets a little closer.\n\nThank you.",
    },
  ],
};

const DEMO_SCRIPT_2: Script = {
  id: "demo-2",
  title: "Wedding Toast",
  description: "Best man speech for Jamie & Alex's wedding",
  tags: ["wedding", "personal", "speech"],
  createdAt: now() - 200000,
  updatedAt: now() - 100000,
  wordCount: 0,
  readingTimeSec: 0,
  sections: [
    {
      id: "d2-s1",
      type: "intro",
      label: "Introduction",
      content:
        "Good evening, everyone. For those I haven't had the pleasure of meeting yet, my name is Chris, and I've had the privilege of calling Jamie my best friend for the past fifteen years.",
    },
    {
      id: "d2-s2",
      type: "custom",
      label: "The Story",
      content:
        "I remember the first time Jamie told me about Alex. We were on a hiking trip in Colorado — completely lost, I should add — and Jamie just kept talking about this incredible person they'd met at that bookstore in Brooklyn.\n\nI knew right then that something was different. Jamie has never talked about a bookstore with that much enthusiasm.",
    },
    {
      id: "d2-s3",
      type: "outro",
      label: "The Toast",
      content:
        "Jamie and Alex — what you have is rare. The kind of love that makes everyone around you believe in it a little more.\n\nPlease raise your glasses.\n\nTo Jamie and Alex — may your life together be as extraordinary as you both deserve.",
      cueCard: {
        id: "cue-2",
        label: "🥂 Raise glass — wait for crowd",
        countdownSec: 3,
        autoResume: false,
      },
    },
  ],
};

const DEMO_SCRIPT_3: Script = {
  id: "demo-3",
  title: "YouTube Intro Script",
  description: "Standard channel intro for tech review videos",
  tags: ["youtube", "template", "intro"],
  createdAt: now() - 100000,
  updatedAt: now() - 50000,
  wordCount: 0,
  readingTimeSec: 0,
  sections: [
    {
      id: "d3-s1",
      type: "intro",
      label: "Hook",
      content:
        "I've been using this thing every single day for three months. And honestly? I didn't expect it to change how I work. But it did.",
    },
    {
      id: "d3-s2",
      type: "custom",
      label: "Channel Intro",
      content:
        "Hey everyone, welcome back to the channel. If you're new here, I'm [NAME] and this is where we dig into tech that actually matters — no fluff, no sponsored garbage, just honest takes.",
    },
    {
      id: "d3-s3",
      type: "custom",
      label: "Today's Topic",
      content:
        "Today we're talking about [PRODUCT NAME]. I've tested it against [COMPETITOR] and the results surprised me. Let's get into it.",
    },
  ],
};

// Compute word counts for demo data
[DEMO_SCRIPT_1, DEMO_SCRIPT_2, DEMO_SCRIPT_3].forEach((s) => {
  s.wordCount = computeWordCount(s.sections);
  s.readingTimeSec = computeReadingTime(s.wordCount);
});

// ─── Default Settings ─────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: PerformSettings = {
  mode: "scroll",
  fontSize: 52,
  scrollSpeed: 60,
  lineSpacing: 1.6,
  fontFamily: "sans",
  colorScheme: "dark",
  isMirrored: false,
  horizontalMargin: 10,
  showProgress: true,
  showSectionNav: true,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface StoreState {
  scripts: Record<string, Script>;
  setlists: Record<string, Setlist>;
  activeScriptId: string | null;
  activeSetlistId: string | null;
  performSettings: PerformSettings;
  isPerforming: boolean;
  currentSectionIndex: number;
  currentLineIndex: number;
  transposeSteps: number;

  // Setlist actions
  createSetlist: (name?: string) => string;
  updateSetlist: (id: string, updates: Partial<Setlist>) => void;
  deleteSetlist: (id: string) => void;
  addScriptToSetlist: (setlistId: string, scriptId: string) => void;
  removeScriptFromSetlist: (setlistId: string, scriptId: string) => void;
  reorderSetlist: (setlistId: string, scriptIds: string[]) => void;
  setActiveSetlist: (id: string | null) => void;

  // Script actions
  createScript: (partial?: Partial<Script>) => string;
  updateScript: (id: string, updates: Partial<Script>) => void;
  deleteScript: (id: string) => void;
  duplicateScript: (id: string) => string;
  setActiveScript: (id: string | null) => void;
  importScript: (title: string, text: string) => string;

  // Section actions
  addSection: (scriptId: string, type?: SectionType) => void;
  updateSection: (scriptId: string, sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (scriptId: string, sectionId: string) => void;
  reorderSections: (scriptId: string, sections: Section[]) => void;
  markSectionComplete: (scriptId: string, sectionId: string, done: boolean) => void;

  // Cue card actions
  setCueCard: (scriptId: string, sectionId: string, cueCard: CueCard | undefined) => void;

  // Perform actions
  startPerforming: () => void;
  stopPerforming: () => void;
  setCurrentSection: (index: number) => void;
  setCurrentLine: (index: number) => void;
  nextSection: () => void;
  prevSection: () => void;

  // Settings
  updatePerformSettings: (updates: Partial<PerformSettings>) => void;
  setMode: (mode: PlaybackMode) => void;
  setTranspose: (steps: number) => void;
  shiftTranspose: (delta: number) => void;
}

function refreshDerived(script: Script): Script {
  const wc = computeWordCount(script.sections);
  return { ...script, wordCount: wc, readingTimeSec: computeReadingTime(wc) };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      scripts: {
        "demo-1": DEMO_SCRIPT_1,
        "demo-2": DEMO_SCRIPT_2,
        "demo-3": DEMO_SCRIPT_3,
      },
      setlists: {},
      activeScriptId: "demo-1",
      activeSetlistId: null,
      performSettings: DEFAULT_SETTINGS,
      isPerforming: false,
      currentSectionIndex: 0,
      currentLineIndex: 0,
      transposeSteps: 0,

      // ── Setlists ──────────────────────────────────────────────────────────

      createSetlist: (name = "New Setlist") => {
        const id = uuid();
        const setlist: Setlist = {
          id, name,
          date: new Date().toISOString().slice(0, 10),
          venue: "",
          scriptIds: [],
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ setlists: { ...s.setlists, [id]: setlist }, activeSetlistId: id }));
        return id;
      },

      updateSetlist: (id, updates) =>
        set((s) => ({
          setlists: { ...s.setlists, [id]: { ...s.setlists[id], ...updates, updatedAt: now() } },
        })),

      deleteSetlist: (id) =>
        set((s) => {
          const setlists = { ...s.setlists };
          delete setlists[id];
          return { setlists, activeSetlistId: s.activeSetlistId === id ? null : s.activeSetlistId };
        }),

      addScriptToSetlist: (setlistId, scriptId) =>
        set((s) => {
          const sl = s.setlists[setlistId];
          if (!sl || sl.scriptIds.includes(scriptId)) return s;
          return { setlists: { ...s.setlists, [setlistId]: { ...sl, scriptIds: [...sl.scriptIds, scriptId], updatedAt: now() } } };
        }),

      removeScriptFromSetlist: (setlistId, scriptId) =>
        set((s) => {
          const sl = s.setlists[setlistId];
          if (!sl) return s;
          return { setlists: { ...s.setlists, [setlistId]: { ...sl, scriptIds: sl.scriptIds.filter((id) => id !== scriptId), updatedAt: now() } } };
        }),

      reorderSetlist: (setlistId, scriptIds) =>
        set((s) => ({
          setlists: { ...s.setlists, [setlistId]: { ...s.setlists[setlistId], scriptIds, updatedAt: now() } },
        })),

      setActiveSetlist: (id) => set({ activeSetlistId: id }),

      // ── Scripts ───────────────────────────────────────────────────────────

      createScript: (partial = {}) => {
        const id = uuid();
        const script: Script = refreshDerived({
          id,
          title: "Untitled Script",
          description: "",
          tags: [],
          sections: [
            { id: uuid(), type: "custom", label: "Section 1", content: "" },
          ],
          createdAt: now(),
          updatedAt: now(),
          wordCount: 0,
          readingTimeSec: 0,
          ...partial,
        });
        set((s) => ({
          scripts: { ...s.scripts, [id]: script },
          activeScriptId: id,
        }));
        return id;
      },

      updateScript: (id, updates) =>
        set((s) => {
          const updated = { ...s.scripts[id], ...updates, updatedAt: now() };
          return { scripts: { ...s.scripts, [id]: refreshDerived(updated) } };
        }),

      deleteScript: (id) =>
        set((s) => {
          const scripts = { ...s.scripts };
          delete scripts[id];
          return {
            scripts,
            activeScriptId: s.activeScriptId === id ? null : s.activeScriptId,
          };
        }),

      duplicateScript: (id) => {
        const src = get().scripts[id];
        if (!src) return id;
        const newId = uuid();
        const copy: Script = {
          ...src,
          id: newId,
          title: src.title + " (Copy)",
          sections: src.sections.map((s) => ({ ...s, id: uuid() })),
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({
          scripts: { ...s.scripts, [newId]: copy },
          activeScriptId: newId,
        }));
        return newId;
      },

      setActiveScript: (id) =>
        set({ activeScriptId: id, currentSectionIndex: 0, currentLineIndex: 0 }),

      importScript: (title, text) => {
        const id = uuid();
        // Split on double newlines to make sections
        const blocks = text.split(/\n{2,}/).filter(Boolean);
        const sections: Section[] = blocks.map((block, i) => ({
          id: uuid(),
          type: "custom" as SectionType,
          label: `Section ${i + 1}`,
          content: block.trim(),
        }));
        const script: Script = refreshDerived({
          id,
          title,
          description: "",
          tags: [],
          sections,
          createdAt: now(),
          updatedAt: now(),
          wordCount: 0,
          readingTimeSec: 0,
        });
        set((s) => ({
          scripts: { ...s.scripts, [id]: script },
          activeScriptId: id,
        }));
        return id;
      },

      // ── Sections ──────────────────────────────────────────────────────────

      addSection: (scriptId, type = "custom") => {
        const script = get().scripts[scriptId];
        if (!script) return;
        const existing = script.sections.filter((s) => s.type === type).length;
        const labelMap: Record<SectionType, string> = {
          intro: "Intro",
          verse: `Verse ${existing + 1}`,
          "pre-chorus": "Pre-Chorus",
          chorus: `Chorus ${existing + 1}`,
          bridge: "Bridge",
          outro: "Outro",
          solo: "Solo",
          spoken: "Spoken Word",
          custom: `Section ${script.sections.length + 1}`,
        };
        const section: Section = {
          id: uuid(),
          type,
          label: labelMap[type],
          content: "",
        };
        set((s) => {
          const updated = {
            ...s.scripts[scriptId],
            sections: [...s.scripts[scriptId].sections, section],
            updatedAt: now(),
          };
          return { scripts: { ...s.scripts, [scriptId]: refreshDerived(updated) } };
        });
      },

      updateSection: (scriptId, sectionId, updates) =>
        set((s) => {
          const script = s.scripts[scriptId];
          const updated = {
            ...script,
            sections: script.sections.map((sec) =>
              sec.id === sectionId ? { ...sec, ...updates } : sec
            ),
            updatedAt: now(),
          };
          return { scripts: { ...s.scripts, [scriptId]: refreshDerived(updated) } };
        }),

      deleteSection: (scriptId, sectionId) =>
        set((s) => {
          const script = s.scripts[scriptId];
          const updated = {
            ...script,
            sections: script.sections.filter((sec) => sec.id !== sectionId),
            updatedAt: now(),
          };
          return { scripts: { ...s.scripts, [scriptId]: refreshDerived(updated) } };
        }),

      reorderSections: (scriptId, sections) =>
        set((s) => {
          const updated = { ...s.scripts[scriptId], sections, updatedAt: now() };
          return { scripts: { ...s.scripts, [scriptId]: refreshDerived(updated) } };
        }),

      markSectionComplete: (scriptId, sectionId, done) => {
        get().updateSection(scriptId, sectionId, { completed: done });
      },

      // ── Cue Cards ─────────────────────────────────────────────────────────

      setCueCard: (scriptId, sectionId, cueCard) => {
        get().updateSection(scriptId, sectionId, { cueCard });
      },

      // ── Perform ───────────────────────────────────────────────────────────

      startPerforming: () =>
        set({ isPerforming: true, currentSectionIndex: 0, currentLineIndex: 0 }),

      stopPerforming: () => set({ isPerforming: false }),

      setCurrentSection: (index) =>
        set({ currentSectionIndex: index, currentLineIndex: 0 }),

      setCurrentLine: (index) => set({ currentLineIndex: index }),

      nextSection: () => {
        const { activeScriptId, scripts, currentSectionIndex } = get();
        if (!activeScriptId) return;
        const script = scripts[activeScriptId];
        if (!script) return;
        if (currentSectionIndex < script.sections.length - 1) {
          set({ currentSectionIndex: currentSectionIndex + 1, currentLineIndex: 0 });
        }
      },

      prevSection: () => {
        const { currentSectionIndex } = get();
        if (currentSectionIndex > 0) {
          set({ currentSectionIndex: currentSectionIndex - 1, currentLineIndex: 0 });
        }
      },

      // ── Settings ──────────────────────────────────────────────────────────

      updatePerformSettings: (updates) =>
        set((s) => ({ performSettings: { ...s.performSettings, ...updates } })),

      setMode: (mode) =>
        set((s) => ({ performSettings: { ...s.performSettings, mode } })),

      setTranspose: (steps) => set({ transposeSteps: steps }),

      shiftTranspose: (delta) =>
        set((s) => ({ transposeSteps: Math.max(-11, Math.min(11, s.transposeSteps + delta)) })),
    }),
    {
      name: "teleprompter-v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
