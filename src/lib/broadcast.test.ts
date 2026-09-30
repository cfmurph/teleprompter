import { describe, expect, it } from "vitest";
import { channelName } from "./broadcast";

describe("channelName", () => {
  it("scopes the operator channel to a setlist", () => {
    expect(channelName("setlist-demo")).toBe("teleprompter-console-setlist-demo");
    expect(channelName("a")).not.toBe(channelName("b"));
  });
});
