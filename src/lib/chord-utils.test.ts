import { describe, expect, it } from "vitest";
import {
  displayKey,
  parseContent,
  parseLine,
  stripChords,
  transposeChord,
  transposeKey,
  transposeLabel,
} from "./chord-utils";

describe("transposeChord", () => {
  it("leaves chords unchanged at 0 steps", () => {
    expect(transposeChord("Gmaj7", 0)).toBe("Gmaj7");
  });

  it("wraps the chromatic scale", () => {
    expect(transposeChord("C", 12)).toBe("C");
    expect(transposeChord("C", -12)).toBe("C");
    expect(transposeChord("B", 1)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
  });

  it("prefers sharps when going up and flats when going down", () => {
    expect(transposeChord("C", 1)).toBe("C#");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("G", -1)).toBe("Gb");
  });

  it("transposes slash bass notes", () => {
    expect(transposeChord("C/G", 2)).toBe("D/A");
    expect(transposeChord("Am7/G", -2)).toBe("Gm7/F");
  });

  it("keeps suffix text", () => {
    expect(transposeChord("F#m7", 1)).toBe("Gm7");
    expect(transposeChord("Dsus4", 2)).toBe("Esus4");
  });
});

describe("transposeKey / displayKey", () => {
  it("wraps keys across the octave", () => {
    expect(transposeKey("Eb", 1)).toBe("E");
    expect(transposeKey("C", 11)).toBe("B");
  });

  it("returns the original key at 0", () => {
    expect(displayKey("G", 0)).toBe("G");
    expect(displayKey("G", 2)).toBe("A");
  });
});

describe("parseLine / parseContent", () => {
  it("parses ChordPro chords above lyrics", () => {
    const parsed = parseLine("[G]Just a small town [Am]girl");
    expect(parsed.hasChords).toBe(true);
    expect(parsed.segments).toEqual([
      { chord: "G", text: "" },
      { chord: null, text: "Just a small town " },
      { chord: "Am", text: "girl" },
    ]);
  });

  it("treats a line with no brackets as plain text", () => {
    expect(parseLine("hello world")).toEqual({
      hasChords: false,
      segments: [{ chord: null, text: "hello world" }],
    });
  });

  it("transposes ChordPro chords while parsing", () => {
    const parsed = parseLine("[G]Hey [C/G]you", 2);
    expect(parsed.segments.map((s) => s.chord)).toEqual(["A", null, "D/A"]);
  });

  it("splits content on newlines", () => {
    expect(parseContent("a\n[G]b").map((l) => l.hasChords)).toEqual([false, true]);
  });
});

describe("stripChords", () => {
  it("removes bracketed chords and leaves lyric text", () => {
    expect(stripChords("[G]Just a [Am]girl")).toBe("Just a girl");
  });
});

describe("transposeLabel", () => {
  it("labels original, up, and down", () => {
    expect(transposeLabel(0)).toBe("Original key");
    expect(transposeLabel(1)).toBe("+1 semitone");
    expect(transposeLabel(2)).toBe("+2 semitones");
    expect(transposeLabel(-1)).toBe("-1 semitone");
    expect(transposeLabel(-3)).toBe("-3 semitones");
  });
});
