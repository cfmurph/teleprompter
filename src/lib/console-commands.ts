import type { ConsoleCommand } from "./types";

export function smpteLockCommand(timecode: string, locked: boolean): Extract<ConsoleCommand, { type: "SMPTE_LOCK" }> {
  return { type: "SMPTE_LOCK", locked, timecode };
}

export type SmpteLockState = { locked: boolean; timecode: string } | null;

export function applySmpteLock(cmd: Extract<ConsoleCommand, { type: "SMPTE_LOCK" }>): SmpteLockState {
  return { locked: cmd.locked, timecode: cmd.timecode };
}

export function gotoLineCommand(
  sectionIndex: number,
  lineIndex: number
): Extract<ConsoleCommand, { type: "GOTO_LINE" }> {
  return { type: "GOTO_LINE", sectionIndex, lineIndex };
}

export function applyGotoLine(
  cmd: Extract<ConsoleCommand, { type: "GOTO_LINE" }>
): { sectionIndex: number; lineIndex: number } {
  return { sectionIndex: cmd.sectionIndex, lineIndex: cmd.lineIndex };
}

export function gotoScriptCommand(scriptId: string): Extract<ConsoleCommand, { type: "GOTO_SCRIPT" }> {
  return { type: "GOTO_SCRIPT", scriptId };
}
