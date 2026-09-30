import { describe, expect, it } from "vitest";
import type { Script } from "./types";
import {
  capElapsed,
  clockFromElapsed,
  durationFromBpm,
  elapsedAfterSongChange,
  elapsedForLine,
  lineAtElapsed,
  playbackOrigin,
  remapPlayback,
  usesInternalClock,
} from "./song-sync";
import { applyGotoLine, gotoLineCommand, gotoScriptCommand } from "./console-commands";

const script: Script = {
  id: "s1",
  title: "Song",
  description: "",
  tags: [],
  sections: [
    { id: "v", type: "verse", label: "V1", content: "a\nb" },
    { id: "c", type: "chorus", label: "C", content: "d" },
  ],
  createdAt: 0,
  updatedAt: 0,
  wordCount: 3,
  readingTimeSec: 1,
};

describe("usesInternalClock", () => {
  it("runs only while playing and LTC is off", () => {
    expect(usesInternalClock(true, false)).toBe(true);
    expect(usesInternalClock(false, false)).toBe(false);
    expect(usesInternalClock(true, true)).toBe(false);
    expect(usesInternalClock(false, true)).toBe(false);
  });

  it("derives at least one line of time when the lyric count is 0", () => {
    expect(durationFromBpm(0, 120, 1)).toBe(500);
  });
});

describe("song change / pause / resume", () => {
  it("resets elapsed when the song changes", () => {
    expect(elapsedAfterSongChange()).toBe(0);
    expect(clockFromElapsed(elapsedAfterSongChange(), "01:00:00:00", 30, false)).toBe("01:00:00:00");
  });

  it("resumes from the same origin after a pause", () => {
    const origin = playbackOrigin(10_000, 2_500);
    expect(origin).toBe(7_500);
    expect(capElapsed(12_000 - origin, 60_000)).toBe(4_500);
  });

  it("freezes at duration while playing past the end", () => {
    expect(capElapsed(90_000, 60_000)).toBe(60_000);
    expect(lineAtElapsed(script, 90_000, 60_000, 89, 1).flat).toBe(2);
  });
});

describe("mid-play Time / BPM remap", () => {
  it("re-spreads lyrics when duration shrinks under current elapsed", () => {
    const atTwenty = remapPlayback(script, 20_000, 60_000, 89, 1);
    expect(atTwenty.flat).toBe(1);
    const afterCut = remapPlayback(script, 20_000, 15_000, 89, 1);
    expect(afterCut.elapsed).toBe(15_000);
    expect(afterCut.flat).toBe(2);
  });

  it("keeps elapsed when duration grows", () => {
    const next = remapPlayback(script, 20_000, 120_000, 89, 1);
    expect(next.elapsed).toBe(20_000);
    expect(next.flat).toBe(0);
  });
});

describe("click-to-seek", () => {
  it("maps a lyric click onto elapsed and GOTO_LINE", () => {
    const elapsed = elapsedForLine(script, 1, 0, 60_000, 89, 1);
    const pos = remapPlayback(script, elapsed, 60_000, 89, 1);
    expect(applyGotoLine(gotoLineCommand(pos.sectionIndex, pos.lineIndex))).toEqual({
      sectionIndex: 1,
      lineIndex: 0,
    });
    expect(gotoScriptCommand("demo-6")).toEqual({ type: "GOTO_SCRIPT", scriptId: "demo-6" });
  });
});
