import { beforeEach, describe, expect, it, vi } from "vitest";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
});

const { useStore } = await import("./store");
const { resolveSongSync } = await import("./song-sync");

describe("updateSongSync", () => {
  beforeEach(() => {
    useStore.setState({
      setlists: {
        "setlist-demo": {
          id: "setlist-demo",
          name: "Dallas",
          date: "2026-09-30",
          venue: "",
          scriptIds: ["demo-6"],
          songSync: {
            "demo-6": { bpm: 89, durationMs: 204_000, smpteStart: "00:00:00:00" },
          },
          createdAt: 0,
          updatedAt: 0,
        },
      },
      scripts: {
        "demo-6": {
          id: "demo-6",
          title: "Count On Me",
          description: "",
          tags: [],
          sections: [{ id: "v", type: "verse", label: "V1", content: "a\nb" }],
          createdAt: 0,
          updatedAt: 0,
          wordCount: 2,
          readingTimeSec: 1,
          bpm: 90,
          durationMs: 204_000,
        },
      },
    });
  });

  it("writes per-song BPM, duration, and TC start on the setlist", () => {
    useStore.getState().updateSongSync("setlist-demo", "demo-6", {
      bpm: 100,
      durationMs: 60_000,
      smpteStart: "00:10:00:00",
    });

    const setlist = useStore.getState().setlists["setlist-demo"];
    const script = useStore.getState().scripts["demo-6"];
    expect(resolveSongSync(setlist, script)).toEqual({
      bpm: 100,
      durationMs: 60_000,
      smpteStart: "00:10:00:00",
    });
    expect(script.bpm).toBe(90);
    expect(script.durationMs).toBe(204_000);
  });

  it("merges a partial override without dropping other fields", () => {
    useStore.getState().updateSongSync("setlist-demo", "demo-6", { durationMs: 60_000 });
    expect(useStore.getState().setlists["setlist-demo"].songSync?.["demo-6"]).toEqual({
      bpm: 89,
      durationMs: 60_000,
      smpteStart: "00:00:00:00",
    });
  });

  it("no-ops when the setlist is missing", () => {
    const before = useStore.getState();
    useStore.getState().updateSongSync("missing", "demo-6", { bpm: 40 });
    expect(useStore.getState().setlists).toBe(before.setlists);
  });
});
