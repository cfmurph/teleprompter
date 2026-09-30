/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HotkeySheet from "./HotkeySheet";

afterEach(() => cleanup());

describe("HotkeySheet", () => {
  it("lists playback and music-sync shortcuts", () => {
    render(<HotkeySheet onClose={() => {}} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();
    expect(screen.getByText("Playback")).toBeTruthy();
    expect(screen.getByText("Music Sync")).toBeTruthy();
    expect(screen.getByText("Tap tempo")).toBeTruthy();
  });

  it("closes from the backdrop and the X button", () => {
    const onClose = vi.fn();
    const { container } = render(<HotkeySheet onClose={onClose} />);
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
