"use client";

import { use, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Clock,
  AlignLeft,
  Users,
  Tag,
  Bell,
  BellOff,
  X,
  Download,
  FileText,
  FileType,
} from "lucide-react";
import { downloadTxt, downloadMarkdown, exportToPdf } from "@/lib/export";
import { useStore } from "@/lib/store";
import { Section, SectionType, CueCard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Section type options ─────────────────────────────────────────────────────

const SECTION_TYPES: { value: SectionType; label: string; color: string }[] = [
  { value: "intro", label: "Intro", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  { value: "verse", label: "Verse", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { value: "pre-chorus", label: "Pre-Chorus", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  { value: "chorus", label: "Chorus", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  { value: "bridge", label: "Bridge", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { value: "outro", label: "Outro", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  { value: "solo", label: "Solo", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  { value: "spoken", label: "Spoken", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  { value: "custom", label: "Custom", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
];

function getSectionStyle(type: SectionType): string {
  return SECTION_TYPES.find((t) => t.value === type)?.color || SECTION_TYPES[8].color;
}

function formatReadingTime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ─── Cue Card Editor ──────────────────────────────────────────────────────────

function CueCardEditor({
  cueCard,
  onChange,
  onRemove,
}: {
  cueCard: CueCard;
  onChange: (c: CueCard) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-amber-300 text-xs font-semibold flex items-center gap-1.5">
          <Bell className="h-3 w-3" /> Cue Card
        </span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Input
        value={cueCard.label}
        onChange={(e) => onChange({ ...cueCard, label: e.target.value })}
        placeholder="Cue card message…"
        className="bg-background/50 border-amber-500/30 text-sm h-8"
      />
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Countdown
          <input
            type="number"
            min={0}
            max={30}
            value={cueCard.countdownSec}
            onChange={(e) =>
              onChange({ ...cueCard, countdownSec: parseInt(e.target.value) || 0 })
            }
            className="w-12 bg-background border border-border rounded px-2 py-0.5 text-xs text-foreground ml-1"
          />
          s
        </label>
        <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={cueCard.autoResume}
            onChange={(e) => onChange({ ...cueCard, autoResume: e.target.checked })}
            className="rounded"
          />
          Auto-resume
        </label>
      </div>
    </div>
  );
}

// ─── Section editor ───────────────────────────────────────────────────────────

function SectionEditor({
  section,
  index,
  total,
  scriptId,
  onMove,
}: {
  section: Section;
  index: number;
  total: number;
  scriptId: string;
  onMove: (from: number, to: number) => void;
}) {
  const { updateSection, deleteSection, setCueCard } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const updateContent = useCallback(
    (content: string) => updateSection(scriptId, section.id, { content }),
    [scriptId, section.id, updateSection]
  );

  const updateLabel = useCallback(
    (label: string) => updateSection(scriptId, section.id, { label }),
    [scriptId, section.id, updateSection]
  );

  const updateType = useCallback(
    (type: SectionType) => updateSection(scriptId, section.id, { type }),
    [scriptId, section.id, updateSection]
  );

  const wordCount = section.content.trim().split(/\s+/).filter(Boolean).length;

  // Auto-grow textarea
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border">
        {/* Drag handle placeholder */}
        <div className="text-muted-foreground/40 cursor-grab">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Type badge */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`text-xs px-2 py-1 rounded border font-semibold cursor-pointer transition-colors ${getSectionStyle(section.type)}`}
          >
            {SECTION_TYPES.find((t) => t.value === section.type)?.label || "Custom"}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {SECTION_TYPES.map((t) => (
              <DropdownMenuItem key={t.value} onClick={() => updateType(t.value)}>
                <span className={`mr-2 text-xs px-1.5 py-0.5 rounded border ${t.color}`}>
                  {t.label}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Label */}
        <input
          className="flex-1 bg-transparent text-sm font-medium text-foreground focus:outline-none placeholder:text-muted-foreground min-w-0"
          value={section.label}
          onChange={(e) => updateLabel(e.target.value)}
          placeholder="Section name…"
        />

        {/* Stats */}
        <span className="text-xs text-muted-foreground hidden sm:block">
          {wordCount}w
        </span>

        {/* Cue card toggle */}
        <button
          onClick={() =>
            section.cueCard
              ? setCueCard(scriptId, section.id, undefined)
              : setCueCard(scriptId, section.id, {
                  id: crypto.randomUUID(),
                  label: "Pause here",
                  countdownSec: 0,
                  autoResume: false,
                })
          }
          className={`text-muted-foreground hover:text-foreground transition-colors ${
            section.cueCard ? "text-amber-400" : ""
          }`}
          title={section.cueCard ? "Remove cue card" : "Add cue card"}
        >
          {section.cueCard ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 opacity-40" />}
        </button>

        {/* Reorder */}
        <div className="flex gap-0.5">
          <button
            onClick={() => onMove(index, index - 1)}
            disabled={index === 0}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => onMove(index, index + 1)}
            disabled={index === total - 1}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Collapse / Delete */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        <button
          onClick={() => deleteSection(scriptId, section.id)}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4 space-y-2">
          <textarea
            ref={textRef}
            className="w-full bg-transparent text-sm text-foreground leading-relaxed resize-none focus:outline-none placeholder:text-muted-foreground font-mono min-h-[80px]"
            value={section.content}
            onChange={(e) => {
              updateContent(e.target.value);
              autoGrow(e.target);
            }}
            onInput={(e) => autoGrow(e.target as HTMLTextAreaElement)}
            placeholder="Enter your script text here…"
            rows={4}
          />
          {section.cueCard && (
            <CueCardEditor
              cueCard={section.cueCard}
              onChange={(c) => setCueCard(scriptId, section.id, c)}
              onRemove={() => setCueCard(scriptId, section.id, undefined)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Script Editor Page ───────────────────────────────────────────────────────

export default function ScriptEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { scripts, updateScript, addSection, reorderSections } = useStore();
  const script = scripts[id];

  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInput, setTagInput] = useState("");

  if (!script) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Script not found</p>
          <Button variant="link" onClick={() => router.push("/")}>
            Back to library
          </Button>
        </div>
      </div>
    );
  }

  function handleMove(from: number, to: number) {
    if (to < 0 || to >= script.sections.length) return;
    const sections = [...script.sections];
    const [item] = sections.splice(from, 1);
    sections.splice(to, 0, item);
    reorderSections(id, sections);
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || script.tags.includes(tag)) {
      setTagInput("");
      setShowTagInput(false);
      return;
    }
    updateScript(id, { tags: [...script.tags, tag] });
    setTagInput("");
    setShowTagInput(false);
  }

  function removeTag(tag: string) {
    updateScript(id, { tags: script.tags.filter((t) => t !== tag) });
  }

  const totalWords = script.sections
    .map((s) => s.content.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Title */}
          <input
            className="flex-1 min-w-0 bg-transparent text-base font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground"
            value={script.title}
            onChange={(e) => updateScript(id, { title: e.target.value })}
            placeholder="Script title…"
          />

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <AlignLeft className="h-3.5 w-3.5" />
              {totalWords.toLocaleString()} words
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatReadingTime(script.readingTimeSec)}
            </span>
          </div>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-transparent text-xs font-medium hover:bg-secondary transition-colors">
              <Download className="h-3.5 w-3.5" /> Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadTxt(script, false)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Plain text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadTxt(script, true)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Text with chords (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadMarkdown(script, false)}>
                <FileType className="h-3.5 w-3.5 mr-2" /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportToPdf(script, false)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Print / PDF (no chords)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToPdf(script, true)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Print / PDF (with chords)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collab */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/room/${id}`)}
            className="hidden sm:flex gap-1.5"
          >
            <Users className="h-3.5 w-3.5" /> Collaborate
          </Button>

          {/* Perform */}
          <Button
            size="sm"
            onClick={() => router.push(`/perform/${id}`)}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> Perform
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-4">
        {/* Description */}
        <input
          className="w-full bg-transparent text-sm text-muted-foreground focus:outline-none placeholder:text-muted-foreground border-b border-transparent focus:border-border pb-1 transition-colors"
          value={script.description}
          onChange={(e) => updateScript(id, { description: e.target.value })}
          placeholder="Add a description…"
        />

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
          {script.tags.map((tag) => (
            <span
              key={tag}
              className="bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {showTagInput ? (
            <input
              autoFocus
              className="text-xs bg-secondary rounded-full px-2 py-0.5 focus:outline-none text-foreground w-24"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTag();
                if (e.key === "Escape") setShowTagInput(false);
              }}
              onBlur={addTag}
              placeholder="tag…"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              <Plus className="h-3 w-3" /> tag
            </button>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {script.sections.map((section, i) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={i}
              total={script.sections.length}
              scriptId={id}
              onMove={handleMove}
            />
          ))}
        </div>

        {/* Add section buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <p className="text-xs text-muted-foreground w-full">Add section:</p>
          {SECTION_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => addSection(id, t.value)}
              className={`text-xs px-2.5 py-1 rounded border font-medium transition-opacity hover:opacity-80 ${t.color}`}
            >
              + {t.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
