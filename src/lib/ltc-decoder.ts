"use client";

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
const KNOWN_FPS = [24, 25, 29, 30];

function nearestFps(fps: number): number {
  return KNOWN_FPS.reduce((best, f) =>
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

export interface SMPTECue {
  id: string;
  timecode: string; // "HH:MM:SS:FF"
  sectionIndex: number;
  label: string;
}

/**
 * Parse "HH:MM:SS:FF" into total seconds (ignoring frames).
 */
export function timecodeToSeconds(tc: string): number {
  const parts = tc.split(":").map(Number);
  if (parts.length < 3) return 0;
  const [h, m, s] = parts;
  return h * 3600 + m * 60 + s;
}

/**
 * Find which cue should be active for a given timecode.
 * Returns the last cue whose timecode is <= current timecode.
 */
export function resolveActiveCue(
  tc: LTCTimecode,
  cues: SMPTECue[]
): SMPTECue | null {
  const currentSec = tc.hours * 3600 + tc.minutes * 60 + tc.seconds;
  let active: SMPTECue | null = null;
  for (const cue of cues) {
    const cueSeconds = timecodeToSeconds(cue.timecode);
    if (cueSeconds <= currentSec) {
      active = cue;
    } else {
      break;
    }
  }
  return active;
}
