"use client";

import type { SmpteCue, SmpteFps } from "./types";

export type { SmpteCue, SmpteFps };

/**
 * SMPTE LTC (Linear Timecode) decoder using Web Audio API.
 *
 * LTC encodes timecode as Biphase Mark Code (BMC) in an audio signal:
 *   - Every bit period starts with a transition
 *   - A '1' bit has an additional transition at mid-period
 *   - A '0' bit does not
 *
 * One 80-bit frame encodes: FF:SS:MM:HH plus user bits and flags.
 * The frame ends with a fixed 16-bit sync word: 0011111111111101 (LSB first).
 *
 * Frame layout (bit positions, LSB first within each field):
 *  0- 3  Frame units
 *  4- 7  User bits 1
 *  8-10  Frame tens
 *  11     Drop-frame flag
 *  12     Color-frame flag
 *  13-15  User bits 2
 *  16-19  Seconds units
 *  20-23  User bits 3
 *  24-26  Seconds tens
 *  27     Biphase mark correction (BGF0)
 *  28-31  User bits 4
 *  32-35  Minutes units
 *  36-39  User bits 5
 *  40-42  Minutes tens
 *  43     BGF1
 *  44-47  User bits 6
 *  48-51  Hours units
 *  52-55  User bits 7
 *  56-57  Hours tens
 *  58     BGF2 / Clock flag
 *  59     BGF3
 *  60-63  User bits 8
 *  64-79  Sync word = 0011111111111101
 */

export interface LTCTimecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  dropFrame: boolean;
  fps: number;
  raw: string; // "HH:MM:SS:FF"
}

export type LTCCallback = (tc: LTCTimecode) => void;

// The 16-bit sync word at the end of every LTC frame (bit 64–79).
const SYNC_WORD = 0b0011111111111101;

/** Detect frame rate from the number of frames decoded per second */
const KNOWN_FPS = [24, 25, 29, 30, 48, 50, 59, 60];

export const SMPTE_RATES: SmpteFps[] = [23.98, 24, 25, 29.97, 30, 47.95, 48, 50, 59.94, 60];

function nearestFps(fps: number): number {
  return KNOWN_FPS.reduce((best, f) =>
    Math.abs(f - fps) < Math.abs(best - fps) ? f : best
  );
}

export function detectedToSmpteFps(fps: number): SmpteFps {
  return SMPTE_RATES.reduce((best, f) =>
    Math.abs(f - fps) < Math.abs(best - fps) ? f : best
  );
}

// ─── AudioWorklet processor code (runs in audio thread) ─────────────────────
// Injected as a Blob URL to avoid separate file requirements.

const WORKLET_CODE = /* javascript */ `
class LTCProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._lastSign = 0;
    this._lastCrossing = 0;
    this._halfPeriod = 0;
    this._bits = [];
    this._state = 'HUNT'; // HUNT | SYNC | FRAME
    this._frameBuffer = new Uint8Array(80);
    this._frameBitCount = 0;
    this._sampleRate = sampleRate;
    this._lastFrameTime = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const samples = input[0];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const sign = s >= 0 ? 1 : -1;

      if (sign !== this._lastSign && this._lastSign !== 0) {
        // Zero crossing detected
        const now = currentTime + i / this._sampleRate;
        const interval = now - this._lastCrossing;
        this._lastCrossing = now;
        this._onTransition(interval, now);
      }

      this._lastSign = sign;
    }
    return true;
  }

  _onTransition(interval, time) {
    // Biphase mark: each bit period starts with a transition.
    // If a second transition occurs within the bit period (at mid-point),
    // it's a '1'. If not, it's a '0'.
    // We detect '1' bits as two short intervals summing to a bit period.
    // We detect '0' bits as one long interval equaling a bit period.

    if (this._halfPeriod === 0) {
      // Initial calibration: assume first transition is a mid-bit transition
      this._halfPeriod = interval;
      return;
    }

    const threshold = this._halfPeriod * 1.4;

    if (interval < threshold) {
      // Short interval = mid-bit transition → next short interval completes a '1'
      if (this._pendingShort) {
        this._pushBit(1);
        this._halfPeriod = (this._halfPeriod * 7 + (this._pendingShortInterval + interval) / 2) / 8;
        this._pendingShort = false;
      } else {
        this._pendingShort = true;
        this._pendingShortInterval = interval;
      }
    } else {
      // Long interval = full bit period → bit is '0'
      if (this._pendingShort) {
        // Discard orphaned short — sync error
        this._pendingShort = false;
      }
      this._pushBit(0);
      this._halfPeriod = (this._halfPeriod * 7 + interval / 2) / 8;
    }
  }

  _pushBit(bit) {
    this._bits.push(bit);
    if (this._bits.length > 80) this._bits.shift();

    // Check if last 16 bits match sync word
    if (this._bits.length >= 80) {
      let syncWord = 0;
      for (let i = 0; i < 16; i++) {
        syncWord |= (this._bits[64 + i] << i);
      }
      if (syncWord === 0b0011111111111101) {
        this._decodeFrame(this._bits.slice(0, 80));
        this._bits = [];
      }
    }
  }

  _decodeFrame(bits) {
    function readField(start, len) {
      let v = 0;
      for (let i = 0; i < len; i++) v |= (bits[start + i] << i);
      return v;
    }

    const frameUnits  = readField(0, 4);
    const frameTens   = readField(8, 2);
    const dropFrame   = bits[11] === 1;
    const secUnits    = readField(16, 4);
    const secTens     = readField(24, 3);
    const minUnits    = readField(32, 4);
    const minTens     = readField(40, 3);
    const hrUnits     = readField(48, 4);
    const hrTens      = readField(56, 2);

    const frames  = frameTens  * 10 + frameUnits;
    const seconds = secTens    * 10 + secUnits;
    const minutes = minTens    * 10 + minUnits;
    const hours   = hrTens     * 10 + hrUnits;

    this.port.postMessage({ hours, minutes, seconds, frames, dropFrame });
  }
}

registerProcessor('ltc-processor', LTCProcessor);
`;

// ─── LTCDecoder class ────────────────────────────────────────────────────────

export class LTCDecoder {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;
  private onFrame: LTCCallback;
  private frameCount = 0;
  private lastSecond = -1;
  private detectedFps = 30;

  constructor(onFrame: LTCCallback) {
    this.onFrame = onFrame;
  }

  async start() {
    if (this.ctx) return;

    // Request mic/line-in access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
      },
    });

    this.ctx = new AudioContext({ sampleRate: 48000 });

    // Create worklet from blob URL
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    await this.ctx.audioWorklet.addModule(blobUrl);
    URL.revokeObjectURL(blobUrl);

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.ctx, "ltc-processor");

    this.workletNode.port.onmessage = (e) => {
      const { hours, minutes, seconds, frames, dropFrame } = e.data as {
        hours: number;
        minutes: number;
        seconds: number;
        frames: number;
        dropFrame: boolean;
      };

      // Estimate FPS
      if (seconds !== this.lastSecond) {
        if (this.lastSecond !== -1) {
          this.detectedFps = nearestFps(this.frameCount);
        }
        this.frameCount = 0;
        this.lastSecond = seconds;
      }
      this.frameCount = frames + 1;

      const raw = [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
        String(frames).padStart(2, "0"),
      ].join(":");

      this.onFrame({ hours, minutes, seconds, frames, dropFrame, fps: this.detectedFps, raw });
    };

    this.source.connect(this.workletNode);
    // Don't connect to destination — we don't want to hear it
  }

  stop() {
    this.source?.disconnect();
    this.workletNode?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.source = null;
    this.workletNode = null;
    this.stream = null;
  }
}

// ─── SMPTE Cue ────────────────────────────────────────────────────────────────

/** Integer address rate used in the time address (ST 12-1). */
export function nominalFps(fps: SmpteFps): number {
  if (fps === 23.98) return 24;
  if (fps === 29.97) return 30;
  if (fps === 47.95) return 48;
  if (fps === 59.94) return 60;
  return fps;
}

/** Actual frames per second of real time (NTSC-related rates are n/1.001). */
export function trueFps(fps: SmpteFps): number {
  if (fps === 23.98) return 24 / 1.001;
  if (fps === 29.97) return 30 / 1.001;
  if (fps === 47.95) return 48 / 1.001;
  if (fps === 59.94) return 60 / 1.001;
  return fps;
}

/** Drop-frame compensation exists only for 30/1.001 and 60/1.001 systems. */
export function supportsDropFrame(fps: SmpteFps): boolean {
  return fps === 29.97 || fps === 59.94;
}

function dropFramesPerMinute(fps: SmpteFps): number {
  if (fps === 29.97) return 2;
  if (fps === 59.94) return 4;
  return 0;
}

function usesDropFrame(fps: SmpteFps, dropFrame: boolean): boolean {
  return dropFrame && supportsDropFrame(fps);
}

/** Convert a DF time address into a monotonic frame index (ST 12-1 §5.2.2). */
function dropAddressToFrames(
  hours: number,
  minutes: number,
  seconds: number,
  frames: number,
  fps: SmpteFps
): number {
  const rate = nominalFps(fps);
  const drop = dropFramesPerMinute(fps);
  const totalMinutes = hours * 60 + minutes;
  return (hours * 3600 + minutes * 60 + seconds) * rate + frames - drop * (totalMinutes - Math.floor(totalMinutes / 10));
}

/** Convert a monotonic frame index into a DF time address (ST 12-1 §5.2.2). */
function framesToDropAddress(frameNumber: number, fps: SmpteFps): number {
  const rate = nominalFps(fps);
  const drop = dropFramesPerMinute(fps);
  const framesPer10Min = rate * 600 - drop * 9;
  const framesPerFirstMin = rate * 60;
  const framesPerMin = rate * 60 - drop;
  const tenMinBlocks = Math.floor(frameNumber / framesPer10Min);
  const remainder = frameNumber % framesPer10Min;
  const extraDrops =
    remainder < framesPerFirstMin
      ? 0
      : drop + drop * Math.floor((remainder - framesPerFirstMin) / framesPerMin);
  return frameNumber + tenMinBlocks * 9 * drop + extraDrops;
}

export function parseTimecode(tc: string): { hours: number; minutes: number; seconds: number; frames: number } {
  const parts = tc.trim().split(/[:;.]/).map((p) => parseInt(p, 10) || 0);
  return {
    hours: parts[0] ?? 0,
    minutes: parts[1] ?? 0,
    seconds: parts[2] ?? 0,
    frames: parts[3] ?? 0,
  };
}

export function formatSmpte(hours: number, minutes: number, seconds: number, frames: number, dropFrame = false): string {
  const sep = dropFrame ? ";" : ":";
  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + sep + String(frames).padStart(2, "0");
}

export function timecodeToFrames(tc: string, fps: SmpteFps, dropFrame = false): number {
  const { hours, minutes, seconds, frames } = parseTimecode(tc);
  if (usesDropFrame(fps, dropFrame) || (supportsDropFrame(fps) && tc.includes(";"))) {
    return dropAddressToFrames(hours, minutes, seconds, frames, fps);
  }
  return (hours * 3600 + minutes * 60 + seconds) * nominalFps(fps) + frames;
}

export function framesToTimecode(total: number, fps: SmpteFps, dropFrame = false): string {
  const rate = nominalFps(fps);
  const useDf = usesDropFrame(fps, dropFrame);
  let n = Math.max(0, Math.floor(total));
  if (useDf) n = framesToDropAddress(n, fps);
  const frames = n % rate;
  const totalSec = Math.floor(n / rate);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return formatSmpte(hours, minutes, seconds, frames, useDf);
}

/**
 * Parse "HH:MM:SS:FF" into total seconds (ignoring frames).
 */
export function timecodeToSeconds(tc: string): number {
  const { hours, minutes, seconds } = parseTimecode(tc);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Find which cue should be active for a given timecode.
 * Returns the last cue whose timecode is <= current timecode.
 */
export function resolveActiveCue(
  tc: { hours: number; minutes: number; seconds: number; frames: number; raw?: string; dropFrame?: boolean },
  cues: SmpteCue[],
  fps: SmpteFps = 30,
  dropFrame = false
): SmpteCue | null {
  const df = dropFrame || !!tc.dropFrame;
  const current = timecodeToFrames(
    tc.raw ?? formatSmpte(tc.hours, tc.minutes, tc.seconds, tc.frames, df),
    fps,
    df
  );
  const sorted = [...cues].sort(
    (a, b) => timecodeToFrames(a.timecode, fps, df) - timecodeToFrames(b.timecode, fps, df)
  );
  let active: SmpteCue | null = null;
  for (const cue of sorted) {
    if (timecodeToFrames(cue.timecode, fps, df) <= current) active = cue;
    else break;
  }
  return active;
}
