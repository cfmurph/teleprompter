/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

type Handler = ((ev: { data: unknown }) => void) | null;

class FakeBroadcastChannel {
  static buses = new Map<string, Set<FakeBroadcastChannel>>();
  name: string;
  onmessage: Handler = null;

  constructor(name: string) {
    this.name = name;
    const set = FakeBroadcastChannel.buses.get(name) ?? new Set();
    set.add(this);
    FakeBroadcastChannel.buses.set(name, set);
  }

  postMessage(data: unknown) {
    for (const peer of FakeBroadcastChannel.buses.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data });
    }
  }

  close() {
    FakeBroadcastChannel.buses.get(this.name)?.delete(this);
  }
}

vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);

const { ConsoleChannel, DisplayChannel, channelName } = await import("./broadcast");

afterEach(() => {
  FakeBroadcastChannel.buses.clear();
});

describe("BroadcastChannel operator → display", () => {
  it("delivers GOTO_LINE to the talent monitor", () => {
    const received: unknown[] = [];
    const display = new DisplayChannel("setlist-demo", (cmd) => received.push(cmd));
    const console = new ConsoleChannel("setlist-demo");
    console.send({ type: "GOTO_LINE", sectionIndex: 1, lineIndex: 2 });
    expect(received).toEqual([{ type: "GOTO_LINE", sectionIndex: 1, lineIndex: 2 }]);
    console.send({ type: "SMPTE_LOCK", locked: true, timecode: "00:00:01:00" });
    expect(received[1]).toEqual({ type: "SMPTE_LOCK", locked: true, timecode: "00:00:01:00" });
    console.close();
    display.close();
  });

  it("does not leak across setlists", () => {
    const other: unknown[] = [];
    const display = new DisplayChannel("other", (cmd) => other.push(cmd));
    const console = new ConsoleChannel("setlist-demo");
    console.send({ type: "PLAY_PAUSE" });
    expect(other).toEqual([]);
    expect(channelName("setlist-demo")).not.toBe(channelName("other"));
    console.close();
    display.close();
  });
});
