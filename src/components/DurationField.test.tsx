/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DurationField } from "./DurationField";

afterEach(() => {
  cleanup();
});

describe("DurationField", () => {
  it("shows the formatted song length", () => {
    render(<DurationField valueMs={204_000} onCommit={() => {}} />);
    expect(screen.getByLabelText("Time")).toHaveProperty("value", "3:24");
  });

  it("shows an empty field when duration is zero", () => {
    render(<DurationField valueMs={0} onCommit={() => {}} />);
    expect(screen.getByLabelText("Time")).toHaveProperty("value", "");
  });

  it("does not commit while typing", () => {
    const onCommit = vi.fn();
    render(<DurationField valueMs={204_000} onCommit={onCommit} />);
    const input = screen.getByLabelText("Time");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1:00" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveProperty("value", "1:00");
  });

  it("commits the draft on blur", () => {
    const onCommit = vi.fn();
    render(<DurationField valueMs={204_000} onCommit={onCommit} />);
    const input = screen.getByLabelText("Time");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1:00" } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("1:00");
  });

  it("commits on Enter", () => {
    const onCommit = vi.fn();
    render(<DurationField valueMs={204_000} onCommit={onCommit} />);
    const input = screen.getByLabelText("Time");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2:10" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith("2:10");
  });
});
