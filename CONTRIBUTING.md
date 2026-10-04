# Contributing

Thanks for helping with Flow Prompter.

## Setup

```bash
npm install
npm run dev
```

The demo show is at `/console/setlist-demo`.

## Before you open a PR

```bash
npm test
npm run build
```

`npm run lint` is available but not a merge gate yet — the tree still has existing ESLint debt.

Keep pull requests focused. Changes land on `main` through a PR; do not force-push that branch.

## Project notes

Scripts and setlists live in the browser (`localStorage`). There is no backend. Unit tests in `src/lib` and `src/components` are the regression net for song-sync and SMPTE math — add or update a test when you change that behavior.
