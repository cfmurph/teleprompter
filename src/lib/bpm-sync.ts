"use client";

/**
 * BPM-locked scroll sync.
 *
 * Calculates a scroll speed (px/sec) that keeps the teleprompter
 * moving at a natural pace for a given song tempo and font size.
 *
 * Model: one "beat" should advance the text by approximately one
 * line of text, so the reader's eye lands on the next phrase every beat.
 * scrollSpeed = lineHeight (px) × BPM / 60
 *
 * Users can adjust the "lines per beat" multiplier to taste.
 */

export interface BpmSyncConfig {
  bpm: number;           // Beats per minute
  fontSize: number;      // px
  lineSpacing: number;   // CSS line-height multiplier
  linesPerBeat: number;  // How many lines advance per beat (default 1)
}

export function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return 120;
  return Math.max(20, Math.min(300, Math.round(n)));
}

/** Calculate scroll speed in px/sec for a given BPM config. */
export function bpmToScrollSpeed(config: BpmSyncConfig): number {
  const { bpm, fontSize, lineSpacing, linesPerBeat } = config;
  const lineHeight = fontSize * lineSpacing;
  return lineHeight * linesPerBeat * (bpm / 60);
}

/**
 * Given a scroll speed, back-calculate the effective BPM.
 */
export function scrollSpeedToBpm(
  scrollSpeed: number,
  fontSize: number,
  lineSpacing: number,
  linesPerBeat = 1
): number {
  const lineHeight = fontSize * lineSpacing;
  return (scrollSpeed / (lineHeight * linesPerBeat)) * 60;
}

/**
 * Tap-tempo: tracks tap timestamps and returns the average BPM.
 */
export class TapTempo {
  private taps: number[] = [];
  private readonly maxTaps = 8;

  tap(): number | null {
    const now = performance.now();
    this.taps.push(now);
    if (this.taps.length > this.maxTaps) {
      this.taps.shift();
    }
    if (this.taps.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i] - this.taps[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return Math.round(60_000 / avg);
  }

  reset() {
    this.taps = [];
  }
}
