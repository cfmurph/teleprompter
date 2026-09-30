"use client";

import { useEffect, useState } from "react";
import { formatDurationInput } from "@/lib/song-sync";

export function DurationField({
  valueMs,
  onCommit,
  placeholder = "3:24",
  className,
}: {
  valueMs: number;
  onCommit: (raw: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const formatted = valueMs > 0 ? formatDurationInput(valueMs) : "";
  const [draft, setDraft] = useState(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatted);
  }, [formatted, focused]);

  return (
    <input
      aria-label="Time"
      value={focused ? draft : formatted}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setDraft(formatted);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}
