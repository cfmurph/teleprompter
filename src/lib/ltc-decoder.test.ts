import { describe, expect, it } from "vitest";
import {
  detectedToSmpteFps,
  formatSmpte,
  framesToTimecode,
  nominalFps,
  parseTimecode,
  resolveActiveCue,
  timecodeToFrames,
  timecodeToSeconds,
} from "./ltc-decoder";

describe("timecode helpers", () => {
  it("treats 29.97 as 30 fps for frame math", () => {
    expect(nominalFps(29.97)).toBe(30);
    expect(nominalFps(24)).toBe(24);
  });

  it("parses colon and drop-frame separators", () => {
    expect(parseTimecode("01:02:03:04")).toEqual({
      hours: 1,
      minutes: 2,
      seconds: 3,
      frames: 4,
    });
    expect(parseTimecode("01:02:03;04")).toEqual({
      hours: 1,
      minutes: 2,
      seconds: 3,
      frames: 4,
    });
  });

  it("formats drop-frame with a semicolon before frames", () => {
    expect(formatSmpte(1, 2, 3, 4, false)).toBe("01:02:03:04");
    expect(formatSmpte(1, 2, 3, 4, true)).toBe("01:02:03;04");
  });

  it("round-trips total frames at 30 fps", () => {
    const tc = "00:01:02:15";
    expect(framesToTimecode(timecodeToFrames(tc, 30), 30, false)).toBe(tc);
  });

  it("converts wall-clock seconds without frames", () => {
    expect(timecodeToSeconds("01:02:03:29")).toBe(3723);
  });

  it("maps detected frame rates onto SMPTE fps", () => {
    expect(detectedToSmpteFps(24)).toBe(24);
    expect(detectedToSmpteFps(29)).toBe(29.97);
    expect(detectedToSmpteFps(29.97)).toBe(29.97);
    expect(detectedToSmpteFps(30)).toBe(30);
    expect(detectedToSmpteFps(60)).toBe(30);
  });
});

describe("resolveActiveCue", () => {
  const cues = [
    { id: "late", timecode: "00:00:10:00", sectionIndex: 2, lineIndex: 0, label: "chorus" },
    { id: "early", timecode: "00:00:02:00", sectionIndex: 0, lineIndex: 1, label: "verse" },
  ];

  it("returns null before the first cue", () => {
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 1, frames: 0 }, cues, 30)).toBeNull();
  });

  it("holds the last cue whose timecode has been reached", () => {
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 2, frames: 0 }, cues, 30)?.id).toBe("early");
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 10, frames: 1 }, cues, 30)?.id).toBe("late");
  });

  it("returns null for an empty cue list", () => {
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 5, frames: 0 }, [], 30)).toBeNull();
  });

  it("activates a cue at 00:00:00:00", () => {
    const zero = [{ id: "open", timecode: "00:00:00:00", sectionIndex: 0, label: "top" }];
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 0, frames: 0 }, zero, 30)?.id).toBe("open");
  });

  it("stays inactive one frame before the first cue", () => {
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 1, frames: 29 }, cues, 30)).toBeNull();
  });

  it("uses the later of two cues that share a timecode", () => {
    const dup = [
      { id: "a", timecode: "00:00:05:00", sectionIndex: 0, label: "a" },
      { id: "b", timecode: "00:00:05:00", sectionIndex: 1, label: "b" },
    ];
    expect(resolveActiveCue({ hours: 0, minutes: 0, seconds: 5, frames: 0 }, dup, 30)?.id).toBe("b");
  });
});

describe("timecode edges", () => {
  it("parses missing fields as zero", () => {
    expect(parseTimecode("")).toEqual({ hours: 0, minutes: 0, seconds: 0, frames: 0 });
    expect(parseTimecode("01:02")).toEqual({ hours: 1, minutes: 2, seconds: 0, frames: 0 });
  });

  it("converts one second of frames at 24 and 25 fps", () => {
    expect(framesToTimecode(24, 24, false)).toBe("00:00:01:00");
    expect(framesToTimecode(25, 25, false)).toBe("00:00:01:00");
  });

  it("clamps negative frame totals to zero", () => {
    expect(framesToTimecode(-90, 30, false)).toBe("00:00:00:00");
  });

  it("maps 25 fps detections", () => {
    expect(detectedToSmpteFps(25)).toBe(25);
  });
});

