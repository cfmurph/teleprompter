"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as Y from "yjs";
import {
  ArrowLeft,
  Link2,
  Check,
  Users,
  Play,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

// ─── User avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ background: color }}
      title={name}
    >
      {initials}
    </div>
  );
}

// ─── Collab Room Page ─────────────────────────────────────────────────────────

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { scripts, updateSection } = useStore();

  const script = scripts[roomId]; // roomId = scriptId for simplicity

  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [localName, setLocalName] = useState("Anonymous");
  const [localColor] = useState(
    () =>
      ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][
        Math.floor(Math.random() * 5)
      ]
  );

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<import("y-webrtc").WebrtcProvider | null>(null);
  const sectionTextsRef = useRef<Record<string, Y.Text>>({});

  // ── Initialize Yjs + y-webrtc ──────────────────────────────────────────

  useEffect(() => {
    if (!script) return;

    let mounted = true;

    async function init() {
      const { WebrtcProvider } = await import("y-webrtc");

      if (!mounted) return;

      const doc = new Y.Doc();
      docRef.current = doc;

      // Initialize shared text for each section
      script.sections.forEach((sec) => {
        const yText = doc.getText(`section-${sec.id}`);
        if (yText.length === 0) {
          doc.transact(() => {
            yText.insert(0, sec.content);
          });
        }
        sectionTextsRef.current[sec.id] = yText;
      });

      const provider = new WebrtcProvider(
        `teleprompter-${roomId}`,
        doc,
        {
          signaling: ["wss://signaling.yjs.dev"],
        }
      );
      providerRef.current = provider;

      provider.on("synced", ({ synced }: { synced: boolean }) => {
        if (mounted) setConnected(synced);
      });

      // Set local awareness
      provider.awareness.setLocalStateField("user", {
        id: doc.clientID,
        name: localName,
        color: localColor,
      });

      provider.awareness.on("change", () => {
        if (!mounted) return;
        const currentUsers: { id: string; name: string; color: string }[] = [];
        provider.awareness.getStates().forEach((state) => {
          if (state.user) currentUsers.push(state.user as { id: string; name: string; color: string });
        });
        setUsers(currentUsers);
      });

      // Sync changes from Yjs → store
      script.sections.forEach((sec) => {
        const yText = doc.getText(`section-${sec.id}`);
        yText.observe(() => {
          if (mounted) {
            updateSection(roomId, sec.id, { content: yText.toString() });
          }
        });
      });

      setConnected(true);
    }

    init().catch(console.error);

    return () => {
      mounted = false;
      providerRef.current?.destroy();
      docRef.current?.destroy();
      providerRef.current = null;
      docRef.current = null;
    };
  }, [roomId, script?.id]);

  // ── Update local awareness name ────────────────────────────────────────

  useEffect(() => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("user", {
        id: docRef.current?.clientID,
        name: localName,
        color: localColor,
      });
    }
  }, [localName]);

  // ── Copy link ──────────────────────────────────────────────────────────

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Handle textarea edits → Yjs ───────────────────────────────────────

  function handleSectionEdit(sectionId: string, newContent: string) {
    const yText = sectionTextsRef.current[sectionId];
    if (!yText || !docRef.current) {
      // Fallback: just update store directly
      updateSection(roomId, sectionId, { content: newContent });
      return;
    }
    const old = yText.toString();
    if (old === newContent) return;
    // Simple replace — for production use y-codemirror or quill
    docRef.current.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, newContent);
    });
  }

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-muted-foreground text-lg">Script not found.</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to Library
        </Button>
      </div>
    );
  }

  const shareUrl =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/script/${roomId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="h-4 w-4 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">
              Collaborating on "{script.title}"
            </span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {connected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 hidden sm:block">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                <span className="text-muted-foreground hidden sm:block">Connecting…</span>
              </>
            )}
          </div>

          <Button
            size="sm"
            onClick={() => router.push(`/perform/${roomId}`)}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Perform
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Share card */}
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" /> Share this room
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Anyone with this link can view and edit in real time. No account needed.
              </p>
            </div>
            <Button
              size="sm"
              variant={copied ? "secondary" : "default"}
              onClick={copyLink}
              className="gap-1.5 shrink-0"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5" /> Copied!</>
              ) : (
                <><Link2 className="h-3.5 w-3.5" /> Copy Link</>
              )}
            </Button>
          </div>
          <div className="bg-background rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate border border-border">
            {shareUrl}
          </div>
        </div>

        {/* Your name */}
        <div className="flex items-center gap-3">
          <UserAvatar name={localName} color={localColor} />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1">Your display name</label>
            <input
              className="bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>

        {/* Active users */}
        {users.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              In this room ({users.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5"
                >
                  <UserAvatar name={u.name} color={u.color} />
                  <span className="text-sm font-medium">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collaborative editor */}
        <div className="space-y-3">
          <h3 className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Script — All changes sync live
          </h3>
          {script.sections.map((section) => (
            <div
              key={section.id}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <span className="text-xs font-semibold text-foreground">
                  {section.label}
                </span>
              </div>
              <textarea
                className="w-full bg-transparent text-sm text-foreground leading-relaxed resize-none focus:outline-none placeholder:text-muted-foreground font-mono p-4 min-h-[80px]"
                value={section.content}
                onChange={(e) => handleSectionEdit(section.id, e.target.value)}
                placeholder="Start typing here…"
                rows={4}
              />
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            How collaboration works
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Changes sync peer-to-peer via WebRTC — no data stored on a server
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Share the room link with your team — they can join without an account
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              All changes are also saved locally in your browser
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              The Perform view can be opened from any device with the same script
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
