import { describe, expect, it } from "vitest";
import { applySmpteLock, smpteLockCommand } from "./console-commands";
import { shouldBroadcastClock } from "./song-sync";

describe("SMPTE_LOCK command", () => {
  it("builds the operator → display payload", () => {
    expect(smpteLockCommand("00:00:12;14", true)).toEqual({
      type: "SMPTE_LOCK",
      locked: true,
      timecode: "00:00:12;14",
    });
  });

  it("applies lock and unlock onto display state", () => {
    expect(applySmpteLock(smpteLockCommand("01:02:03:04", true))).toEqual({
      locked: true,
      timecode: "01:02:03:04",
    });
    expect(applySmpteLock(smpteLockCommand("01:02:03:04", false))).toEqual({
      locked: false,
      timecode: "01:02:03:04",
    });
  });

  it("skips duplicate clock broadcasts", () => {
    const tc = "00:00:01:00";
    expect(shouldBroadcastClock(tc, tc)).toBe(false);
    expect(shouldBroadcastClock(tc, smpteLockCommand("00:00:01:01", true).timecode)).toBe(true);
  });
});
