"use client";

import { X, Keyboard } from "lucide-react";

interface HotkeyGroup {
  label: string;
  keys: { key: string; description: string }[];
}

const GROUPS: HotkeyGroup[] = [
  {
    label: "Playback",
    keys: [
      { key: "Space", description: "Play / Pause scroll (scroll mode) · Next section (slide mode)" },
      { key: "↑ / ↓", description: "Scroll up / down · Previous / next line (slide modes)" },
      { key: "← / →", description: "Previous / next section" },
      { key: "Page Up / Down", description: "Previous / next section" },
    ],
  },
  {
    label: "Display",
    keys: [
      { key: "F", description: "Toggle fullscreen" },
      { key: "M", description: "Toggle mirror mode" },
      { key: "+ / −", description: "Increase / decrease font size" },
      { key: "Esc", description: "Exit fullscreen · Return to editor" },
    ],
  },
  {
    label: "Scroll Speed (scroll mode)",
    keys: [
      { key: "1 – 9", description: "Set scroll speed (1 = slowest, 9 = fastest)" },
      { key: "0", description: "Stop scrolling" },
    ],
  },
  {
    label: "Modes",
    keys: [
      { key: "S", description: "Switch to Scroll mode" },
      { key: "H", description: "Switch to Highlight mode" },
      { key: "L", description: "Switch to Line mode" },
      { key: "A", description: "Switch to Arrow mode" },
    ],
  },
  {
    label: "Music Sync",
    keys: [
      { key: "B", description: "Open BPM / Music Sync panel" },
      { key: "T", description: "Tap tempo" },
    ],
  },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-200 text-xs font-mono leading-tight">
      {children}
    </kbd>
  );
}

interface HotkeySheetProps {
  onClose: () => void;
}

export default function HotkeySheet({ onClose }: HotkeySheetProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-400" />
            <span className="font-semibold text-sm text-white">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Groups */}
        <div className="p-5 space-y-6">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.keys.map(({ key, description }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 flex flex-wrap gap-1">
                      {key.split(" / ").map((k) => (
                        <Key key={k}>{k}</Key>
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400 leading-snug">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer note */}
          <p className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-800">
            Shortcuts are active during performance. Press <Key>?</Key> anytime to show this sheet.
          </p>
        </div>
      </div>
    </div>
  );
}
