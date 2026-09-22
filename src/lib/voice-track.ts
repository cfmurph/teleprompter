"use client";

/**
 * Voice tracking using the Web Speech API (SpeechRecognition).
 *
 * Strategy:
 *   1. Start continuous speech recognition.
 *   2. As words are recognized, find them in the current section's text.
 *   3. Track the furthest matched word position.
 *   4. In "line" or "highlight" mode, advance the active line to the line
 *      containing the matched word.
 *   5. In "scroll" mode, drive the scroll position proportionally.
 *
 * Limitations:
 *   - Works in Chrome/Edge only (Web Speech API availability).
 *   - Interim results are used for real-time tracking; final results confirm.
 *   - No offline model — requires an internet connection for the underlying
 *     recognition engine.
 */

export interface VoiceTrackState {
  isListening: boolean;
  wordIndex: number;   // How far through the section we've gotten (word #)
  lineIndex: number;   // Corresponding line index
  confidence: number;  // 0–1
  transcript: string;  // Latest recognized text
  error: string | null;
}

export type VoiceTrackCallback = (state: VoiceTrackState) => void;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalize text for comparison: lowercase, strip punctuation */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

/** Split content into words, tracking which line each word is on */
function buildWordMap(content: string): { word: string; lineIndex: number }[] {
  const map: { word: string; lineIndex: number }[] = [];
  const lines = content.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const words = normalize(lines[li]).split(" ").filter(Boolean);
    for (const word of words) {
      map.push({ word, lineIndex: li });
    }
  }
  return map;
}

/**
 * Find how many consecutive words from the content match the transcript.
 * Returns the index of the last matched word in the word map.
 */
function matchTranscript(
  wordMap: { word: string; lineIndex: number }[],
  transcript: string,
  startFrom: number
): number {
  const spoken = normalize(transcript).split(" ").filter(Boolean);
  if (spoken.length === 0) return startFrom;

  // Slide a window through the word map looking for the spoken words
  let bestMatch = startFrom;

  for (let i = startFrom; i < wordMap.length; i++) {
    let matched = 0;
    for (let j = 0; j < spoken.length && i + j < wordMap.length; j++) {
      if (wordMap[i + j].word === spoken[j]) {
        matched++;
      } else {
        break;
      }
    }
    if (matched > 0) {
      bestMatch = Math.max(bestMatch, i + matched - 1);
    }
  }

  return bestMatch;
}

// ─── VoiceTracker ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export class VoiceTracker {
  private recognition: AnySpeechRecognition | null = null;
  private wordMap: { word: string; lineIndex: number }[] = [];
  private wordIndex = 0;
  private onUpdate: VoiceTrackCallback;
  private _isListening = false;
  private _content = "";

  constructor(onUpdate: VoiceTrackCallback) {
    this.onUpdate = onUpdate;
  }

  get isSupported(): boolean {
    if (typeof window === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  /** Call this whenever the section content changes */
  setContent(content: string) {
    if (content === this._content) return;
    this._content = content;
    this.wordMap = buildWordMap(content);
    this.wordIndex = 0;
  }

  /** Reset position within current section */
  resetPosition() {
    this.wordIndex = 0;
    this._emit({ isListening: this._isListening, wordIndex: 0, lineIndex: 0, confidence: 0, transcript: "", error: null });
  }

  start() {
    if (!this.isSupported) {
      this._emit({ isListening: false, wordIndex: 0, lineIndex: 0, confidence: 0, transcript: "", error: "Speech recognition not supported in this browser. Use Chrome or Edge." });
      return;
    }
    if (this._isListening) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this._isListening = true;
      this._emit({ isListening: true, wordIndex: this.wordIndex, lineIndex: this._lineFor(this.wordIndex), confidence: 0, transcript: "", error: null });
    };

    this.recognition.onend = () => {
      // Auto-restart if we didn't explicitly stop
      if (this._isListening) {
        this.recognition?.start();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      if (e.error === "aborted") return;
      this._emit({ isListening: this._isListening, wordIndex: this.wordIndex, lineIndex: this._lineFor(this.wordIndex), confidence: 0, transcript: "", error: `Recognition error: ${e.error}` });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (e: any) => {
      // Collect all results (both interim and final)
      let fullTranscript = "";
      let confidence = 0;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        fullTranscript += e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          confidence = e.results[i][0].confidence;
        }
      }

      // Match against word map, advancing from current position
      const newWordIndex = matchTranscript(this.wordMap, fullTranscript, this.wordIndex);
      this.wordIndex = newWordIndex;

      const lineIndex = this._lineFor(newWordIndex);
      this._emit({ isListening: true, wordIndex: newWordIndex, lineIndex, confidence, transcript: fullTranscript, error: null });
    };

    this.recognition.start();
  }

  stop() {
    this._isListening = false;
    this.recognition?.stop();
    this.recognition = null;
    this._emit({ isListening: false, wordIndex: this.wordIndex, lineIndex: this._lineFor(this.wordIndex), confidence: 0, transcript: "", error: null });
  }

  toggle() {
    if (this._isListening) this.stop();
    else this.start();
  }

  private _lineFor(wordIndex: number): number {
    return this.wordMap[wordIndex]?.lineIndex ?? 0;
  }

  private _emit(state: VoiceTrackState) {
    this.onUpdate(state);
  }
}
