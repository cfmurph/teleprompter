# Flow Prompter

Live-show teleprompter for operators and talent. Manage a script library and setlist, run a HiWire-style operator console, and drive a clean artist display. Lyrics can follow song length, BPM, or SMPTE timecode.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The demo show is at [/console/setlist-demo](http://localhost:3000/console/setlist-demo).

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

Scripts and setlists persist in the browser (`localStorage`).

## Screens

| Route | Role |
| --- | --- |
| `/` | Script library and setlists |
| `/script/[id]` | Edit a chart |
| `/console/[setlistId]` | Operator desk for a live show |
| `/perform/display?setlist=…` | Talent monitor (open from **Display**) |
| `/remote/[setlistId]` | Handheld remote |
| `/room/[roomId]` | Real-time collab session |

The console talks to the display on the same machine over `BroadcastChannel`. Collab uses Yjs / WebRTC in a room.

## Operator console

The desk is built for a live set: catalog and setlist on the left, talent preview in the center, editable lyrics on the right.

**Start** runs a clock and walks lyrics through the current song. The green timecode stays visible in BPM and SMPTE modes.

### Song sync

Each song has a library BPM and length. The setlist can override those per slot (BPM, **Time**, SMPTE start) without changing the chart.

- **Time** is master when set: lyrics are spaced evenly across that duration (`3:24`, `1:00`, seconds, or SMPTE).
- If Time is empty, spacing falls back to BPM and lines/beat.
- **from BPM** fills Time from tempo × lyric line count.
- The running clock is `SMPTE start + elapsed`. Remaining time is `duration − elapsed`.

Edit sync on the setlist **Song sync** panel, the transport **Time** field, or the script header. Invalid Time input is ignored; the previous length stays.

### SMPTE

Switch the transport to **SMPTE** for FPS, drop-frame display, cue timeline, and optional LTC from a line-in / mic. Cues fire `GOTO_LINE` when their timecode is reached. Drop-frame currently changes the separator (`;`) only; frame math uses the nominal rate (29.97 → 30).

## Tests

Unit tests cover song-sync math (duration vs BPM, setlist overrides, clock, lyric mapping), persist merge, duration field commit-on-blur, and SMPTE lock payloads.

```bash
npm test
```

## Stack

Next.js 16 (App Router), React 19, Zustand, Tailwind CSS 4, Yjs, Vitest.
