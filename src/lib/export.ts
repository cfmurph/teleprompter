"use client";

import { Script } from "./types";
import { stripChords } from "./chord-utils";

// ─── TXT export ───────────────────────────────────────────────────────────────

export function exportToTxt(script: Script, includeChords = false): string {
  const lines: string[] = [];

  lines.push(script.title.toUpperCase());
  if (script.artist) lines.push(`Artist: ${script.artist}`);
  if (script.key) lines.push(`Key: ${script.key}${script.bpm ? ` | BPM: ${script.bpm}` : ""}`);
  lines.push("─".repeat(50));
  lines.push("");

  for (const section of script.sections) {
    lines.push(`[ ${section.label.toUpperCase()} ]`);
    lines.push("");
    const content = includeChords ? section.content : stripChords(section.content);
    lines.push(content);
    lines.push("");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadTxt(script: Script, includeChords = false) {
  const text = exportToTxt(script, includeChords);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(script.title)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export (via browser print) ──────────────────────────────────────────

export function exportToPdf(script: Script, includeChords = false) {
  const text = exportToTxt(script, includeChords);

  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) return;

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(script.title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.7;
      color: #111;
      background: #fff;
      padding: 40px 48px;
    }
    h1 {
      font-size: 22px;
      font-weight: bold;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .meta {
      font-size: 11px;
      color: #555;
      margin-bottom: 24px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 8px;
    }
    .section-label {
      font-size: 10px;
      font-weight: bold;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #2563eb;
      margin-top: 24px;
      margin-bottom: 6px;
    }
    .section-content {
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.8;
    }
    .chord {
      color: #2563eb;
      font-weight: bold;
      font-size: 10px;
      vertical-align: super;
      margin-right: 1px;
    }
    @media print {
      body { padding: 20px 28px; }
      .section-label { color: #000; }
      .chord { color: #000; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(script.title)}</h1>
  <div class="meta">
    ${script.artist ? `Artist: ${escapeHtml(script.artist)} &nbsp;|&nbsp; ` : ""}
    ${script.key ? `Key: ${escapeHtml(script.key)}` : ""}
    ${script.bpm ? ` &nbsp;|&nbsp; BPM: ${script.bpm}` : ""}
    &nbsp;|&nbsp; ${script.wordCount} words &nbsp;|&nbsp; ~${Math.ceil(script.readingTimeSec / 60)} min
  </div>
  ${script.sections.map((section) => {
    const content = includeChords
      ? renderChordProHtml(section.content)
      : escapeHtml(stripChords(section.content));
    return `
  <div class="section-label">${escapeHtml(section.label)}</div>
  <div class="section-content">${content}</div>`;
  }).join("")}
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

// ─── Markdown export ──────────────────────────────────────────────────────────

export function exportToMarkdown(script: Script, includeChords = false): string {
  const lines: string[] = [];
  lines.push(`# ${script.title}`);
  if (script.artist) lines.push(`**Artist:** ${script.artist}`);
  if (script.key) lines.push(`**Key:** ${script.key}${script.bpm ? ` | **BPM:** ${script.bpm}` : ""}`);
  lines.push("");

  for (const section of script.sections) {
    lines.push(`## ${section.label}`);
    lines.push("");
    const content = includeChords ? section.content : stripChords(section.content);
    lines.push(content);
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(script: Script, includeChords = false) {
  const text = exportToMarkdown(script, includeChords);
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(script.title)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(str: string): string {
  return str.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderChordProHtml(content: string): string {
  // Convert [Chord] notation to superscript spans
  return escapeHtml(content).replace(/\[([^\]]+)\]/g, (_, chord) => {
    return `<span class="chord">${escapeHtml(chord)}</span>`;
  });
}
