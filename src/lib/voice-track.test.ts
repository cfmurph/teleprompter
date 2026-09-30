import { describe, expect, it } from "vitest";
import { VoiceTracker, buildWordMap, matchTranscript, normalizeSpoken } from "./voice-track";

describe("normalizeSpoken", () => {
  it("lowercases, strips punctuation, and collapses space", () => {
    expect(normalizeSpoken("  Hello, WORLD!! ")).toBe("hello world");
  });
});

describe("buildWordMap", () => {
  it("tracks the line of each word", () => {
    expect(buildWordMap("one two\nthree")).toEqual([
      { word: "one", lineIndex: 0 },
      { word: "two", lineIndex: 0 },
      { word: "three", lineIndex: 1 },
    ]);
  });
});

describe("matchTranscript", () => {
  const map = buildWordMap("you can count on me\nwhen the room goes quiet");

  it("returns startFrom when the transcript is empty", () => {
    expect(matchTranscript(map, "", 0)).toBe(0);
    expect(matchTranscript(map, "   ", 2)).toBe(2);
  });

  it("advances to the last consecutive matched word", () => {
    expect(matchTranscript(map, "you can count", 0)).toBe(2);
  });

  it("does not walk backwards from startFrom", () => {
    expect(matchTranscript(map, "you", 4)).toBe(4);
  });

  it("finds a later window of the spoken phrase", () => {
    expect(matchTranscript(map, "when the room", 0)).toBe(7);
  });
});

describe("VoiceTracker", () => {
  it("is unsupported without the Web Speech API", () => {
    const tracker = new VoiceTracker(() => {});
    expect(tracker.isSupported).toBe(false);
  });

  it("emits an error on start when unsupported", () => {
    const states: string[] = [];
    const tracker = new VoiceTracker((s) => {
      if (s.error) states.push(s.error);
    });
    tracker.start();
    expect(states[0]).toMatch(/not supported/i);
  });

  it("resets the word map when content changes", () => {
    const tracker = new VoiceTracker(() => {});
    tracker.setContent("hello world");
    tracker.setContent("hello world");
    tracker.resetPosition();
    tracker.setContent("new line");
    expect(tracker.isSupported).toBe(false);
  });
});
