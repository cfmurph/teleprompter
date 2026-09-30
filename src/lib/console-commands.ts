import type { ConsoleCommand } from "./types";

export function smpteLockCommand(timecode: string, locked: boolean): Extract<ConsoleCommand, { type: "SMPTE_LOCK" }> {
  return { type: "SMPTE_LOCK", locked, timecode };
}

export type SmpteLockState = { locked: boolean; timecode: string } | null;

export function applySmpteLock(cmd: Extract<ConsoleCommand, { type: "SMPTE_LOCK" }>): SmpteLockState {
  return { locked: cmd.locked, timecode: cmd.timecode };
}
