/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const rehydrate = vi.fn(() => Promise.resolve());

vi.mock("@/lib/store", () => ({
  useStore: {
    persist: { rehydrate },
  },
}));

afterEach(() => {
  cleanup();
  rehydrate.mockClear();
});

describe("StoreHydration", () => {
  it("rehydrates persisted state after mount", async () => {
    const { StoreHydration } = await import("./StoreHydration");
    render(<StoreHydration />);
    await waitFor(() => {
      expect(rehydrate).toHaveBeenCalledTimes(1);
    });
  });
});
