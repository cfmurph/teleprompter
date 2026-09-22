"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Clock,
  AlignLeft,
  Copy,
  Trash2,
  Play,
  Upload,
  MoreHorizontal,
  Monitor,
  ListMusic,
  Calendar,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Script, Setlist } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReadingTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SECTION_BADGE_COLORS: Record<string, string> = {
  intro: "bg-violet-500/20 text-violet-300",
  verse: "bg-blue-500/20 text-blue-300",
  "pre-chorus": "bg-cyan-500/20 text-cyan-300",
  chorus: "bg-emerald-500/20 text-emerald-300",
  bridge: "bg-amber-500/20 text-amber-300",
  outro: "bg-rose-500/20 text-rose-300",
  solo: "bg-orange-500/20 text-orange-300",
  spoken: "bg-pink-500/20 text-pink-300",
  custom: "bg-zinc-500/20 text-zinc-300",
};

// ─── Script Card ──────────────────────────────────────────────────────────────

function ScriptCard({ script }: { script: Script }) {
  const router = useRouter();
  const { deleteScript, duplicateScript, setActiveScript } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preview = useMemo(() => {
    const text = script.sections
      .map((s) => s.content)
      .join(" ")
      .slice(0, 140);
    return text.length === 140 ? text + "…" : text;
  }, [script]);

  function open() {
    setActiveScript(script.id);
    router.push(`/script/${script.id}`);
  }

  function perform(e: React.MouseEvent) {
    e.stopPropagation();
    setActiveScript(script.id);
    router.push(`/perform/${script.id}`);
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation();
    const newId = duplicateScript(script.id);
    router.push(`/script/${newId}`);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      deleteScript(script.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  }

  return (
    <div
      className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-all duration-150 flex flex-col gap-3"
      onClick={open}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate text-base leading-tight">
            {script.title}
          </h3>
          {script.description && (
            <p className="text-muted-foreground text-xs mt-0.5 truncate">
              {script.description}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-md flex items-center justify-center hover:bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={open}>
              <FileText className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={perform}>
              <Play className="h-4 w-4 mr-2" /> Perform
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className={confirmDelete ? "text-destructive" : ""}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {confirmDelete ? "Click to confirm" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Preview text */}
      {preview && (
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
          {preview}
        </p>
      )}

      {/* Section pills */}
      {script.sections.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {script.sections.slice(0, 5).map((s) => (
            <span
              key={s.id}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                SECTION_BADGE_COLORS[s.type] || SECTION_BADGE_COLORS.custom
              }`}
            >
              {s.label}
            </span>
          ))}
          {script.sections.length > 5 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400 font-medium">
              +{script.sections.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <AlignLeft className="h-3 w-3" />
            {script.wordCount.toLocaleString()} words
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatReadingTime(script.readingTimeSec)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(script.updatedAt)}</span>
      </div>

      {/* Quick perform button */}
      <button
        onClick={perform}
        className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90"
      >
        <Play className="h-3 w-3 fill-current" /> Perform
      </button>
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { importScript } = useStore();
  const [title, setTitle] = useState("Imported Script");
  const [text, setText] = useState("");

  function handleImport() {
    if (!text.trim()) return;
    const id = importScript(title, text);
    onClose();
    router.push(`/script/${id}`);
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Import Script</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Script title"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Paste your script (double line-breaks become sections)
            </label>
            <textarea
              className="w-full h-48 bg-input border border-border rounded-lg p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your script here..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!text.trim()}>
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Setlist card ─────────────────────────────────────────────────────────────

function SetlistCard({ setlist }: { setlist: Setlist }) {
  const router = useRouter();
  const { scripts, deleteSetlist } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const songCount = setlist.scriptIds.length;
  const songs = setlist.scriptIds.map((id) => scripts[id]).filter(Boolean) as Script[];

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-primary/50 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <ListMusic className="h-4 w-4 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground truncate text-base">{setlist.name}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{setlist.date}</span>
            {setlist.venue && <span>{setlist.venue}</span>}
          </div>
        </div>
        <button
          onClick={() => { if (confirmDelete) { deleteSetlist(setlist.id); } else { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); } }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded ${confirmDelete ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive"}`}
        >
          {confirmDelete ? "Confirm" : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Song list preview */}
      <div className="space-y-1">
        {songs.slice(0, 4).map((song, i) => (
          <div key={song.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-4 text-right font-mono shrink-0">{i + 1}</span>
            <span className="truncate">{song.title}</span>
            {song.key && <span className="text-primary/70 shrink-0">{song.key}</span>}
          </div>
        ))}
        {songCount > 4 && <p className="text-xs text-muted-foreground pl-6">+{songCount - 4} more</p>}
        {songCount === 0 && <p className="text-xs text-muted-foreground/50 pl-6">No songs yet</p>}
      </div>

      <button
        onClick={() => router.push(`/console/${setlist.id}`)}
        className="mt-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <Monitor className="h-4 w-4" /> Open Console
      </button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const { scripts, createScript, setlists, createSetlist } = useStore();
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [tab, setTab] = useState<"scripts" | "setlists">("scripts");

  const scriptList = useMemo(() => {
    const all = Object.values(scripts).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [scripts, search]);

  function handleCreate() {
    const id = createScript();
    router.push(`/script/${id}`);
  }

  function handleCreateSetlist() {
    const id = createSetlist("New Setlist");
    router.push(`/console/${id}`);
  }

  const setlistList = useMemo(() => Object.values(setlists).sort((a, b) => b.updatedAt - a.updatedAt), [setlists]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            <span className="font-bold text-base tracking-tight">Flow</span>
            <span className="text-muted-foreground text-sm ml-1">Teleprompter</span>
          </div>
          <div className="flex items-center gap-2">
            {tab === "scripts" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Import
                </Button>
                <Button size="sm" onClick={handleCreate} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Script
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleCreateSetlist} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New Setlist
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 border-b border-border">
          <button
            onClick={() => setTab("scripts")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "scripts" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-4 w-4" /> Script Library
            <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-1.5">{Object.keys(scripts).length}</span>
          </button>
          <button
            onClick={() => setTab("setlists")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "setlists" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListMusic className="h-4 w-4" /> Live Shows
            <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-1.5">{setlistList.length}</span>
          </button>
        </div>

        {tab === "scripts" ? (
          <>
            {/* Search */}
            <div className="flex justify-end mb-6">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search scripts…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            {/* Script grid */}
            {scriptList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">{search ? "No scripts match your search" : "No scripts yet"}</p>
                {!search && <Button onClick={handleCreate} className="gap-2"><Plus className="h-4 w-4" /> Create Script</Button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scriptList.map((script) => <ScriptCard key={script.id} script={script} />)}
                <button onClick={handleCreate} className="border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[160px]">
                  <Plus className="h-8 w-8" /><span className="text-sm font-medium">New Script</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Setlist grid */}
            {setlistList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                  <ListMusic className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">No live shows yet</p>
                  <p className="text-muted-foreground text-sm mt-1">Create a setlist to run a live show with the Operator Console</p>
                </div>
                <Button onClick={handleCreateSetlist} className="gap-2"><Plus className="h-4 w-4" /> Create Setlist</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {setlistList.map((sl) => <SetlistCard key={sl.id} setlist={sl} />)}
                <button onClick={handleCreateSetlist} className="border border-dashed border-border rounded-xl p-5 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors min-h-[160px]">
                  <Plus className="h-8 w-8" /><span className="text-sm font-medium">New Setlist</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
