"use client";

/**
 * Operator ↔ Artist Display sync via BroadcastChannel.
 *
 * The Operator Console opens on one tab/window and sends commands.
 * The Artist Display (/perform) listens and executes them instantly.
 *
 * For cross-device sync, the same commands can be tunneled through
 * the Yjs/WebRTC room — but BroadcastChannel covers the primary
 * use case (operator laptop → artist monitor, same machine, split windows).
 *
 * Channel name: "teleprompter-console-<setlistId>"
 * This allows multiple setlists to have independent console sessions.
 */

import { ConsoleCommand } from "./types";

const CHANNEL_PREFIX = "teleprompter-console";

export function channelName(setlistId: string): string {
  return `${CHANNEL_PREFIX}-${setlistId}`;
}

// ─── Console (sender) ─────────────────────────────────────────────────────────

export class ConsoleChannel {
  private channel: BroadcastChannel;

  constructor(setlistId: string) {
    this.channel = new BroadcastChannel(channelName(setlistId));
  }

  send(cmd: ConsoleCommand) {
    this.channel.postMessage(cmd);
  }

  close() {
    this.channel.close();
  }
}

// ─── Display (receiver) ──────────────────────────────────────────────────────

export type CommandHandler = (cmd: ConsoleCommand) => void;

export class DisplayChannel {
  private channel: BroadcastChannel;

  constructor(setlistId: string, handler: CommandHandler) {
    this.channel = new BroadcastChannel(channelName(setlistId));
    this.channel.onmessage = (e: MessageEvent<ConsoleCommand>) => {
      handler(e.data);
    };
  }

  close() {
    this.channel.close();
  }
}

// ─── Hook: useBroadcastSender ────────────────────────────────────────────────

import { useEffect, useRef } from "react";

export function useBroadcastSender(setlistId: string | null) {
  const channelRef = useRef<ConsoleChannel | null>(null);

  useEffect(() => {
    if (!setlistId) return;
    channelRef.current = new ConsoleChannel(setlistId);
    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [setlistId]);

  function send(cmd: ConsoleCommand) {
    channelRef.current?.send(cmd);
  }

  return { send };
}

export function useBroadcastReceiver(setlistId: string | null, handler: CommandHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!setlistId) return;
    const ch = new DisplayChannel(setlistId, (cmd) => handlerRef.current(cmd));
    return () => ch.close();
  }, [setlistId]);
}
