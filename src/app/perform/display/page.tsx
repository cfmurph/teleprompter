"use client";

/**
 * Artist Display — controlled by the Operator Console via BroadcastChannel.
 * Styled to match HiWirePrompter: pure black bg, large white text,
 * left-rail blue arrow, prominent section label, zero chrome.
 */

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useBroadcastReceiver } from "@/lib/broadcast";
import { applyGotoLine, applySmpteLock } from "@/lib/console-commands";
import { parseContent } from "@/lib/chord-utils";
import type { ColorScheme, ConsoleCommand } from "@/lib/types";

// ─── Color schemes ────────────────────────────────────────────────────────────

const SCHEMES = {
  dark:  { bg: "#000000", text: "#ffffff", chord: "#3b82f6", muted: "#404040", arrow: "#3b82f6", label: "#3b82f6" },
  light: { bg: "#f5f5f5", text: "#111111", chord: "#2563eb", muted: "#999999", arrow: "#2563eb", label: "#2563eb" },
  amber: { bg: "#0d0800", text: "#fbbf24", chord: "#f59e0b", muted: "#6b4a00", arrow: "#f59e0b", label: "#f59e0b" },
  green: { bg: "#000d05", text: "#4ade80", chord: "#22c55e", muted: "#1a4d2e", arrow: "#22c55e", label: "#22c55e" },
};

type Scheme = typeof SCHEMES.dark;

// ─── ChordPro line renderer ───────────────────────────────────────────────────

function renderLine(
  line: ReturnType<typeof parseContent>[number],
  fontSize: number,
  lineSpacing: number,
  scheme: Scheme,
  showChords: boolean,
  isArrow: boolean,
  isActive: boolean,
  mode: string
) {
  const textColor = mode === "highlight"
    ? isActive ? scheme.text : scheme.muted
    : scheme.text;

  if (!line.hasChords || !showChords) {
    return (
      <span style={{ color: textColor, display: "block", lineHeight: lineSpacing }}>
        {line.segments.map((s) => s.text).join("") || "\u00A0"}
      </span>
    );
  }

  return (
    <div style={{ marginBottom: fontSize * 0.5 }}>
      {/* Chord row */}
      <div style={{ display: "flex", flexWrap: "wrap", minHeight: fontSize * 0.7, lineHeight: 1 }}>
        {line.segments.map((seg, i) => (
          <span key={i} style={{ marginRight: "0.15em", display: "inline-block" }}>
            {seg.chord ? (
              <span style={{ fontSize: fontSize * 0.55, color: scheme.chord, fontWeight: 700, display: "block" }}>
                {seg.chord}
              </span>
            ) : (
              <span style={{ fontSize: fontSize * 0.55, display: "block", visibility: "hidden" }}>|</span>
            )}
          </span>
        ))}
      </div>
      {/* Lyric row */}
      <div style={{ display: "flex", flexWrap: "wrap", fontSize, lineHeight: lineSpacing, color: textColor }}>
        {line.segments.map((seg, i) => (
          <span key={i}>{seg.text || (seg.chord ? "\u00A0" : "")}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Section content block ────────────────────────────────────────────────────

function SectionBlock({
  content,
  transposeSteps,
  fontSize,
  lineSpacing,
  scheme,
  showChords,
  mode,
  activeLine,
}: {
  content: string;
  transposeSteps: number;
  fontSize: number;
  lineSpacing: number;
  scheme: Scheme;
  showChords: boolean;
  mode: string;
  activeLine: number;
}) {
  const lines = parseContent(content, transposeSteps);
  const leftRailWidth = fontSize * 1.8;

  return (
    <div>
      {lines.map((line, li) => {
        const isEmpty = line.segments.every((s) => !s.text && !s.chord);
        const isActive = li === activeLine;
        const showArrow = (mode === "arrow" || mode === "line") && isActive && !isEmpty;
        const highlightBg = mode === "highlight" && isActive && !isEmpty
          ? `${scheme.arrow}18`
          : "transparent";

        return (
          <div
            key={li}
            style={{
              display: "flex",
              alignItems: "flex-start",
              background: highlightBg,
              borderRadius: highlightBg !== "transparent" ? 6 : 0,
              marginBottom: isEmpty ? fontSize * 0.4 : 0,
            }}
          >
            {/* Left rail — arrow indicator */}
            <div
              style={{
                width: leftRailWidth,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "0.5em",
                paddingTop: showChords && line.hasChords ? fontSize * 0.7 : 0,
              }}
            >
              {showArrow && (
                <span
                  style={{
                    color: scheme.arrow,
                    fontSize: fontSize * 0.65,
                    fontWeight: 900,
                    lineHeight: 1,
                    transition: "opacity 0.1s",
                  }}
                >
                  ▶
                </span>
              )}
            </div>

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEmpty
                ? <div style={{ height: fontSize * lineSpacing * 0.3 }} />
                : renderLine(line, fontSize, lineSpacing, scheme, showChords, showArrow, isActive, mode)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section label header ─────────────────────────────────────────────────────

function SectionLabel({
  label,
  scheme,
  fontSize,
}: {
  label: string;
  scheme: Scheme;
  fontSize: number;
}) {
  return (
    <div
      style={{
        color: scheme.label,
        fontSize: fontSize * 0.38,
        fontWeight: 800,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        marginBottom: fontSize * 0.5,
        paddingLeft: fontSize * 1.8, // align with left rail
        opacity: 0.9,
      }}
    >
      {label}
    </div>
  );
}

// ─── Waiting screen ───────────────────────────────────────────────────────────

function WaitingScreen({ scheme }: { scheme: Scheme }) {
  return (
    <div
      style={{
        height: "100vh",
        background: scheme.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: scheme.arrow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        ▶
      </div>
      <p style={{ color: scheme.text, fontSize: 20, fontWeight: 700, margin: 0 }}>
        Artist Display
      </p>
      <p style={{ color: scheme.muted, fontSize: 14, margin: 0 }}>
        Waiting for Operator Console…
      </p>
    </div>
  );
}

// ─── Main display ─────────────────────────────────────────────────────────────

function DisplayInner() {
  const searchParams = useSearchParams();
  const setlistId = searchParams.get("setlist") ?? "";

  const {
    scripts, setlists,
    activeScriptId,
    performSettings: s,
    updatePerformSettings,
    transposeSteps,
  } = useStore();

  const [localSectionIndex, setLocalSectionIndex] = useState(0);
  const [localLineIndex, setLocalLineIndex] = useState(0);
  const [localScriptId, setLocalScriptId] = useState<string | null>(null);
  const [localTranspose, setLocalTranspose] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [blanking, setBlanking] = useState(false);
  const [standBy, setStandBy] = useState(false);
  const [smpteLock, setSmpteLock] = useState<{ locked: boolean; timecode: string }>({
    locked: false,
    timecode: "",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const scheme = SCHEMES[(s.colorScheme as ColorScheme)] ?? SCHEMES.dark;
  const scriptId = localScriptId || activeScriptId;
  const script = scriptId ? scripts[scriptId] : null;
  const setlist = setlistId ? setlists[setlistId] : null;
  const section = script?.sections[localSectionIndex];

  // ── Receive console commands ───────────────────────────────────────────────

  const handleCommand = useCallback((cmd: ConsoleCommand) => {
    switch (cmd.type) {
      case "GOTO_SCRIPT":
        setLocalScriptId(cmd.scriptId);
        setLocalSectionIndex(0);
        setLocalLineIndex(0);
        break;
      case "GOTO_SECTION":
        setLocalSectionIndex(cmd.index);
        setLocalLineIndex(0);
        break;
      case "NEXT_SECTION":
        setLocalSectionIndex((i) => {
          const max = (script?.sections.length ?? 1) - 1;
          if (i < max) { setLocalLineIndex(0); return i + 1; }
          if (setlist && scriptId) {
            const si = setlist.scriptIds.indexOf(scriptId);
            if (si < setlist.scriptIds.length - 1) {
              setLocalScriptId(setlist.scriptIds[si + 1]);
              setLocalLineIndex(0);
              return 0;
            }
          }
          return i;
        });
        break;
      case "PREV_SECTION":
        setLocalSectionIndex((i) => { setLocalLineIndex(0); return i > 0 ? i - 1 : 0; });
        break;
      case "NEXT_SCRIPT":
        if (setlist && scriptId) {
          const si = setlist.scriptIds.indexOf(scriptId);
          if (si < setlist.scriptIds.length - 1) {
            setLocalScriptId(setlist.scriptIds[si + 1]);
            setLocalSectionIndex(0);
            setLocalLineIndex(0);
          }
        }
        break;
      case "PREV_SCRIPT":
        if (setlist && scriptId) {
          const si = setlist.scriptIds.indexOf(scriptId);
          if (si > 0) {
            setLocalScriptId(setlist.scriptIds[si - 1]);
            setLocalSectionIndex(0);
            setLocalLineIndex(0);
          }
        }
        break;
      case "PLAY_PAUSE":
        setIsScrolling((v) => {
          if (v) { cancelAnimationFrame(animRef.current); lastTimeRef.current = 0; }
          return !v;
        });
        break;
      case "UPDATE_SETTINGS":
        updatePerformSettings(cmd.settings);
        break;
      case "SET_TRANSPOSE":
        setLocalTranspose(cmd.steps);
        break;
      case "GOTO_LINE": {
        const pos = applyGotoLine(cmd);
        setLocalSectionIndex(pos.sectionIndex);
        setLocalLineIndex(pos.lineIndex);
        break;
      }
      case "NEXT_LINE": {
        const lines = script?.sections[localSectionIndex]?.content.split("\n") ?? [];
        if (localLineIndex < lines.length - 1) {
          setLocalLineIndex((i) => i + 1);
        } else {
          setLocalSectionIndex((i) => {
            const max = (script?.sections.length ?? 1) - 1;
            if (i < max) {
              setLocalLineIndex(0);
              return i + 1;
            }
            return i;
          });
        }
        break;
      }
      case "PREV_LINE":
        if (localLineIndex > 0) {
          setLocalLineIndex((i) => i - 1);
        } else if (localSectionIndex > 0) {
          const prev = script?.sections[localSectionIndex - 1];
          const last = prev ? Math.max(0, prev.content.split("\n").length - 1) : 0;
          setLocalSectionIndex((i) => i - 1);
          setLocalLineIndex(last);
        }
        break;
      case "BLANKING":
        setBlanking(cmd.on);
        break;
      case "STANDBY":
        setStandBy(cmd.on);
        break;
      case "SMPTE_LOCK":
        setSmpteLock(applySmpteLock(cmd));
        break;
    }
  }, [script, setlist, scriptId, updatePerformSettings, localSectionIndex, localLineIndex]);

  useBroadcastReceiver(setlistId, handleCommand);

  // Also listen to keyboard for standalone use
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case " ": case "PageDown":
          e.preventDefault();
          handleCommand({ type: "NEXT_SECTION" });
          break;
        case "ArrowLeft": case "ArrowUp": case "PageUp":
          e.preventDefault();
          handleCommand({ type: "PREV_SECTION" });
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleCommand]);

  // Reset on section change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    lastTimeRef.current = 0;
  }, [localSectionIndex, localScriptId]);

  // Scroll loop
  const scrollFn = useCallback((ts: number) => {
    if (!scrollRef.current) return;
    if (lastTimeRef.current === 0) lastTimeRef.current = ts;
    const delta = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    scrollRef.current.scrollTop += (s.scrollSpeed * delta) / 1000;
    animRef.current = requestAnimationFrame(scrollFn);
  }, [s.scrollSpeed]);

  useEffect(() => {
    if (isScrolling) animRef.current = requestAnimationFrame(scrollFn);
    else cancelAnimationFrame(animRef.current);
    return () => cancelAnimationFrame(animRef.current);
  }, [isScrolling, scrollFn]);

  const fontFamilyMap: Record<string, string> = {
    sans: "system-ui, -apple-system, sans-serif",
    mono: "ui-monospace, 'SF Mono', monospace",
    serif: "Georgia, 'Times New Roman', serif",
  };

  if (!script || !section) return <WaitingScreen scheme={scheme} />;

  const showChords = !!script.hasChords;
  const marginPct = s.horizontalMargin;

  return (
    <div
      style={{ height: "100vh", background: scheme.bg, overflow: "hidden", display: "flex", flexDirection: "column" }}
      onClick={() => handleCommand({ type: "NEXT_SECTION" })}
    >
      {/* Progress bar */}
      {s.showProgress && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: scheme.muted, zIndex: 10 }}>
          <div
            style={{
              height: "100%",
              background: scheme.arrow,
              width: `${((localSectionIndex + 1) / (script.sections.length || 1)) * 100}%`,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}

      {s.mode === "scroll" ? (
        // ── SCROLL MODE ─────────────────────────────────────────────────────
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            paddingTop: "35vh",
            paddingBottom: "65vh",
            paddingLeft: `${marginPct}%`,
            paddingRight: `${marginPct}%`,
            fontFamily: fontFamilyMap[s.fontFamily] || fontFamilyMap.sans,
            transform: s.isMirrored ? "scaleX(-1)" : undefined,
          }}
        >
          {script.sections.map((sec, si) => (
            <div key={sec.id} style={{ marginBottom: s.fontSize * 3 }}>
              <SectionLabel label={sec.label} scheme={scheme} fontSize={s.fontSize} />
              <SectionBlock
                content={sec.content}
                transposeSteps={localTranspose}
                fontSize={s.fontSize}
                lineSpacing={s.lineSpacing}
                scheme={scheme}
                showChords={showChords}
                mode="scroll"
                activeLine={-1}
              />
            </div>
          ))}
        </div>
      ) : (
        // ── SLIDE MODE ───────────────────────────────────────────────────────
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: `${marginPct}%`,
            paddingRight: `${marginPct}%`,
            fontFamily: fontFamilyMap[s.fontFamily] || fontFamilyMap.sans,
            transform: s.isMirrored ? "scaleX(-1)" : undefined,
          }}
        >
          <SectionLabel label={section.label} scheme={scheme} fontSize={s.fontSize} />
          <SectionBlock
            content={section.content}
            transposeSteps={localTranspose}
            fontSize={s.fontSize}
            lineSpacing={s.lineSpacing}
            scheme={scheme}
            showChords={showChords}
            mode={s.mode}
            activeLine={localLineIndex}
          />
        </div>
      )}
      {smpteLock.locked && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            zIndex: 20,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 13,
            letterSpacing: "0.08em",
            color: "#4ade80",
          }}
        >
          SMPTE {smpteLock.timecode}
        </div>
      )}
      {standBy && (
        <div style={{ position: "absolute", inset: 0, background: scheme.bg, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40 }}>
          <p style={{ color: scheme.muted, fontSize: 28, letterSpacing: "0.4em", fontWeight: 700 }}>STAND BY</p>
        </div>
      )}
      {blanking && (
        <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 50 }} />
      )}
    </div>
  );
}

export default function ArtistDisplayPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", background: "#000" }} />}>
      <DisplayInner />
    </Suspense>
  );
}
