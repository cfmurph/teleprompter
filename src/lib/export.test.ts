import { describe, expect, it } from "vitest";
import type { Script } from "./types";
import { escapeHtml, exportToMarkdown, exportToTxt, slugify } from "./export";

const script: Script = {
  id: "s1",
  title: "Count On Me!",
  description: "",
  tags: [],
  artist: "Demo",
  key: "G",
  bpm: 90,
  createdAt: 0,
  updatedAt: 0,
  wordCount: 4,
  readingTimeSec: 8,
  sections: [
    { id: "v", type: "verse", label: "Verse 1", content: "[G]Hello [C]world" },
  ],
};

describe("exportToTxt", () => {
  it("strips chords by default", () => {
    const txt = exportToTxt(script);
    expect(txt).toContain("COUNT ON ME!");
    expect(txt).toContain("Artist: Demo");
    expect(txt).toContain("Key: G | BPM: 90");
    expect(txt).toContain("[ VERSE 1 ]");
    expect(txt).toContain("Hello world");
    expect(txt).not.toContain("[G]");
  });

  it("keeps ChordPro when requested", () => {
    expect(exportToTxt(script, true)).toContain("[G]Hello [C]world");
  });
});

describe("exportToMarkdown", () => {
  it("emits title, meta, and stripped lyrics", () => {
    const md = exportToMarkdown(script);
    expect(md).toContain("# Count On Me!");
    expect(md).toContain("**Artist:** Demo");
    expect(md).toContain("## Verse 1");
    expect(md).toContain("Hello world");
  });

  it("keeps chords when requested", () => {
    expect(exportToMarkdown(script, true)).toContain("[G]Hello [C]world");
  });
});

describe("slugify / escapeHtml", () => {
  it("builds a filename slug", () => {
    expect(slugify("Count On Me!")).toBe("count-on-me");
    expect(slugify("A".repeat(80)).length).toBe(60);
  });

  it("escapes HTML entities", () => {
    expect(escapeHtml(`<b a="x">&`)).toBe("&lt;b a=&quot;x&quot;&gt;&amp;");
  });
});
