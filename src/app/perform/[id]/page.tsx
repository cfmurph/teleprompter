"use client";

import {
  use,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  Settings,
  Maximize2,
  Minimize2,
  AlignLeft,
  Highlighter,
  ArrowRight,
  List,
  FlipHorizontal,
  Sun,
  Moon,
  Minus,
  Plus,
  SkipBack,
  SkipForward,
  Bell,
  Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PlaybackMode, ColorScheme, Section } from "@/lib/types";
import MusicSyncPanel from "@/components/MusicSyncPanel";
import HotkeySheet from "@/components/HotkeySheet";

// ─── Color schemes ────────────────────────────────────────────────────────────

const COLOR_SCHEMES: Record<
  ColorScheme,
  { bg: string; text: string; muted: string; highlight: string; arrow: string }
> = {
  dark: {
    bg: "#0a0a0a",
    text: "#f5f5f5",
    muted: "#737373",
    highlight: "rgba(59,130,246,0.15)",
    arrow: "#3b82f6",
  },
  light: {
    bg: "#fafafa",
    text: "#111111",
    muted: "#737373",
    highlight: "rgba(59,130,246,0.12)",
    arrow: "#2563eb",
  },
  amber: {
    bg: "#1a1000",
    text: "#fbbf24",
    muted: "#92400e",
    highlight: "rgba(251,191,36,0.12)",
    arrow: "#f59e0b",
  },
  green: {
    bg: "#001a0a",
    text: "#4ade80",
    muted: "#166534",
    highlight: "rgba(74,222,128,0.12)",
    arrow: "#22c55e",
  },
};

// ─── Cue card overlay ─────────────────────────────────────────────────────────

type SchemeColors = { bg: string; text: string; muted: string; highlight: string; arrow: string };

function CueCardOverlay({
  label,
  countdownSec,
  autoResume,
  scheme,
  onResume,
}: {
  label: string;
  countdownSec: number;
  autoResume: boolean;
  scheme: SchemeColors;
  onResume: () => void;
}) {
  const [remaining, setRemaining] = useState(countdownSec);

  useEffect(() => {
    if (countdownSec === 0) {
      if (autoResume) onResume();
      return;
    }
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          if (autoResume) setTimeout(onResume, 500);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownSec, autoResume, onResume]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-8">
        <Bell className="h-12 w-12" style={{ color: scheme.arrow }} />
        <p className="text-2xl font-bold" style={{ color: scheme.text }}>
          {label}
        </p>
        {countdownSec > 0 && (
          <div
            className="text-6xl font-mono font-bold tabular-nums"
            style={{ color: scheme.arrow }}
          >
            {remaining}
          </div>
        )}
        <button
          onClick={onResume}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: scheme.arrow, color: scheme.bg }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── Teleprompter text renderer ───────────────────────────────────────────────

interface TextRendererProps {
  content: string;
  mode: PlaybackMode;
  activeLine: number;
  fontSize: number;
  lineSpacing: number;
  fontFamily: string;
  scheme: SchemeColors;
  isMirrored: boolean;
  onLineClick?: (lineIndex: number) => void;
}

function TextRenderer({
  content,
  mode,
  activeLine,
  fontSize,
  lineSpacing,
  fontFamily,
  scheme,
  isMirrored,
  onLineClick,
}: TextRendererProps) {
  const lines = content.split("\n");

  const fontFamilyMap: Record<string, string> = {
    sans: "var(--font-geist-sans), system-ui, sans-serif",
    mono: "var(--font-geist-mono), monospace",
    serif: "Georgia, 'Times New Roman', serif",
  };

  return (
    <div
      style={{
        transform: isMirrored ? "scaleX(-1)" : undefined,
        fontFamily: fontFamilyMap[fontFamily] || fontFamilyMap.sans,
      }}
    >
      {lines.map((line, i) => {
        const isActive = i === activeLine;
        const isEmpty = line.trim() === "";

        const lineStyle: React.CSSProperties = {
          fontSize,
          lineHeight: lineSpacing,
          color:
            mode === "highlight"
              ? isActive
                ? scheme.text
                : scheme.muted
              : mode === "line"
              ? isActive
                ? scheme.text
                : "transparent"
              : scheme.text,
          background:
            mode === "highlight" && isActive ? scheme.highlight : undefined,
          borderRadius: mode === "highlight" && isActive ? "6px" : undefined,
          paddingLeft: mode === "highlight" && isActive ? "8px" : mode === "arrow" && isActive ? "0" : undefined,
          paddingRight: mode === "highlight" && isActive ? "8px" : undefined,
          transition: "color 0.2s, background 0.2s",
          cursor: onLineClick ? "pointer" : undefined,
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          gap: mode === "arrow" && isActive ? "0.5em" : undefined,
          minHeight: isEmpty ? `${fontSize * lineSpacing * 0.5}px` : undefined,
        };

        return (
          <div
            key={i}
            style={lineStyle}
            onClick={() => onLineClick?.(i)}
          >
            {mode === "arrow" && isActive && !isEmpty && (
              <span style={{ color: scheme.arrow, fontSize: fontSize * 0.6, flexShrink: 0 }}>▶</span>
            )}
            <span>{line || "\u00A0"}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { performSettings, updatePerformSettings, setMode } = useStore();
  const s = performSettings;

  const MODES: { mode: PlaybackMode; label: string; icon: React.ReactNode }[] = [
    { mode: "scroll", label: "Scroll", icon: <AlignLeft className="h-4 w-4" /> },
    { mode: "highlight", label: "Highlight", icon: <Highlighter className="h-4 w-4" /> },
    { mode: "line", label: "Line", icon: <List className="h-4 w-4" /> },
    { mode: "arrow", label: "Arrow", icon: <ArrowRight className="h-4 w-4" /> },
  ];

  const SCHEMES: { scheme: ColorScheme; label: string }[] = [
    { scheme: "dark", label: "Dark" },
    { scheme: "light", label: "Light" },
    { scheme: "amber", label: "Amber" },
    { scheme: "green", label: "Green" },
  ];

  return (
    <div className="absolute right-4 top-16 z-50 w-72 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Settings</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Playback mode */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Playback Mode</label>
        <div className="grid grid-cols-4 gap-1">
          {MODES.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                s.mode === mode
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">
          Font Size — {s.fontSize}px
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updatePerformSettings({ fontSize: Math.max(16, s.fontSize - 4) })}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={16}
            max={120}
            step={2}
            value={s.fontSize}
            onChange={(e) => updatePerformSettings({ fontSize: parseInt(e.target.value) })}
            className="flex-1 accent-blue-500"
          />
          <button
            onClick={() => updatePerformSettings({ fontSize: Math.min(120, s.fontSize + 4) })}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Scroll speed */}
      {s.mode === "scroll" && (
        <div className="space-y-2">
          <label className="text-xs text-zinc-400">
            Scroll Speed — {s.scrollSpeed}px/s
          </label>
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={s.scrollSpeed}
            onChange={(e) =>
              updatePerformSettings({ scrollSpeed: parseInt(e.target.value) })
            }
            className="w-full accent-blue-500"
          />
        </div>
      )}

      {/* Line spacing */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">
          Line Spacing — {s.lineSpacing}×
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={s.lineSpacing}
          onChange={(e) =>
            updatePerformSettings({ lineSpacing: parseFloat(e.target.value) })
          }
          className="w-full accent-blue-500"
        />
      </div>

      {/* Margin */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">
          Horizontal Margin — {s.horizontalMargin}%
        </label>
        <input
          type="range"
          min={0}
          max={40}
          step={2}
          value={s.horizontalMargin}
          onChange={(e) =>
            updatePerformSettings({ horizontalMargin: parseInt(e.target.value) })
          }
          className="w-full accent-blue-500"
        />
      </div>

      {/* Font */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Font</label>
        <div className="flex gap-1">
          {(["sans", "mono", "serif"] as const).map((f) => (
            <button
              key={f}
              onClick={() => updatePerformSettings({ fontFamily: f })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                s.fontFamily === f
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Color scheme */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Color Scheme</label>
        <div className="grid grid-cols-4 gap-1">
          {SCHEMES.map(({ scheme, label }) => (
            <button
              key={scheme}
              onClick={() => updatePerformSettings({ colorScheme: scheme })}
              className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                s.colorScheme === scheme
                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-900"
                  : ""
              }`}
              style={{
                background: COLOR_SCHEMES[scheme].bg,
                color: COLOR_SCHEMES[scheme].text,
                border: `1px solid ${COLOR_SCHEMES[scheme].muted}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        {[
          { key: "isMirrored", label: "Mirror Mode" },
          { key: "showProgress", label: "Show Progress" },
          { key: "showSectionNav", label: "Section Nav" },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <span className="text-xs text-zinc-400">{label}</span>
            <div
              className={`relative w-9 h-5 rounded-full transition-colors ${
                s[key as keyof typeof s] ? "bg-blue-600" : "bg-zinc-700"
              }`}
              onClick={() =>
                updatePerformSettings({ [key]: !s[key as keyof typeof s] })
              }
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  s[key as keyof typeof s] ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main perform page ────────────────────────────────────────────────────────

export default function PerformPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const {
    scripts,
    performSettings: s,
    currentSectionIndex,
    currentLineIndex,
    setCurrentSection,
    setCurrentLine,
    nextSection,
    prevSection,
    markSectionComplete,
  } = useStore();

  const script = scripts[id];
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showMusicSync, setShowMusicSync] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showCueCard, setShowCueCard] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheme = COLOR_SCHEMES[s.colorScheme];
  const currentSection: Section | undefined = script?.sections[currentSectionIndex];

  // ── Auto-hide controls ───────────────────────────────────────────────────

  function resetControlsTimer() {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isScrolling) setShowControls(false);
    }, 3000);
  }

  // ── Scroll mode ──────────────────────────────────────────────────────────

  const scroll = useCallback(
    (ts: number) => {
      if (!scrollRef.current) return;
      if (lastTimeRef.current === 0) lastTimeRef.current = ts;
      const delta = ts - lastTimeRef.current;
      lastTimeRef.current = ts;
      scrollRef.current.scrollTop += (s.scrollSpeed * delta) / 1000;
      animRef.current = requestAnimationFrame(scroll);
    },
    [s.scrollSpeed]
  );

  function toggleScroll() {
    if (isScrolling) {
      cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
      setIsScrolling(false);
      setShowControls(true);
    } else {
      setIsScrolling(true);
      animRef.current = requestAnimationFrame(scroll);
      resetControlsTimer();
    }
  }

  useEffect(() => {
    if (isScrolling) {
      cancelAnimationFrame(animRef.current);
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(scroll);
    }
  }, [scroll, isScrolling]);

  // ── Fullscreen ───────────────────────────────────────────────────────────

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (s.mode === "scroll") {
            toggleScroll();
          } else {
            nextSection();
          }
          break;
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          if (s.mode === "scroll") {
            scrollRef.current!.scrollTop += s.fontSize * 3;
          } else if (s.mode === "line" || s.mode === "highlight" || s.mode === "arrow") {
            const lines = currentSection?.content.split("\n") ?? [];
            if (currentLineIndex < lines.length - 1) {
              setCurrentLine(currentLineIndex + 1);
            } else {
              nextSection();
            }
          } else {
            nextSection();
          }
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          if (s.mode === "scroll") {
            scrollRef.current!.scrollTop -= s.fontSize * 3;
          } else if (s.mode === "line" || s.mode === "highlight" || s.mode === "arrow") {
            if (currentLineIndex > 0) {
              setCurrentLine(currentLineIndex - 1);
            } else {
              prevSection();
            }
          } else {
            prevSection();
          }
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement) document.exitFullscreen();
          else router.push(`/script/${id}`);
          break;
        case "?":
          setShowHotkeys((v) => !v);
          break;
        case "m": case "M":
          useStore.getState().updatePerformSettings({ isMirrored: !s.isMirrored });
          break;
        case "s": case "S":
          useStore.getState().setMode("scroll");
          break;
        case "h": case "H":
          useStore.getState().setMode("highlight");
          break;
        case "l": case "L":
          useStore.getState().setMode("line");
          break;
        case "a": case "A":
          if (!e.metaKey && !e.ctrlKey) useStore.getState().setMode("arrow");
          break;
        case "+": case "=":
          useStore.getState().updatePerformSettings({ fontSize: Math.min(120, s.fontSize + 4) });
          break;
        case "-":
          useStore.getState().updatePerformSettings({ fontSize: Math.max(16, s.fontSize - 4) });
          break;
        case "1": case "2": case "3": case "4": case "5":
        case "6": case "7": case "8": case "9":
          if (s.mode === "scroll") {
            const speeds = [30, 45, 60, 80, 100, 130, 165, 210, 260];
            useStore.getState().updatePerformSettings({ scrollSpeed: speeds[parseInt(e.key) - 1] });
          }
          break;
        case "0":
          if (s.mode === "scroll") { cancelAnimationFrame(animRef.current); lastTimeRef.current = 0; setIsScrolling(false); }
          break;
        case "b": case "B":
          setShowMusicSync((v) => !v);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.mode, s.scrollSpeed, currentLineIndex, currentSection, isScrolling, id]);

  // ── Section change → reset scroll & check cue card ───────────────────────

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (currentSection?.cueCard) {
      setIsScrolling(false);
      cancelAnimationFrame(animRef.current);
      setShowCueCard(true);
    }
  }, [currentSectionIndex]);

  // ── Mark section complete on advance ────────────────────────────────────

  function goNext() {
    if (script) markSectionComplete(id, currentSection!.id, true);
    nextSection();
  }

  function goPrev() {
    prevSection();
  }

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Script not found.</p>
      </div>
    );
  }

  const progress = script.sections.length
    ? ((currentSectionIndex + 1) / script.sections.length) * 100
    : 0;

  const marginPx = `${s.horizontalMargin}%`;

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col select-none"
      style={{ background: scheme.bg }}
      onMouseMove={resetControlsTimer}
      onClick={() => {
        if (!showSettings) {
          if (s.mode !== "scroll") {
            goNext();
          }
        }
        setShowSettings(false);
      }}
    >
      {/* Progress bar */}
      {s.showProgress && (
        <div
          className="absolute top-0 left-0 h-1 z-30 transition-all duration-300"
          style={{ width: `${progress}%`, background: scheme.arrow }}
        />
      )}

      {/* Section nav bar */}
      {s.showSectionNav && showControls && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {script.sections.map((sec, i) => (
            <button
              key={sec.id}
              onClick={() => setCurrentSection(i)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                i === currentSectionIndex
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
              style={
                i === currentSectionIndex
                  ? { background: scheme.arrow }
                  : undefined
              }
            >
              {sec.label}
            </button>
          ))}
        </div>
      )}

      {/* Top-right controls */}
      <div
        className={`absolute top-4 right-4 z-40 flex items-center gap-2 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { setShowMusicSync((v) => !v); setShowSettings(false); }}
          className={`w-9 h-9 rounded-xl backdrop-blur-sm flex items-center justify-center transition-colors ${
            showMusicSync ? "bg-blue-600 text-white" : "bg-black/40 text-white/70 hover:text-white hover:bg-black/60"
          }`}
          title="Music Sync (BPM / SMPTE / Voice)"
        >
          <Zap className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setShowSettings((v) => !v); setShowMusicSync(false); }}
          className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => setShowHotkeys(true)}
          className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors text-xs font-bold"
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
        <button
          onClick={() => router.push(`/script/${id}`)}
          className="w-9 h-9 rounded-xl bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div onClick={(e) => e.stopPropagation()}>
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </div>
      )}

      {/* Music sync panel */}
      {showMusicSync && (
        <div onClick={(e) => e.stopPropagation()}>
          <MusicSyncPanel
            scriptId={id}
            onScrollSpeedChange={(speed) => {
              useStore.getState().updatePerformSettings({ scrollSpeed: speed });
            }}
            onSectionChange={(index) => setCurrentSection(index)}
            onLineChange={(index) => setCurrentLine(index)}
            onClose={() => setShowMusicSync(false)}
          />
        </div>
      )}

      {/* Main content area */}
      {s.mode === "scroll" ? (
        // ── SCROLL MODE ──────────────────────────────────────────────────────
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto prompter-text"
          style={{ paddingTop: "40vh", paddingBottom: "60vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ paddingLeft: marginPx, paddingRight: marginPx }}>
            {script.sections.map((section, si) => (
              <div key={section.id} className="mb-12">
                {s.showSectionNav && (
                  <div
                    className="text-xs font-semibold mb-3 tracking-wider uppercase"
                    style={{ color: scheme.muted }}
                  >
                    {section.label}
                  </div>
                )}
                <div
                  className="whitespace-pre-wrap"
                  style={{
                    fontSize: s.fontSize,
                    lineHeight: s.lineSpacing,
                    color: scheme.text,
                    transform: s.isMirrored ? "scaleX(-1)" : undefined,
                  }}
                >
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // ── SLIDE MODES (highlight / line / arrow) ───────────────────────────
        <div
          className="flex-1 flex flex-col justify-center prompter-text overflow-hidden"
          style={{ paddingLeft: marginPx, paddingRight: marginPx }}
        >
          {currentSection && (
            <TextRenderer
              content={currentSection.content}
              mode={s.mode}
              activeLine={currentLineIndex}
              fontSize={s.fontSize}
              lineSpacing={s.lineSpacing}
              fontFamily={s.fontFamily}
              scheme={scheme}
              isMirrored={s.isMirrored}
              onLineClick={(i) => setCurrentLine(i)}
            />
          )}
        </div>
      )}

      {/* Bottom control bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-t from-black/60 to-transparent">
          {/* Prev section */}
          <button
            onClick={goPrev}
            disabled={currentSectionIndex === 0}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white disabled:opacity-30 transition-colors"
          >
            <SkipBack className="h-4 w-4" />
            <span className="hidden sm:block">Previous</span>
          </button>

          {/* Center — play/pause for scroll, section info for slide */}
          <div className="flex flex-col items-center gap-1">
            {s.mode === "scroll" ? (
              <button
                onClick={toggleScroll}
                className="w-12 h-12 rounded-full flex items-center justify-center text-white"
                style={{ background: scheme.arrow }}
              >
                {isScrolling ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current" />
                )}
              </button>
            ) : (
              <div className="text-center">
                <p className="text-white text-sm font-medium">
                  {currentSection?.label}
                </p>
                <p className="text-white/50 text-xs">
                  {currentSectionIndex + 1} / {script.sections.length}
                </p>
              </div>
            )}
          </div>

          {/* Next section */}
          <button
            onClick={goNext}
            disabled={currentSectionIndex === script.sections.length - 1}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white disabled:opacity-30 transition-colors"
          >
            <span className="hidden sm:block">Next</span>
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="text-center pb-3">
          <p className="text-xs" style={{ color: scheme.muted }}>
            {s.mode === "scroll"
              ? "Space to play/pause · ↑↓ to scroll · F for fullscreen"
              : "Space or click to advance · ↑↓ for lines · Esc to exit"}
          </p>
        </div>
      </div>

      {/* Hotkey sheet */}
      {showHotkeys && <HotkeySheet onClose={() => setShowHotkeys(false)} />}

      {/* Cue card overlay */}
      {showCueCard && currentSection?.cueCard && (
        <CueCardOverlay
          label={currentSection.cueCard.label}
          countdownSec={currentSection.cueCard.countdownSec}
          autoResume={currentSection.cueCard.autoResume}
          scheme={scheme}
          onResume={() => setShowCueCard(false)}
        />
      )}
    </div>
  );
}
