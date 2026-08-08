# dropbox-bg-remover

Scans a Dropbox folder for images matching `*-r.*`, replaces their background
with solid white locally (no third-party upload, no API costs), and uploads
the result back to the same folder as `<name>-nobackground.<ext>` (same
extension as the source). Already-processed files are skipped on subsequent
runs.

Background removal runs entirely on this machine by default via
[`@imgly/background-removal-node`](https://www.npmjs.com/package/@imgly/background-removal-node)
(an ONNX/WASM segmentation model) — nothing about your images is sent
anywhere. For images where that local model doesn't do a clean job, the web
UI lets you select specific results and reprocess just those through the
[api4.ai](https://api4.ai/apis/bg-removal) API instead (paid, per-image) — see
"Reviewing results" below.

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
6. Under the **Settings** tab, note the **App key** and **App secret** (click
   **Show** next to the secret). You'll need both below.

   Do **not** use the "Generated access token" button under OAuth 2 — that
   token expires after 4 hours, which breaks a server meant to run in the
   background indefinitely. Instead, do the one-time refresh-token setup
   below, which never expires.

### 3. Get a long-lived refresh token (one-time, per Dropbox account)

1. In a browser, visit (replacing `APP_KEY`):

   ```
   https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline
   ```

2. Log in and click **Allow**. Dropbox shows an authorization code on the
   page — copy it.
3. Exchange it for a refresh token (replace `AUTH_CODE`, `APP_KEY`, `APP_SECRET`):

   ```bash
   curl https://api.dropboxapi.com/oauth2/token \
     -d code=AUTH_CODE \
     -d grant_type=authorization_code \
     -d client_id=APP_KEY \
     -d client_secret=APP_SECRET
   ```

4. The JSON response includes a `refresh_token` field — that's the one you
   need (ignore `access_token`, it's the same short-lived kind as before).

### 4. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
DROPBOX_APP_KEY=<App key from step 2>
DROPBOX_APP_SECRET=<App secret from step 2>
DROPBOX_REFRESH_TOKEN=<refresh_token from step 3>
DROPBOX_FOLDER=/retake/test
API4AI_API_KEY=<optional, see below>
```

`DROPBOX_FOLDER` is the default/starting Dropbox path. Change it per
machine/environment as needed.

`API4AI_API_KEY` is optional — only needed if you want the "reprocess with
api4.ai" button in the web UI. Get a key at
[portal.api4.ai](https://portal.api4.ai) (pay-as-you-go, no credit card
required to sign up). Leave it blank to skip this entirely; local-only
processing still works fine without it.

`.env` is gitignored and never committed.

The app key/secret/refresh token combo works the same across every machine
running this project against the same Dropbox account — you can reuse the
same three values in `.env` on each machine instead of repeating steps 2-3.

### 5. Run

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

1. Clone/copy the project to `~/workspace/dropbox-bg-remover` on the target
   Mac (that's the path both apps assume), then `npm install` in it.
2. Set up `.env` as above (step 4).
3. Drag both `.app` icons to the Desktop or Dock for easy access.

From then on, the other person only ever double-clicks **Start BG Remover**
to open the tool and **Stop BG Remover** when done — no terminal involved.

If the project folder ends up somewhere other than
`~/workspace/dropbox-bg-remover`, edit the `PROJECT_DIR` line near the top of
`Start BG Remover.app/Contents/MacOS/start-server` (right-click the app →
**Show Package Contents** to get to it) to match.

If **Start BG Remover** ever fails, it shows a plain popup explaining why
(Node not found, project folder not found, or the server didn't start in
time — check `server.log` in the project folder for details in the last
case).

## Reviewing results & reprocessing with api4.ai

After a run, the web UI shows a **3. Results** section with a thumbnail of
every processed image.

- **Click a thumbnail** to open the full-size file locally in Preview. This
  only works on a Mac with the Dropbox desktop app installed and that file
  already synced — it reads the file straight off disk via Dropbox's local
  sync folder, not the API.
- **Check the box** on any images the local model didn't handle well, then
  click **Reprocess selected with api4.ai** (requires `API4AI_API_KEY` in
  `.env`) to redo just those through api4.ai's API instead — overwrites the
  same output file. This keeps costs down: only pay for the images that
  actually need it, typically a minority of a batch.
- Results persist in the gallery across reprocess runs, so you can keep
  reviewing and selectively reprocessing until you're happy with the batch.
  Starting a fresh **Run on this folder** clears the gallery and starts over.

## How it decides what to process

- A file is a **source image** if its name matches `*-r.*` (e.g. `product-r.jpg`).
- Its expected output is `<name-without-extension>-nobackground.<ext>`,
  keeping the original extension (e.g. `product-r-nobackground.jpg`). The
  removed background is filled with solid white.
- Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`. Anything else is
  skipped with a warning.
- If that output file already exists in the folder, the source is skipped.
