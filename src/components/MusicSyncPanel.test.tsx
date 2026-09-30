/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MusicSyncPanel from "./MusicSyncPanel";
import { useStore } from "@/lib/store";

afterEach(() => cleanup());

describe("MusicSyncPanel", () => {
  it("switches tabs and closes", () => {
    const onClose = vi.fn();
    render(
      <MusicSyncPanel
        scriptId="demo-6"
        onScrollSpeedChange={() => {}}
        onSectionChange={() => {}}
        onLineChange={() => {}}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Music Sync")).toBeTruthy();
    expect(screen.getByText("Tempo (BPM)")).toBeTruthy();
    fireEvent.click(screen.getByText("SMPTE"));
    expect(screen.getByText("Audio Input")).toBeTruthy();
    fireEvent.click(screen.getByText("Voice"));
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("writes BPM onto the library script", () => {
    render(
      <MusicSyncPanel
        scriptId="demo-6"
        onScrollSpeedChange={() => {}}
        onSectionChange={() => {}}
        onLineChange={() => {}}
        onClose={() => {}}
      />
    );
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "140" } });
    expect(useStore.getState().scripts["demo-6"].bpm).toBe(140);
  });
});
