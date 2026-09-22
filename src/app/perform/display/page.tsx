"use client";

/**
 * Artist Display — controlled by the Operator Console via BroadcastChannel.
 *
 * Open this in a second window/monitor. The console sends commands and
 * this display reacts instantly. The artist only ever sees clean text.
 *
 * URL: /perform/display?setlist=<setlistId>
 */

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useBroadcastReceiver } from "@/lib/broadcast";
import { ConsoleCommand, ColorScheme } from "@/lib/types";
import { parseContent } from "@/lib/chord-utils";

// ─── Color schemes (same as perform page) ────────────────────────────────────

const SCHEMES = {
  dark:  { bg: "#0a0a0a", text: "#f5f5f5", chord: "#3b82f6", muted: "#525252" },
  light: { bg: "#fafafa", text: "#111111", chord: "#2563eb", muted: "#737373" },
  amber: { bg: "#1a1000", text: "#fbbf24", chord: "#f59e0b", muted: "#92400e" },
  green: { bg: "#001a0a", text: "#4ade80", chord: "#22c55e", muted: "#166534" },
};

// ─── Chord line renderer ──────────────────────────────────────────────────────

function ChordLine({
  content,
  transposeSteps,
  fontSize,
  lineSpacing,
  textColor,
  chordColor,
  showChords,
  isActive,
  mode,
  mutedColor,
}: {
  content: string;
  transposeSteps: number;
  fontSize: number;
  lineSpacing: number;
  textColor: string;
  chordColor: string;
  showChords: boolean;
  isActive: boolean;
  mode: string;
  mutedColor: string;
}) {
  const lines = parseContent(content, transposeSteps);

  return (
    <div>
      {lines.map((line, li) => {
        const lineIsActive = mode === "highlight" || mode === "line" || mode === "arrow"
          ? isActive && li === 0
          : true;

        if (!line.hasChords || !showChords) {
          // Plain text line
          return (
            <div
              key={li}
              className="flex items-center gap-2"
              style={{
                fontSize,
                lineHeight: lineSpacing,
                color: mode === "highlight" && !lineIsActive ? mutedColor : textColor,
                marginBottom: showChords ? fontSize * 0.5 : 0,
              }}
            >
              {mode === "arrow" && lineIsActive && (
                <span style={{ color: chordColor, fontSize: fontSize * 0.6 }}>▶</span>
              )}
              <span>{line.segments.map((s) => s.text).join("")}</span>
            </div>
          );
        }

        // ChordPro line — render chord above each word
        return (
          <div key={li} style={{ marginBottom: fontSize * 0.6, lineHeight: 1 }}>
            {/* Chord row */}
            <div className="flex flex-wrap" style={{ minHeight: fontSize * 0.9 }}>
              {line.segments.map((seg, si) => (
                <div key={si} className="relative" style={{ marginRight: seg.chord ? "0.15em" : 0 }}>
                  {seg.chord && (
                    <div
                      style={{
                        fontSize: fontSize * 0.55,
                        color: chordColor,
                        fontWeight: 700,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        marginBottom: 2,
                      }}
                    >
                      {seg.chord}
                    </div>
                  )}
                  {!seg.chord && <div style={{ minHeight: fontSize * 0.55 }} />}
                </div>
              ))}
            </div>
            {/* Lyric row */}
            <div
              className="flex flex-wrap items-center"
              style={{
                fontSize,
                lineHeight: lineSpacing,
                color: textColor,
              }}
            >
              {mode === "arrow" && lineIsActive && (
                <span style={{ color: chordColor, fontSize: fontSize * 0.6, marginRight: "0.5em" }}>▶</span>
              )}
              {line.segments.map((seg, si) => (
                <span key={si}>{seg.text || (seg.chord ? "\u00A0" : "")}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Display inner ────────────────────────────────────────────────────────────

function DisplayInner() {
  const searchParams = useSearchParams();
  const setlistId = searchParams.get("setlist") ?? "";

  const {
    scripts, setlists,
    activeScriptId, setActiveScript,
    currentSectionIndex, setCurrentSection,
    nextSection, prevSection,
    performSettings: s,
    updatePerformSettings,
    transposeSteps, setTranspose,
  } = useStore();

  const [localSectionIndex, setLocalSectionIndex] = useState(0);
  const [localScriptId, setLocalScriptId] = useState<string | null>(null);
  const [localTranspose, setLocalTranspose] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const scheme = SCHEMES[s.colorScheme as ColorScheme] ?? SCHEMES.dark;

  // The active script: prefer local override from console commands
  const scriptId = localScriptId || activeScriptId;
  const script = scriptId ? scripts[scriptId] : null;
  const setlist = setlistId ? setlists[setlistId] : null;
  const section = script?.sections[localSectionIndex];

  // ── Receive console commands ───────────────────────────────────────────

  const handleCommand = useCallback((cmd: ConsoleCommand) => {
    switch (cmd.type) {
      case "GOTO_SCRIPT":
        setLocalScriptId(cmd.scriptId);
        setLocalSectionIndex(0);
        break;
      case "GOTO_SECTION":
        setLocalSectionIndex(cmd.index);
        break;
      case "NEXT_SECTION":
        setLocalSectionIndex((i) => {
          const max = (script?.sections.length ?? 1) - 1;
          if (i < max) return i + 1;
          // Next song in setlist
          if (setlist && scriptId) {
            const si = setlist.scriptIds.indexOf(scriptId);
            if (si < setlist.scriptIds.length - 1) {
              setLocalScriptId(setlist.scriptIds[si + 1]);
              return 0;
            }
          }
          return i;
        });
        break;
      case "PREV_SECTION":
        setLocalSectionIndex((i) => (i > 0 ? i - 1 : 0));
        break;
      case "NEXT_SCRIPT":
        if (setlist && scriptId) {
          const si = setlist.scriptIds.indexOf(scriptId);
          if (si < setlist.scriptIds.length - 1) {
            setLocalScriptId(setlist.scriptIds[si + 1]);
            setLocalSectionIndex(0);
          }
        }
        break;
      case "PREV_SCRIPT":
        if (setlist && scriptId) {
          const si = setlist.scriptIds.indexOf(scriptId);
          if (si > 0) {
            setLocalScriptId(setlist.scriptIds[si - 1]);
            setLocalSectionIndex(0);
          }
        }
        break;
      case "PLAY_PAUSE":
        setIsScrolling((v) => {
          if (v) {
            cancelAnimationFrame(animRef.current);
            lastTimeRef.current = 0;
          }
          return !v;
        });
        break;
      case "UPDATE_SETTINGS":
        updatePerformSettings(cmd.settings);
        break;
      case "SET_TRANSPOSE":
        setLocalTranspose(cmd.steps);
        break;
    }
  }, [script, setlist, scriptId, updatePerformSettings]);

  useBroadcastReceiver(setlistId, handleCommand);

  // Reset scroll on section change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    lastTimeRef.current = 0;
  }, [localSectionIndex, localScriptId]);

  // Scroll animation
  const scrollFn = useCallback((ts: number) => {
    if (!scrollRef.current) return;
    if (lastTimeRef.current === 0) lastTimeRef.current = ts;
    const delta = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    scrollRef.current.scrollTop += (s.scrollSpeed * delta) / 1000;
    animRef.current = requestAnimationFrame(scrollFn);
  }, [s.scrollSpeed]);

  useEffect(() => {
    if (isScrolling) {
      animRef.current = requestAnimationFrame(scrollFn);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isScrolling, scrollFn]);

  const marginPx = `${s.horizontalMargin}%`;
  const showChords = script?.hasChords && s.showProgress; // reuse showProgress as showChords toggle
  const transpose = localTranspose;

  if (!script || !section) {
    return (
      <div
        className="h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: scheme.bg, color: scheme.muted }}
      >
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color: scheme.text }}>Artist Display</p>
          <p className="text-sm mt-2">Waiting for Operator Console…</p>
          <p className="text-xs mt-4 opacity-60">Open the console and select a song.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden select-none"
      style={{ background: scheme.bg }}
    >
      {/* Song title bar (subtle, top) */}
      <div
        className="shrink-0 px-6 pt-4 pb-1 flex items-center justify-between"
        style={{ opacity: 0.4 }}
      >
        <span style={{ color: scheme.text, fontSize: 14, fontWeight: 600 }}>{script.title}</span>
        <span style={{ color: scheme.muted, fontSize: 12 }}>{section.label}</span>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto prompter-text"
        style={{
          paddingLeft: marginPx,
          paddingRight: marginPx,
          paddingTop: s.mode === "scroll" ? "20vh" : "8vh",
          paddingBottom: s.mode === "scroll" ? "60vh" : "8vh",
          transform: s.isMirrored ? "scaleX(-1)" : undefined,
        }}
      >
        {s.mode === "scroll" ? (
          // Show all sections stacked
          script.sections.map((sec, si) => (
            <div key={sec.id} className="mb-16">
              <ChordLine
                content={sec.content}
                transposeSteps={transpose}
                fontSize={s.fontSize}
                lineSpacing={s.lineSpacing}
                textColor={scheme.text}
                chordColor={scheme.chord}
                mutedColor={scheme.muted}
                showChords={!!script.hasChords}
                isActive={si === localSectionIndex}
                mode={s.mode}
              />
            </div>
          ))
        ) : (
          // Show current section only (slide mode)
          <ChordLine
            content={section.content}
            transposeSteps={transpose}
            fontSize={s.fontSize}
            lineSpacing={s.lineSpacing}
            textColor={scheme.text}
            chordColor={scheme.chord}
            mutedColor={scheme.muted}
            showChords={!!script.hasChords}
            isActive={true}
            mode={s.mode}
          />
        )}
      </div>
    </div>
  );
}

export default function ArtistDisplayPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-zinc-950" />}>
      <DisplayInner />
    </Suspense>
  );
}
