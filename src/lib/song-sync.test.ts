import { describe, expect, it } from "vitest";
import type { Script, Setlist } from "./types";
import {
  clockFromElapsed,
  countLyricLines,
  durationFromBpm,
  flattenLineIndex,
  formatDurationInput,
  lineAtFlatIndex,
  msPerLyricLine,
  parseDurationInput,
  resolveSongSync,
} from "./song-sync";

function makeScript(over: Partial<Script> = {}): Script {
  return {
    id: "s1",
    title: "Count On Me",
    description: "",
    tags: [],
    sections: [
      { id: "v1", type: "verse", label: "Verse 1", content: "line one\nline two" },
      { id: "c", type: "chorus", label: "Chorus", content: "line three" },
    ],
    createdAt: 0,
    updatedAt: 0,
    wordCount: 6,
    readingTimeSec: 3,
    bpm: 90,
    durationMs: 204_000,
    ...over,
  };
}

function makeSetlist(over: Partial<Setlist> = {}): Setlist {
  return {
    id: "sl",
    name: "Dallas",
    date: "2026-09-30",
    venue: "",
    scriptIds: ["s1"],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("countLyricLines", () => {
  it("counts every lyric line across sections", () => {
    expect(countLyricLines(makeScript())).toBe(3);
  });

  it("counts an empty section as one line", () => {
    const script = makeScript({
      sections: [{ id: "empty", type: "intro", label: "Intro", content: "" }],
    });
    expect(countLyricLines(script)).toBe(1);
  });
});

describe("flattenLineIndex / lineAtFlatIndex", () => {
  const script = makeScript();

  it("maps section/line into a running index", () => {
    expect(flattenLineIndex(script, 0, 0)).toBe(0);
    expect(flattenLineIndex(script, 0, 1)).toBe(1);
    expect(flattenLineIndex(script, 1, 0)).toBe(2);
  });

  it("clamps a line index to the section", () => {
    expect(flattenLineIndex(script, 0, 99)).toBe(1);
    expect(flattenLineIndex(script, 0, -4)).toBe(0);
  });

  it("round-trips each lyric line", () => {
    for (let i = 0; i < 3; i++) {
      const pos = lineAtFlatIndex(script, i);
      expect(flattenLineIndex(script, pos.sectionIndex, pos.lineIndex)).toBe(i);
    }
  });

  it("clamps past the last line", () => {
    expect(lineAtFlatIndex(script, 99)).toEqual({ sectionIndex: 1, lineIndex: 0 });
  });

  it("treats a negative index as the first line", () => {
    expect(lineAtFlatIndex(script, -8)).toEqual({ sectionIndex: 0, lineIndex: 0 });
  });
});

describe("resolveSongSync", () => {
  it("uses script BPM and duration when the setlist has no override", () => {
    expect(resolveSongSync(makeSetlist(), makeScript())).toEqual({
      bpm: 90,
      durationMs: 204_000,
      smpteStart: "00:00:00:00",
    });
  });

  it("falls back to 120 BPM and zero duration without a script", () => {
    expect(resolveSongSync(makeSetlist(), null)).toEqual({
      bpm: 120,
      durationMs: 0,
      smpteStart: "00:00:00:00",
    });
  });

  it("lets the setlist override BPM, duration, and SMPTE start", () => {
    const setlist = makeSetlist({
      songSync: {
        s1: { bpm: 89, durationMs: 60_000, smpteStart: "01:02:03:04" },
      },
    });
    expect(resolveSongSync(setlist, makeScript())).toEqual({
      bpm: 89,
      durationMs: 60_000,
      smpteStart: "01:02:03:04",
    });
  });

  it("keeps script values for fields the setlist does not set", () => {
    const setlist = makeSetlist({
      songSync: { s1: { bpm: 104 } },
    });
    expect(resolveSongSync(setlist, makeScript())).toEqual({
      bpm: 104,
      durationMs: 204_000,
      smpteStart: "00:00:00:00",
    });
  });

  it("ignores overrides for a different song", () => {
    const setlist = makeSetlist({
      songSync: { other: { bpm: 40, durationMs: 1_000 } },
    });
    expect(resolveSongSync(setlist, makeScript()).bpm).toBe(90);
  });
});

describe("msPerLyricLine / durationFromBpm", () => {
  it("spreads lyrics evenly across song duration when duration is set", () => {
    expect(msPerLyricLine(60_000, 4, 89, 1)).toBe(15_000);
  });

  it("falls back to BPM when duration is missing", () => {
    expect(msPerLyricLine(0, 4, 120, 1)).toBe(500);
    expect(msPerLyricLine(0, 4, 120, 2)).toBe(250);
  });

  it("clamps BPM and lines-per-beat in the BPM fallback", () => {
    expect(msPerLyricLine(0, 4, 1, 0)).toBe(60_000 / (20 * 0.25));
  });

  it("derives a total time from BPM and line count", () => {
    expect(durationFromBpm(4, 120, 1)).toBe(2_000);
  });
});

describe("parseDurationInput / formatDurationInput", () => {
  it("parses whole seconds", () => {
    expect(parseDurationInput("90")).toBe(90_000);
    expect(parseDurationInput("0")).toBe(0);
  });

  it("parses M:SS and H:MM:SS", () => {
    expect(parseDurationInput("3:24")).toBe(204_000);
    expect(parseDurationInput("1:00")).toBe(60_000);
    expect(parseDurationInput("1:02:03")).toBe(3_723_000);
  });

  it("parses SMPTE as wall time plus frames", () => {
    expect(parseDurationInput("00:01:00:00")).toBe(60_000);
    expect(parseDurationInput("00:00:00:15")).toBe(500);
    expect(parseDurationInput("00:00:00;15")).toBe(500);
  });

  it("rejects empty and malformed input", () => {
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("  ")).toBeNull();
    expect(parseDurationInput("1:0")).toBeNull();
    expect(parseDurationInput("3:24:xx")).toBeNull();
    expect(parseDurationInput("abc")).toBeNull();
  });

  it("formats milliseconds for the operator Time field", () => {
    expect(formatDurationInput(0)).toBe("0:00");
    expect(formatDurationInput(60_000)).toBe("1:00");
    expect(formatDurationInput(204_000)).toBe("3:24");
    expect(formatDurationInput(3_723_000)).toBe("1:02:03");
  });

  it("round-trips common show lengths", () => {
    for (const raw of ["0:45", "3:24", "12:00", "1:02:03"]) {
      const ms = parseDurationInput(raw);
      expect(ms).not.toBeNull();
      expect(formatDurationInput(ms!)).toBe(raw);
    }
  });
});

describe("clockFromElapsed", () => {
  it("starts at the song SMPTE origin", () => {
    expect(clockFromElapsed(0, "00:00:00:00", 30, false)).toBe("00:00:00:00");
    expect(clockFromElapsed(0, "01:02:03:04", 30, false)).toBe("01:02:03:04");
  });

  it("advances frames from elapsed time at the nominal fps", () => {
    expect(clockFromElapsed(1_000, "00:00:00:00", 30, false)).toBe("00:00:01:00");
    expect(clockFromElapsed(500, "00:00:00:00", 30, false)).toBe("00:00:00:15");
    expect(clockFromElapsed(1_000, "01:02:03:04", 30, false)).toBe("01:02:04:04");
  });

  it("uses a semicolon for drop-frame clocks", () => {
    expect(clockFromElapsed(1_000, "00:00:00:00", 29.97, true)).toBe("00:00:01;00");
  });

  it("does not run backwards for negative elapsed", () => {
    expect(clockFromElapsed(-250, "00:00:10:00", 30, false)).toBe("00:00:10:00");
  });
});

describe("running clock lyric mapping", () => {
  it("maps elapsed time through the song when duration is the master", () => {
    const script = makeScript();
    const lineCount = countLyricLines(script);
    const durationMs = 60_000;
    const perLine = msPerLyricLine(durationMs, lineCount, 89, 1);

    function lineAt(elapsedMs: number) {
      const capped = Math.min(elapsedMs, durationMs);
      const flat = Math.min(lineCount - 1, Math.floor(capped / perLine));
      return lineAtFlatIndex(script, flat);
    }

    expect(perLine).toBe(20_000);
    expect(lineAt(0)).toEqual({ sectionIndex: 0, lineIndex: 0 });
    expect(lineAt(19_999)).toEqual({ sectionIndex: 0, lineIndex: 0 });
    expect(lineAt(20_000)).toEqual({ sectionIndex: 0, lineIndex: 1 });
    expect(lineAt(40_000)).toEqual({ sectionIndex: 1, lineIndex: 0 });
    expect(lineAt(60_000)).toEqual({ sectionIndex: 1, lineIndex: 0 });
  });

  it("uses BPM spacing when the song has no duration", () => {
    const perLine = msPerLyricLine(0, 3, 120, 1);
    expect(perLine).toBe(500);
    expect(Math.floor(0 / perLine)).toBe(0);
    expect(Math.floor(499 / perLine)).toBe(0);
    expect(Math.floor(500 / perLine)).toBe(1);
    expect(Math.floor(1_000 / perLine)).toBe(2);
  });
});
