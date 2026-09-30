import { describe, expect, it } from "vitest";
import type { Script, Setlist } from "./types";
import {
  applyDurationInput,
  capElapsed,
  clockFromElapsed,
  countLyricLines,
  durationFromBpm,
  elapsedForLine,
  flattenLineIndex,
  formatDurationInput,
  formatRemainingLabel,
  lineAtElapsed,
  lineAtFlatIndex,
  msPerLyricLine,
  parseDurationInput,
  remainingClockMs,
  resolveSongSync,
  shouldBroadcastClock,
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

  it("falls back to BPM when lineCount is 0 even if duration is set", () => {
    expect(msPerLyricLine(60_000, 0, 120, 1)).toBe(500);
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

describe("lyric text edges", () => {
  it("counts a trailing newline as an extra empty line", () => {
    const script = makeScript({
      sections: [{ id: "v", type: "verse", label: "V", content: "a\n" }],
    });
    expect(countLyricLines(script)).toBe(2);
    expect(lineAtFlatIndex(script, 1)).toEqual({ sectionIndex: 0, lineIndex: 1 });
  });

  it("splits Windows newlines and keeps a carriage return on the first line", () => {
    const script = makeScript({
      sections: [{ id: "v", type: "verse", label: "V", content: "a\r\nb" }],
    });
    expect(countLyricLines(script)).toBe(2);
    expect(lineAtFlatIndex(script, 0)).toEqual({ sectionIndex: 0, lineIndex: 0 });
  });

  it("returns a dummy first line when the script has no sections", () => {
    const script = makeScript({ sections: [] });
    expect(countLyricLines(script)).toBe(0);
    expect(flattenLineIndex(script, 0, 0)).toBe(0);
    expect(lineAtFlatIndex(script, 0)).toEqual({ sectionIndex: 0, lineIndex: 0 });
    expect(lineAtElapsed(script, 1_000, 60_000, 120, 1)).toEqual({
      sectionIndex: 0,
      lineIndex: 0,
      flat: 0,
    });
  });

  it("does not clamp flattenLineIndex past the last section", () => {
    expect(flattenLineIndex(makeScript(), 99, 0)).toBe(3);
  });
});

describe("resolveSongSync zero vs unset", () => {
  it("accepts an undefined setlist and uses the script", () => {
    expect(resolveSongSync(undefined, makeScript())).toEqual({
      bpm: 90,
      durationMs: 204_000,
      smpteStart: "00:00:00:00",
    });
  });

  it("treats durationMs 0 as a real override, not unset", () => {
    const setlist = makeSetlist({ songSync: { s1: { durationMs: 0 } } });
    const sync = resolveSongSync(setlist, makeScript());
    expect(sync.durationMs).toBe(0);
    expect(msPerLyricLine(sync.durationMs, 3, 90, 1)).toBe(60_000 / 90);
  });

  it("treats bpm 0 as a real override; clampBpm is the UI floor", () => {
    const setlist = makeSetlist({ songSync: { s1: { bpm: 0 } } });
    expect(resolveSongSync(setlist, makeScript()).bpm).toBe(0);
  });

  it("keeps an empty SMPTE start string instead of the default", () => {
    const setlist = makeSetlist({ songSync: { s1: { smpteStart: "" } } });
    expect(resolveSongSync(setlist, makeScript()).smpteStart).toBe("");
    expect(clockFromElapsed(0, "", 30, false)).toBe("00:00:00:00");
  });
});

describe("parseDurationInput boundaries", () => {
  it("treats 0, 0:00, and zero SMPTE as explicit zero", () => {
    expect(parseDurationInput("0")).toBe(0);
    expect(parseDurationInput("0:00")).toBe(0);
    expect(parseDurationInput("00:00:00:00")).toBe(0);
  });

  it("trims surrounding whitespace", () => {
    expect(parseDurationInput("  3:24  ")).toBe(204_000);
  });

  it("treats a bare integer as seconds, not M:SS", () => {
    expect(parseDurationInput("90")).toBe(90_000);
    expect(parseDurationInput("1:30")).toBe(90_000);
  });

  it("rejects one-digit seconds and non-time strings", () => {
    expect(parseDurationInput("1:0")).toBeNull();
    expect(parseDurationInput("3:2")).toBeNull();
    expect(parseDurationInput("3.24")).toBeNull();
    expect(parseDurationInput("1e3")).toBeNull();
    expect(parseDurationInput("-1")).toBeNull();
    expect(parseDurationInput("NaN")).toBeNull();
  });

  it("distinguishes H:MM:SS from SMPTE", () => {
    expect(parseDurationInput("1:02:03")).toBe(3_723_000);
    expect(parseDurationInput("00:01:02:03")).toBe(62_000 + Math.round((3 / 30) * 1000));
  });

  it("accepts 10-hour H:MM:SS but requires two-digit hours for SMPTE", () => {
    expect(parseDurationInput("10:00:00")).toBe(36_000_000);
    expect(parseDurationInput("10:00:00:00")).toBe(36_000_000);
  });

  it("currently accepts illegal minute/second fields", () => {
    expect(parseDurationInput("3:99")).toBe((3 * 60 + 99) * 1000);
    expect(parseDurationInput("1:60")).toBe(120_000);
    expect(formatDurationInput(parseDurationInput("3:99")!)).toBe("4:39");
  });

  it("converts SMPTE frames at 30 fps regardless of show fps", () => {
    expect(parseDurationInput("00:00:00:15")).toBe(500);
    expect(parseDurationInput("00:00:00:12")).toBe(400);
  });
});

describe("formatDurationInput rounding", () => {
  it("rounds half a second up and sub-500ms down", () => {
    expect(formatDurationInput(499)).toBe("0:00");
    expect(formatDurationInput(500)).toBe("0:01");
  });

  it("does not round-trip frame-accurate SMPTE durations", () => {
    const ms = parseDurationInput("00:00:00:15")!;
    expect(formatDurationInput(ms)).toBe("0:01");
  });

  it("clamps negative milliseconds", () => {
    expect(formatDurationInput(-8_000)).toBe("0:00");
  });
});

describe("applyDurationInput", () => {
  it("keeps the previous length on empty or invalid input", () => {
    expect(applyDurationInput("", 204_000)).toBe(204_000);
    expect(applyDurationInput("nope", 204_000)).toBe(204_000);
    expect(applyDurationInput("1:00", 204_000)).toBe(60_000);
  });
});

describe("clockFromElapsed fps and frames", () => {
  it("advances one second at 24, 25, and 29.97 nominal rates", () => {
    expect(clockFromElapsed(1_000, "00:00:00:00", 24, false)).toBe("00:00:01:00");
    expect(clockFromElapsed(1_000, "00:00:00:00", 25, false)).toBe("00:00:01:00");
    expect(clockFromElapsed(1_000, "00:00:00:00", 29.97, false)).toBe("00:00:01:00");
  });

  it("stays on the same frame until a full frame of elapsed time", () => {
    expect(clockFromElapsed(16, "00:00:00:00", 30, false)).toBe("00:00:00:00");
    expect(clockFromElapsed(34, "00:00:00:00", 30, false)).toBe("00:00:00:01");
  });

  it("adds elapsed frames onto a start TC that already has frames", () => {
    expect(clockFromElapsed(1_000 / 30, "01:00:00:29", 30, false)).toBe("01:00:01:00");
  });

  it("does not apply true drop-frame skipped-frame math", () => {
    expect(clockFromElapsed(60_000, "00:00:00:00", 29.97, true)).toBe("00:01:00;00");
  });

  it("can emit hours beyond two digits", () => {
    expect(clockFromElapsed(100 * 3_600_000, "00:00:00:00", 30, false)).toBe("100:00:00:00");
  });
});

describe("capElapsed / remainingClockMs / formatRemainingLabel", () => {
  it("caps at duration only when duration is set", () => {
    expect(capElapsed(90_000, 60_000)).toBe(60_000);
    expect(capElapsed(90_000, 0)).toBe(90_000);
    expect(capElapsed(-20, 60_000)).toBe(0);
  });

  it("freezes remaining at zero after the song ends", () => {
    expect(remainingClockMs(60_000, 59_000)).toBe(1_000);
    expect(remainingClockMs(60_000, 60_000)).toBe(0);
    expect(remainingClockMs(60_000, 90_000)).toBe(0);
    expect(remainingClockMs(0, 5_000)).toBe(0);
  });

  it("formats operator remaining as a negative duration", () => {
    expect(formatRemainingLabel(60_000, 20_000)).toBe("-0:40");
    expect(formatRemainingLabel(0, 1_000)).toBe("");
  });
});

describe("lineAtElapsed / elapsedForLine", () => {
  const script = makeScript();

  it("holds the last line at and past song end", () => {
    expect(lineAtElapsed(script, 59_999, 60_000, 89, 1).flat).toBe(2);
    expect(lineAtElapsed(script, 60_000, 60_000, 89, 1)).toEqual({
      sectionIndex: 1,
      lineIndex: 0,
      flat: 2,
    });
    expect(lineAtElapsed(script, 90_000, 60_000, 89, 1).flat).toBe(2);
  });

  it("crosses a line on the per-line boundary, not one ms before", () => {
    expect(lineAtElapsed(script, 19_999, 60_000, 89, 1).flat).toBe(0);
    expect(lineAtElapsed(script, 20_000, 60_000, 89, 1).flat).toBe(1);
  });

  it("maps a single-section song", () => {
    const one = makeScript({
      sections: [{ id: "v", type: "verse", label: "V", content: "a\nb\nc" }],
    });
    expect(lineAtElapsed(one, 0, 30_000, 120, 1).flat).toBe(0);
    expect(lineAtElapsed(one, 10_000, 30_000, 120, 1).flat).toBe(1);
    expect(lineAtElapsed(one, 20_000, 30_000, 120, 1).flat).toBe(2);
  });

  it("seeks jumpTo elapsed to the start of a line, not song end", () => {
    const last = elapsedForLine(script, 1, 0, 60_000, 89, 1);
    expect(last).toBe(40_000);
    expect(last).toBeLessThan(60_000);
    expect(lineAtElapsed(script, last, 60_000, 89, 1).flat).toBe(2);
  });

  it("broadcasts only when the displayed clock string changes", () => {
    expect(shouldBroadcastClock("00:00:00:00", "00:00:00:00")).toBe(false);
    expect(shouldBroadcastClock("00:00:00:00", "00:00:00:01")).toBe(true);
  });
});

