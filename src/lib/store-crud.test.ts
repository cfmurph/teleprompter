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

function twoSectionScript() {
  return {
    id: "nav-1",
    title: "Nav",
    description: "",
    tags: [],
    sections: [
      { id: "s0", type: "verse" as const, label: "V1", content: "a\nb" },
      { id: "s1", type: "chorus" as const, label: "C", content: "c\nd" },
    ],
    createdAt: 0,
    updatedAt: 0,
    wordCount: 4,
    readingTimeSec: 1,
  };
}

describe("setlist CRUD", () => {
  beforeEach(() => {
    useStore.setState({
      setlists: {},
      scripts: {},
      activeSetlistId: null,
      activeScriptId: null,
      currentSectionIndex: 0,
      currentLineIndex: 0,
    });
  });

  it("creates, updates, reorders, and deletes a setlist", () => {
    const id = useStore.getState().createSetlist("Night 1");
    expect(useStore.getState().setlists[id].name).toBe("Night 1");
    expect(useStore.getState().activeSetlistId).toBe(id);

    const a = useStore.getState().createScript({ title: "A" });
    const b = useStore.getState().createScript({ title: "B" });
    useStore.getState().addScriptToSetlist(id, a);
    useStore.getState().addScriptToSetlist(id, b);
    useStore.getState().addScriptToSetlist(id, a);
    expect(useStore.getState().setlists[id].scriptIds).toEqual([a, b]);

    useStore.getState().reorderSetlist(id, [b, a]);
    expect(useStore.getState().setlists[id].scriptIds).toEqual([b, a]);

    useStore.getState().updateSongSync(id, a, { bpm: 100 });
    useStore.getState().removeScriptFromSetlist(id, a);
    expect(useStore.getState().setlists[id].scriptIds).toEqual([b]);
    expect(useStore.getState().setlists[id].songSync?.[a]).toEqual({ bpm: 100 });

    useStore.getState().updateSetlist(id, { venue: "Dallas" });
    expect(useStore.getState().setlists[id].venue).toBe("Dallas");

    useStore.getState().deleteSetlist(id);
    expect(useStore.getState().setlists[id]).toBeUndefined();
    expect(useStore.getState().activeSetlistId).toBeNull();
  });
});

describe("script CRUD", () => {
  beforeEach(() => {
    useStore.setState({
      scripts: {},
      setlists: {},
      activeScriptId: null,
      currentSectionIndex: 3,
      currentLineIndex: 2,
    });
  });

  it("creates, duplicates, imports, and deletes scripts", () => {
    const id = useStore.getState().createScript({ title: "One" });
    expect(useStore.getState().scripts[id].title).toBe("One");
    expect(useStore.getState().scripts[id].sections).toHaveLength(1);

    const copyId = useStore.getState().duplicateScript(id);
    expect(copyId).not.toBe(id);
    expect(useStore.getState().scripts[copyId].title).toBe("One (Copy)");
    expect(useStore.getState().scripts[copyId].sections[0].id).not.toBe(
      useStore.getState().scripts[id].sections[0].id
    );

    const imported = useStore.getState().importScript("Imported", "hello\n\nworld");
    expect(useStore.getState().scripts[imported].sections.map((s) => s.content)).toEqual([
      "hello",
      "world",
    ]);

    useStore.getState().deleteScript(id);
    expect(useStore.getState().scripts[id]).toBeUndefined();
    expect(useStore.getState().activeScriptId).not.toBe(id);
  });

  it("resets line/section when setting the active script", () => {
    const id = useStore.getState().createScript();
    useStore.setState({ currentSectionIndex: 4, currentLineIndex: 9 });
    useStore.getState().setActiveScript(id);
    expect(useStore.getState().currentSectionIndex).toBe(0);
    expect(useStore.getState().currentLineIndex).toBe(0);
  });

  it("adds, updates, reorders, and deletes sections", () => {
    const id = useStore.getState().createScript();
    useStore.getState().addSection(id, "verse");
    useStore.getState().addSection(id, "verse");
    const script = useStore.getState().scripts[id];
    expect(script.sections.map((s) => s.label)).toEqual(["Section 1", "Verse 1", "Verse 2"]);

    const verseId = script.sections[1].id;
    useStore.getState().updateSection(id, verseId, { content: "line" });
    expect(useStore.getState().scripts[id].wordCount).toBe(1);

    useStore.getState().setCueCard(id, verseId, {
      id: "cue",
      label: "Hold",
      countdownSec: 3,
      autoResume: true,
    });
    expect(useStore.getState().scripts[id].sections[1].cueCard?.label).toBe("Hold");

    const reversed = [...useStore.getState().scripts[id].sections].reverse();
    useStore.getState().reorderSections(id, reversed);
    expect(useStore.getState().scripts[id].sections[0].label).toBe("Verse 2");

    useStore.getState().deleteSection(id, verseId);
    expect(useStore.getState().scripts[id].sections.find((s) => s.id === verseId)).toBeUndefined();
  });
});

describe("perform navigation", () => {
  beforeEach(() => {
    const script = twoSectionScript();
    useStore.setState({
      scripts: { "nav-1": script },
      activeScriptId: "nav-1",
      currentSectionIndex: 0,
      currentLineIndex: 0,
      isPerforming: false,
    });
  });

  it("wraps nextLine across sections and stops at the end", () => {
    useStore.getState().nextLine();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 0, currentLineIndex: 1 });
    useStore.getState().nextLine();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 1, currentLineIndex: 0 });
    useStore.getState().nextLine();
    useStore.getState().nextLine();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 1, currentLineIndex: 1 });
  });

  it("wraps prevLine back into the previous section", () => {
    useStore.setState({ currentSectionIndex: 1, currentLineIndex: 0 });
    useStore.getState().prevLine();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 0, currentLineIndex: 1 });
    useStore.getState().prevLine();
    useStore.getState().prevLine();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 0, currentLineIndex: 0 });
  });

  it("advances sections and resets the line", () => {
    useStore.setState({ currentLineIndex: 1 });
    useStore.getState().nextSection();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 1, currentLineIndex: 0 });
    useStore.getState().nextSection();
    expect(useStore.getState().currentSectionIndex).toBe(1);
    useStore.getState().prevSection();
    expect(useStore.getState()).toMatchObject({ currentSectionIndex: 0, currentLineIndex: 0 });
  });

  it("starts performing at the top and can stop", () => {
    useStore.setState({ currentSectionIndex: 1, currentLineIndex: 1 });
    useStore.getState().startPerforming();
    expect(useStore.getState()).toMatchObject({
      isPerforming: true,
      currentSectionIndex: 0,
      currentLineIndex: 0,
    });
    useStore.getState().stopPerforming();
    expect(useStore.getState().isPerforming).toBe(false);
  });
});

describe("settings", () => {
  it("clamps transpose to ±11", () => {
    useStore.setState({ transposeSteps: 0 });
    useStore.getState().setTranspose(4);
    useStore.getState().shiftTranspose(20);
    expect(useStore.getState().transposeSteps).toBe(11);
    useStore.getState().shiftTranspose(-40);
    expect(useStore.getState().transposeSteps).toBe(-11);
  });

  it("patches perform and SMPTE settings and cues", () => {
    const id = useStore.getState().createScript({ title: "Cued" });
    useStore.getState().setMode("line");
    useStore.getState().updatePerformSettings({ fontSize: 40 });
    useStore.getState().updateSmpteSettings({ fps: 24, dropFrame: true });
    useStore.getState().setSmpteCues(id, [
      { id: "c1", timecode: "00:00:01:00", sectionIndex: 0, label: "in" },
    ]);
    expect(useStore.getState().performSettings.mode).toBe("line");
    expect(useStore.getState().performSettings.fontSize).toBe(40);
    expect(useStore.getState().smpteSettings).toMatchObject({ fps: 24, dropFrame: true });
    expect(useStore.getState().scripts[id].smpteCues).toHaveLength(1);
  });
});
