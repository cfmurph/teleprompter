"use client";

/**
 * Mobile Remote Control — /remote/[setlistId]
 *
 * Open on a phone or tablet. Sends commands to the Artist Display
 * and Operator Console via BroadcastChannel (same network, same browser session)
 * or via the Yjs WebRTC room for cross-device.
 *
 * Optimized for one-handed phone use: big tap targets, no tiny text.
 */

import { use, useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Minus,
  Plus,
  QrCode,
  Wifi,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useBroadcastSender } from "@/lib/broadcast";
import { ConsoleCommand } from "@/lib/types";

// ─── QR code (using a free API — no package needed) ──────────────────────────

function QRDisplay({ url }: { url: string }) {
  const encoded = encodeURIComponent(url);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&bgcolor=111111&color=ffffff&margin=10`;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="QR code" width={160} height={160} className="rounded-xl" />
      <p className="text-[10px] text-zinc-500 text-center break-all px-4 max-w-xs">{url}</p>
    </div>
  );
}

// ─── Big tap button ───────────────────────────────────────────────────────────

function TapButton({
  onClick,
  children,
  variant = "default",
  size = "md",
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg" | "xl";
  disabled?: boolean;
}) {
  const variants = {
    default: "bg-zinc-800 text-white active:bg-zinc-700",
    primary: "bg-blue-600 text-white active:bg-blue-500",
    danger: "bg-red-600 text-white active:bg-red-500",
    ghost: "bg-transparent text-zinc-400 active:bg-zinc-800",
  };
  const sizes = {
    sm: "h-12 px-4 text-sm rounded-xl",
    md: "h-16 px-6 text-base rounded-2xl",
    lg: "h-20 px-8 text-lg rounded-2xl",
    xl: "h-28 w-28 text-2xl rounded-3xl flex items-center justify-center",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant]} ${sizes[size]} font-semibold select-none touch-manipulation transition-transform active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2`}
    >
      {children}
    </button>
  );
}

// ─── Remote page ──────────────────────────────────────────────────────────────

export default function RemotePage({
  params,
}: {
  params: Promise<{ setlistId: string }>;
}) {
  const { setlistId } = use(params);
  const { setlists, scripts, activeScriptId } = useStore();
  const { send } = useBroadcastSender(setlistId);

  const setlist = setlists[setlistId];
  const activeScript = activeScriptId ? scripts[activeScriptId] : null;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [transpose, setTranspose] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [feedback, setFeedback] = useState("");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const displayUrl = typeof window !== "undefined"
    ? `${window.location.origin}/perform/display?setlist=${setlistId}`
    : "";

  function flash(msg: string) {
    setFeedback(msg);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(""), 1200);
  }

  function dispatch(cmd: ConsoleCommand, label?: string) {
    send(cmd);
    if (label) flash(label);
  }

  function prevSection() {
    setCurrentSection((i) => Math.max(0, i - 1));
    dispatch({ type: "PREV_SECTION" }, "◀ Prev");
  }

  function nextSection() {
    setCurrentSection((i) => i + 1);
    dispatch({ type: "NEXT_SECTION" }, "Next ▶");
  }

  function togglePlay() {
    setIsPlaying((v) => !v);
    dispatch({ type: "PLAY_PAUSE" }, isPlaying ? "⏸ Pause" : "▶ Play");
  }

  function transposeUp() {
    const n = Math.min(11, transpose + 1);
    setTranspose(n);
    dispatch({ type: "SET_TRANSPOSE", steps: n }, `Key +${n}`);
  }

  function transposeDown() {
    const n = Math.max(-11, transpose - 1);
    setTranspose(n);
    dispatch({ type: "SET_TRANSPOSE", steps: n }, `Key ${n}`);
  }

  const sectionLabel = activeScript?.sections[currentSection]?.label ?? "—";
  const totalSections = activeScript?.sections.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col select-none">
      {/* Header */}
      <div className="px-5 pt-8 pb-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Remote</p>
            <h1 className="text-base font-bold mt-0.5 truncate max-w-[200px]">
              {setlist?.name ?? "No setlist"}
            </h1>
          </div>
          <button
            onClick={() => setShowQR((v) => !v)}
            className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 active:bg-zinc-700"
          >
            <QrCode className="h-5 w-5" />
          </button>
        </div>

        {/* QR code for display URL */}
        {showQR && (
          <div className="mt-4 py-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-400 text-center mb-3">Scan to open Artist Display</p>
            <QRDisplay url={displayUrl} />
          </div>
        )}
      </div>

      {/* Current song + section */}
      <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900">
        <p className="text-xs text-zinc-500">{activeScript?.title ?? "No song selected"}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-lg font-bold text-blue-400">{sectionLabel}</p>
          <p className="text-xs text-zinc-500">
            {currentSection + 1} / {totalSections || "—"}
          </p>
        </div>
        {/* Section dots */}
        {totalSections > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {activeScript?.sections.map((sec, i) => (
              <button
                key={sec.id}
                onClick={() => {
                  setCurrentSection(i);
                  dispatch({ type: "GOTO_SECTION", index: i }, sec.label);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentSection ? "bg-blue-500 w-6" : "bg-zinc-700 w-1.5"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Feedback flash */}
      <div className={`text-center py-2 text-sm font-semibold text-blue-400 transition-opacity ${feedback ? "opacity-100" : "opacity-0"}`}>
        {feedback || "—"}
      </div>

      {/* Main controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-4">
        {/* Song navigation */}
        <div className="flex gap-3 w-full">
          <TapButton onClick={() => dispatch({ type: "PREV_SCRIPT" }, "◀◀ Song")} variant="ghost" size="sm">
            <SkipBack className="h-4 w-4" /> Song
          </TapButton>
          <div className="flex-1" />
          <TapButton onClick={() => dispatch({ type: "NEXT_SCRIPT" }, "Song ▶▶")} variant="ghost" size="sm">
            Song <SkipForward className="h-4 w-4" />
          </TapButton>
        </div>

        {/* Prev / Play / Next — the main 3 */}
        <div className="flex items-center gap-4 w-full justify-center">
          <TapButton onClick={prevSection} size="lg">
            <ChevronLeft className="h-8 w-8" />
          </TapButton>

          <TapButton onClick={togglePlay} variant="primary" size="xl">
            {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current" />}
          </TapButton>

          <TapButton onClick={nextSection} size="lg">
            <ChevronRight className="h-8 w-8" />
          </TapButton>
        </div>

        {/* Transpose */}
        <div className="flex items-center gap-4 w-full justify-center">
          <TapButton onClick={transposeDown} size="md">
            <Minus className="h-5 w-5" /> Key
          </TapButton>
          <div className="w-20 text-center">
            <p className="text-2xl font-mono font-bold">
              {transpose === 0 ? "±0" : transpose > 0 ? `+${transpose}` : transpose}
            </p>
            <p className="text-[10px] text-zinc-500">semitones</p>
          </div>
          <TapButton onClick={transposeUp} size="md">
            Key <Plus className="h-5 w-5" />
          </TapButton>
        </div>
      </div>

      {/* Setlist quick-jump */}
      {setlist && setlist.scriptIds.length > 0 && (
        <div className="border-t border-zinc-800 px-5 py-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">Setlist</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {setlist.scriptIds.map((id, i) => {
              const song = scripts[id];
              if (!song) return null;
              const isActive = id === activeScriptId;
              return (
                <button
                  key={id}
                  onClick={() => dispatch({ type: "GOTO_SCRIPT", scriptId: id }, song.title)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    isActive ? "bg-blue-600/20 text-blue-300" : "bg-zinc-900 text-zinc-300 active:bg-zinc-800"
                  }`}
                >
                  <span className="text-xs text-zinc-500 w-5 text-right font-mono">{i + 1}</span>
                  <span className="text-sm font-medium truncate">{song.title}</span>
                  {song.key && <span className="text-xs text-blue-400 shrink-0">{song.key}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
