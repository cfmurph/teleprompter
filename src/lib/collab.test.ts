import { describe, expect, it } from "vitest";
import { collabRoomName, parseStoredUser } from "./collab";

describe("collabRoomName", () => {
  it("scopes the webrtc room to a teleprompter id", () => {
    expect(collabRoomName("abc")).toBe("teleprompter-room-abc");
    expect(collabRoomName("a")).not.toBe(collabRoomName("b"));
  });
});

describe("parseStoredUser", () => {
  it("returns null for missing or invalid JSON", () => {
    expect(parseStoredUser(null)).toBeNull();
    expect(parseStoredUser("")).toBeNull();
    expect(parseStoredUser("{")).toBeNull();
    expect(parseStoredUser("{}")).toBeNull();
  });

  it("reads a stored identity", () => {
    expect(
      parseStoredUser(JSON.stringify({ id: "u1", name: "Bold Host", color: "#3b82f6" }))
    ).toEqual({ id: "u1", name: "Bold Host", color: "#3b82f6" });
  });
});
