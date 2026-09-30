import { afterEach, describe, expect, it, vi } from "vitest";
import { TapTempo, bpmToScrollSpeed, scrollSpeedToBpm } from "./bpm-sync";

describe("bpmToScrollSpeed", () => {
  it("advances one line height per beat by default", () => {
    expect(bpmToScrollSpeed({ bpm: 120, fontSize: 50, lineSpacing: 1.6, linesPerBeat: 1 })).toBe(160);
  });

  it("scales with lines per beat", () => {
    const base = bpmToScrollSpeed({ bpm: 90, fontSize: 40, lineSpacing: 1.5, linesPerBeat: 1 });
    const double = bpmToScrollSpeed({ bpm: 90, fontSize: 40, lineSpacing: 1.5, linesPerBeat: 2 });
    expect(base).toBe(90);
    expect(double).toBe(180);
  });

  it("round-trips through scrollSpeedToBpm", () => {
    const speed = bpmToScrollSpeed({ bpm: 104, fontSize: 52, lineSpacing: 1.6, linesPerBeat: 1 });
    expect(scrollSpeedToBpm(speed, 52, 1.6, 1)).toBeCloseTo(104);
  });
});

describe("TapTempo", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("needs two taps before returning a BPM", () => {
    const tap = new TapTempo();
    vi.spyOn(performance, "now").mockReturnValueOnce(0);
    expect(tap.tap()).toBeNull();
  });

  it("averages tap intervals into BPM", () => {
    const tap = new TapTempo();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(0);
    expect(tap.tap()).toBeNull();
    now.mockReturnValueOnce(500);
    expect(tap.tap()).toBe(120);
    now.mockReturnValueOnce(1000);
    expect(tap.tap()).toBe(120);
  });

  it("clears history on reset", () => {
    const tap = new TapTempo();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(0);
    tap.tap();
    now.mockReturnValueOnce(500);
    tap.tap();
    tap.reset();
    now.mockReturnValueOnce(2000);
    expect(tap.tap()).toBeNull();
  });
});
