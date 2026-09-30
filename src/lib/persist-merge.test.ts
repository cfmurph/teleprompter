import { describe, expect, it } from "vitest";
import { mergePersistedState } from "./persist-merge";
import type { Script, Setlist, SmpteSettings } from "./types";

const smpte: SmpteSettings = { fps: 30, fpsAuto: true, dropFrame: false };

function script(id: string, over: Partial<Script> = {}): Script {
  return {
    id,
    title: id,
    description: "",
    tags: [],
    sections: [{ id: "v", type: "verse", label: "V", content: "a" }],
    createdAt: 0,
    updatedAt: 0,
    wordCount: 1,
    readingTimeSec: 1,
    durationMs: 204_000,
    bpm: 90,
    smpteCues: id === "demo-6" ? [{ id: "c1", timecode: "00:00:02:00", sectionIndex: 0, label: "verse" }] : undefined,
    ...over,
  };
}

const demoSetlist: Setlist = {
  id: "setlist-demo",
  name: "Dallas",
  date: "2026-09-30",
  venue: "",
  scriptIds: ["demo-6"],
  songSync: { "demo-6": { bpm: 89, durationMs: 204_000, smpteStart: "00:00:00:00" } },
  createdAt: 0,
  updatedAt: 0,
};

const current = {
  scripts: { "demo-6": script("demo-6") },
  setlists: { "setlist-demo": demoSetlist },
  smpteSettings: smpte,
};

const seed = { demoScripts: [script("demo-6")], demoSetlist };

describe("mergePersistedState", () => {
  it("restores the demo setlist when it is missing from persisted data", () => {
    const merged = mergePersistedState(
      { scripts: current.scripts, setlists: {}, smpteSettings: smpte },
      current,
      seed
    );
    expect(merged.setlists["setlist-demo"]).toEqual(demoSetlist);
  });

  it("backfills missing demo durationMs", () => {
    const persistedScript = script("demo-6", { durationMs: undefined });
    delete (persistedScript as { durationMs?: number }).durationMs;
    const merged = mergePersistedState(
      {
        scripts: { "demo-6": persistedScript },
        setlists: { "setlist-demo": demoSetlist },
        smpteSettings: smpte,
      },
      current,
      seed
    );
    expect(merged.scripts["demo-6"].durationMs).toBe(204_000);
  });

  it("does not overwrite an explicit duration of 0", () => {
    const merged = mergePersistedState(
      {
        scripts: { "demo-6": script("demo-6", { durationMs: 0 }) },
        setlists: { "setlist-demo": demoSetlist },
        smpteSettings: smpte,
      },
      current,
      seed
    );
    expect(merged.scripts["demo-6"].durationMs).toBe(0);
  });

  it("backfills songSync only when the field is missing", () => {
    const without = { ...demoSetlist, songSync: undefined };
    delete (without as { songSync?: Setlist["songSync"] }).songSync;
    const filled = mergePersistedState(
      { scripts: current.scripts, setlists: { "setlist-demo": without }, smpteSettings: smpte },
      current,
      seed
    );
    expect(filled.setlists["setlist-demo"].songSync).toEqual(demoSetlist.songSync);

    const empty = mergePersistedState(
      {
        scripts: current.scripts,
        setlists: { "setlist-demo": { ...demoSetlist, songSync: {} } },
        smpteSettings: smpte,
      },
      current,
      seed
    );
    expect(empty.setlists["setlist-demo"].songSync).toEqual({});
  });

  it("backfills demo-6 SMPTE cues when the persisted song has none", () => {
    const merged = mergePersistedState(
      {
        scripts: { "demo-6": script("demo-6", { smpteCues: [] }) },
        setlists: { "setlist-demo": demoSetlist },
        smpteSettings: smpte,
      },
      current,
      seed
    );
    expect(merged.scripts["demo-6"].smpteCues).toEqual(seed.demoScripts[0].smpteCues);
  });

  it("merges smpteSettings over defaults", () => {
    const merged = mergePersistedState(
      {
        scripts: current.scripts,
        setlists: current.setlists,
        smpteSettings: { fps: 24, fpsAuto: false, dropFrame: true },
      },
      current,
      seed
    );
    expect(merged.smpteSettings).toEqual({ fps: 24, fpsAuto: false, dropFrame: true });
  });
});
