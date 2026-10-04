/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmpteTimeline } from "./SmpteTimeline";
import type { Script } from "@/lib/types";

afterEach(() => cleanup());

const script: Script = {
  id: "s1",
  title: "Count On Me",
  artist: "Demo",
  description: "",
  tags: [],
  sections: [
    { id: "v", type: "verse", label: "Verse 1", content: "a" },
    { id: "c", type: "chorus", label: "Chorus", content: "b" },
  ],
  createdAt: 0,
  updatedAt: 0,
  wordCount: 2,
  readingTimeSec: 1,
};

const cues = [
  { id: "late", timecode: "00:00:10:00", sectionIndex: 1, lineIndex: 0, label: "Chorus" },
  { id: "early", timecode: "00:00:02:00", sectionIndex: 0, lineIndex: 0, label: "Verse 1" },
];

describe("SmpteTimeline", () => {
  it("shows empty state and disables add without a script", () => {
    render(
      <SmpteTimeline
        script={null}
        cues={[]}
        fps={30}
        dropFrame={false}
        currentSectionIndex={0}
        liveTc="00:00:00:00"
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
        onJump={() => {}}
        onDropFrame={() => {}}
      />
    );
    expect(screen.getByText(/No cues on this song/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Cue/ })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "DF" })).toHaveProperty("disabled", true);
  });

  it("sorts cues, jumps, edits, deletes, and toggles drop-frame", () => {
    const onAdd = vi.fn();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onJump = vi.fn();
    const onDropFrame = vi.fn();
    render(
      <SmpteTimeline
        script={script}
        cues={cues}
        fps={29.97}
        dropFrame={false}
        currentSectionIndex={0}
        liveTc="00:00:05:00"
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onJump={onJump}
        onDropFrame={onDropFrame}
      />
    );

    const tcs = screen.getAllByDisplayValue(/00:00:/);
    expect(tcs[0]).toHaveProperty("value", "00:00:02:00");
    expect(tcs[1]).toHaveProperty("value", "00:00:10:00");

    fireEvent.click(screen.getByRole("button", { name: /Add Cue/ }));
    expect(onAdd).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "DF" }));
    expect(onDropFrame).toHaveBeenCalledWith(true);

    fireEvent.change(tcs[0], { target: { value: "00:00:03:00" } });
    expect(onUpdate).toHaveBeenCalledWith("early", { timecode: "00:00:03:00" });

    fireEvent.click(screen.getAllByRole("button", { name: "Go" })[0]);
    expect(onJump).toHaveBeenCalledWith(0, 0);

    fireEvent.click(screen.getAllByLabelText("Delete cue")[1]);
    expect(onDelete).toHaveBeenCalledWith("late");
  });
});
