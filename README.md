# dropbox-bg-remover

Scans a Dropbox folder for images matching `*-r.*`, replaces their background
with solid white locally (no third-party upload, no API costs), and uploads
the result back to the same folder as `<name>-nobackground.<ext>` (same
extension as the source). Already-processed files are skipped on subsequent
runs.

Background removal runs entirely on this machine via
[`@imgly/background-removal-node`](https://www.npmjs.com/package/@imgly/background-removal-node)
(an ONNX/WASM segmentation model) — nothing about your images is sent to any
third-party background-removal service.

## Setup (do this on each machine you run it on)

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Dropbox app (one-time, per Dropbox account)

1. Go to https://www.dropbox.com/developers/apps and log in.
2. Click **Create app** -> **Scoped access**.
3. Choose **App folder** (script only touches `Apps/<app-name>/...`) or
   **Full Dropbox** (script can reach any existing folder).
4. Name the app, e.g. `bg-remover-script`.
5. Under the **Permissions** tab, enable:
   - `files.metadata.read`
   - `files.metadata.write`
   - `files.content.read`
   - `files.content.write`

   Click **Submit**.
6. Under the **Settings** tab, find **OAuth 2** -> **Generated access token**
   and click **Generate**. Copy the token.

### 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
DROPBOX_ACCESS_TOKEN=<paste your token here>
DROPBOX_FOLDER=/retake/test
```

`DROPBOX_FOLDER` is the default/starting Dropbox path. Change it per
machine/environment as needed.

`.env` is gitignored and never committed.

### 4. Run

**Command line** — processes `DROPBOX_FOLDER` from `.env` once and exits:

```bash
npm start
```

**Web UI** — browse to any subfolder and run on it, with live progress:

```bash
npm run serve
```

Then open http://localhost:3000. This is meant to be left running in the
background so you can trigger runs from the browser whenever you want,
without touching the command line. The Dropbox token stays server-side — the
browser never sees it. Click **Stop Server** in the page (or use the Stop app
below) to shut it down.

First run downloads the segmentation model (~80MB, one-time, cached
afterward), so it'll be noticeably slower than later runs.

### No-terminal setup (e.g. for a non-technical user on another Mac)

Two double-clickable apps are included at the project root:

- **Start BG Remover.app** — starts the server in the background (if not
  already running) and opens the web UI in the default browser.
- **Stop BG Remover.app** — shuts the server down. Safe to double-click even
  if it's already stopped.

Setup, done once by whoever installs Node:

1. `npm install` this project into `~/dropbox-bg-remover` on the target Mac
   (i.e. clone/copy it so the folder is directly in the home directory —
   that's the path both apps assume).
2. Set up `.env` as above (step 3).
3. Drag both `.app` icons to the Desktop or Dock for easy access.

From then on, the other person only ever double-clicks **Start BG Remover**
to open the tool and **Stop BG Remover** when done — no terminal involved.

If the project folder ends up somewhere other than `~/dropbox-bg-remover`,
edit the `PROJECT_DIR` line near the top of
`Start BG Remover.app/Contents/MacOS/start-server` (right-click the app →
**Show Package Contents** to get to it) to match.

If **Start BG Remover** ever fails, it shows a plain popup explaining why
(Node not found, project folder not found, or the server didn't start in
time — check `server.log` in the project folder for details in the last
case).

## How it decides what to process

- A file is a **source image** if its name matches `*-r.*` (e.g. `product-r.jpg`).
- Its expected output is `<name-without-extension>-nobackground.<ext>`,
  keeping the original extension (e.g. `product-r-nobackground.jpg`). The
  removed background is filled with solid white.
- Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`. Anything else is
  skipped with a warning.
- If that output file already exists in the folder, the source is skipped.
