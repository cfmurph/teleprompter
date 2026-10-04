import type { Script, Setlist, SmpteSettings } from "./types";

export type PersistedSlice = {
  scripts: Record<string, Script>;
  setlists: Record<string, Setlist>;
  smpteSettings: SmpteSettings;
};

export function mergePersistedState<T extends PersistedSlice>(
  persisted: Partial<PersistedSlice> | undefined,
  current: T,
  seed: { demoScripts: Script[]; demoSetlist: Setlist }
): T {
  const p: Partial<PersistedSlice> = persisted ?? {};
  const scripts = { ...current.scripts, ...(p.scripts ?? {}) };
  const setlists = { ...current.setlists, ...(p.setlists ?? {}) };
  const demoId = seed.demoSetlist.id;
  if (!setlists[demoId]) setlists[demoId] = seed.demoSetlist;

  const demo6 = seed.demoScripts.find((s) => s.id === "demo-6");
  if (scripts["demo-6"] && !scripts["demo-6"].smpteCues?.length && demo6?.smpteCues?.length) {
    scripts["demo-6"] = { ...scripts["demo-6"], smpteCues: demo6.smpteCues };
  }
  for (const demo of seed.demoScripts) {
    if (scripts[demo.id] && scripts[demo.id].durationMs == null && demo.durationMs) {
      scripts[demo.id] = { ...scripts[demo.id], durationMs: demo.durationMs };
    }
  }
  if (setlists[demoId] && setlists[demoId].songSync == null) {
    setlists[demoId] = { ...setlists[demoId], songSync: seed.demoSetlist.songSync };
  }
  const smpteSettings = { ...current.smpteSettings, ...(p.smpteSettings ?? {}) };
  return { ...current, ...p, scripts, setlists, smpteSettings };
}
