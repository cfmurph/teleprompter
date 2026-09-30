import { afterEach, describe, expect, it, vi } from "vitest";
import { TapTempo, bpmToScrollSpeed, clampBpm, scrollSpeedToBpm } from "./bpm-sync";

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

  it("drops the oldest tap after 8 samples", () => {
    const tap = new TapTempo();
    const now = vi.spyOn(performance, "now");
    for (let i = 0; i < 8; i++) {
      now.mockReturnValueOnce(i * 500);
      tap.tap();
    }
    now.mockReturnValueOnce(8 * 500);
    expect(tap.tap()).toBe(120);
    now.mockReturnValueOnce(8 * 500 + 2_000);
    expect(tap.tap()).toBe(84);
  });

  it("returns Infinity when two taps share a timestamp", () => {
    const tap = new TapTempo();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(1_000);
    tap.tap();
    now.mockReturnValueOnce(1_000);
    expect(tap.tap()).toBe(Infinity);
  });

  it("reports 1 BPM for a 60-second interval", () => {
    const tap = new TapTempo();
    const now = vi.spyOn(performance, "now");
    now.mockReturnValueOnce(0);
    tap.tap();
    now.mockReturnValueOnce(60_000);
    expect(tap.tap()).toBe(1);
  });
});

describe("clampBpm", () => {
  it("floors at 20 and ceilings at 300", () => {
    expect(clampBpm(19)).toBe(20);
    expect(clampBpm(20)).toBe(20);
    expect(clampBpm(300)).toBe(300);
    expect(clampBpm(301)).toBe(300);
    expect(clampBpm(900)).toBe(300);
  });

  it("rounds fractional tempos", () => {
    expect(clampBpm(120.4)).toBe(120);
    expect(clampBpm(120.6)).toBe(121);
  });

  it("falls back to 120 for non-finite values", () => {
    expect(clampBpm(Number.NaN)).toBe(120);
    expect(clampBpm(Number.POSITIVE_INFINITY)).toBe(120);
  });
});

