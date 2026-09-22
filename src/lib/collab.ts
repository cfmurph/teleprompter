"use client";

/**
 * Collaborative editing via Yjs + y-webrtc.
 *
 * Two participants open the same room URL (/room/[roomId]).
 * y-webrtc uses a public WebRTC signaling server (webrtc.fly.dev)
 * to establish P2P connections. All document data stays peer-to-peer —
 * nothing touches a central server after the handshake.
 */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export interface CollabState {
  doc: Y.Doc;
  provider: WebrtcProvider;
  users: CollabUser[];
  destroy: () => void;
}

// ─── Color palette for users ──────────────────────────────────────────────────

const USER_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
];

let _colorIdx = 0;
function nextColor(): string {
  return USER_COLORS[_colorIdx++ % USER_COLORS.length];
}

// ─── Anonymous name generator ─────────────────────────────────────────────────

const ADJECTIVES = ["Quick", "Bright", "Silent", "Bold", "Calm", "Swift"];
const NOUNS = ["Prompter", "Speaker", "Reader", "Editor", "Writer", "Host"];

function randomName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a} ${n}`;
}

// ─── Local user identity (persisted in session storage) ───────────────────────

function getLocalUser(): CollabUser {
  if (typeof window === "undefined") {
    return { id: "server", name: "Server", color: "#fff" };
  }
  const stored = sessionStorage.getItem("collab-user");
  if (stored) {
    try {
      return JSON.parse(stored) as CollabUser;
    } catch {
      // fall through
    }
  }
  const user: CollabUser = {
    id: crypto.randomUUID(),
    name: randomName(),
    color: nextColor(),
  };
  sessionStorage.setItem("collab-user", JSON.stringify(user));
  return user;
}

// ─── Join room ────────────────────────────────────────────────────────────────

/**
 * Join a collaboration room. Returns a CollabState with the shared Yjs doc
 * and a destroy() function to clean up on unmount.
 *
 * The shared doc contains:
 *   doc.getText('script') — the full script content
 *   doc.getMap('meta')    — { title, sectionLabels }
 */
export function joinRoom(roomId: string): CollabState {
  const localUser = getLocalUser();

  const doc = new Y.Doc();

  const provider = new WebrtcProvider(`teleprompter-room-${roomId}`, doc, {
    signaling: ["wss://webrtc.fly.dev"],
    password: undefined,
    awareness: {
      // @ts-ignore — awareness options typings vary by version
      localState: null,
    },
  });

  // Broadcast our presence
  provider.awareness.setLocalStateField("user", localUser);

  // Build user list from awareness
  function getUsers(): CollabUser[] {
    const users: CollabUser[] = [];
    provider.awareness.getStates().forEach((state) => {
      if (state.user) users.push(state.user as CollabUser);
    });
    return users;
  }

  // Track users reactively — callers should subscribe via awareness events
  const state: CollabState = {
    doc,
    provider,
    users: getUsers(),
    destroy: () => {
      provider.awareness.setLocalState(null);
      provider.destroy();
      doc.destroy();
    },
  };

  provider.awareness.on("change", () => {
    state.users = getUsers();
  });

  return state;
}

/**
 * Get the local user identity (safe to call during render).
 */
export { getLocalUser };
