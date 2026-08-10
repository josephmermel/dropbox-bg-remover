# dropbox-bg-remover

A small web app for removing backgrounds from images in a Dropbox folder.
Browse to a folder, pick which images to process from a preview gallery, run
them through a background-removal API provider of your choice, and the
results (`<name>-nobackground.<ext>`, same extension as the source, white
background) get uploaded back to the same Dropbox folder.

Background removal always goes through a paid API provider — currently
[api4.ai](https://api4.ai/apis/bg-removal) and
[Pixelcut](https://www.pixelcut.ai/docs/developer-guide/getting-started/api-overview)
are supported, pick whichever you have a key for when you run a batch. There
is no local/offline model; every image processed costs API credits with
whichever provider you choose, so the picker step exists specifically so you
only pay for images you actually want processed.

Providers are pluggable (`src/providers/`) — adding another one means
writing a new file in that folder with the same shape and listing it in
`src/providers/index.js`; config, the run API, and the UI all pick it up
automatically.

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
API4AI_API_KEY=<see below>
PIXELCUT_API_KEY=<see below>
```

`DROPBOX_FOLDER` is the default/starting Dropbox path. Change it per
machine/environment as needed.

You need **at least one** of the two `*_API_KEY` values set, or there's
nothing to process images with. Each one you set adds that provider to the
picker's provider dropdown in the web UI — set both to be able to choose
per-batch.

- `API4AI_API_KEY` — get one at [portal.api4.ai](https://portal.api4.ai)
  (pay-as-you-go, no credit card required to sign up).
- `PIXELCUT_API_KEY` — get one at
  [pixelcut.ai](https://www.pixelcut.ai/docs/developer-guide/getting-started/api-overview).

`.env` is gitignored and never committed.

The app key/secret/refresh token combo works the same across every machine
running this project against the same Dropbox account — you can reuse the
same three values in `.env` on each machine instead of repeating steps 2-3.

### 5. Run

**Web UI** (the normal way to use this):

```bash
npm run serve
```

Then open http://localhost:3000. This is meant to be left running in the
background so you can trigger runs from the browser whenever you want,
without touching the command line. The Dropbox token and provider API keys
stay server-side — the browser never sees them. Click **Stop Server** in the
page (or use the stop script below) to shut it down.

**Command line** — unattended batch mode: processes every unprocessed image
in `DROPBOX_FOLDER` (no picker, no confirmation) using whichever provider
has a key configured first in `.env` (api4.ai, then Pixelcut):

```bash
npm start
```

### Quick launch scripts (for someone who doesn't want to type commands)

Two double-clickable scripts are included at the project root:

- **start-server.sh** — starts the server in the background (if not already
  running) and opens the web UI in the default browser.
- **stop-server.sh** — shuts the server down. Safe to double-click even if
  it's already stopped.

Double-clicking either in Finder opens a small Terminal window that runs the
script and shows what happened, then waits for you to press Enter to close
it — no commands to type, just double-click and read the result.

Setup, done once by whoever installs Node:

1. Clone/copy the project anywhere on the target Mac, then `npm install` in
   it. These scripts find their own location automatically, so there's no
   fixed path they need to live at.
2. Set up `.env` as above (step 4).
3. Optionally alias/drag `start-server.sh` and `stop-server.sh` to the
   Desktop or Dock for easy access.

If **start-server.sh** fails, it prints a plain explanation in the Terminal
window (Node not found, or the server didn't start in time — check
`server.log` in the project folder for details in the last case).

## Using the web UI

1. **Choose a folder** — browse Dropbox subfolders, then click **Load
   images in this folder**.
2. **Select images to process** — every image in that folder *and all of its
   subfolders* without a matching `-nobackground` version shows up as a
   thumbnail (images from a subfolder are labeled `subfolder/name.jpg` so
   same-named files in different subfolders aren't ambiguous). Click a
   thumbnail to select/deselect it (the whole tile is the click target, not
   a small checkbox — this avoids the tile becoming unclickable when a
   browser extension like Pinterest's save-button overlay sits on top of a
   corner checkbox).
3. Pick a provider from the dropdown (only providers with a key configured
   in `.env` are selectable) and click **Run**.
4. **Progress** shows a live log as each selected image is downloaded,
   processed, and uploaded back.
5. **Processed images** shows a thumbnail of every `-nobackground` file in
   the folder — both ones already there before this session and new ones as
   they finish, updating live during a run. Click a thumbnail here to open
   the full-size file locally in Preview (requires the Dropbox desktop app
   installed and that file already synced — reads straight off disk via
   Dropbox's local sync folder, not the API).

Re-loading a folder (or picking a different one) refreshes both the picker
and the processed gallery from what's actually in Dropbox right now.

## How it decides what to process

- Any image with a supported extension (`.jpg`, `.jpeg`, `.png`, `.webp`)
  anywhere under the chosen folder (subfolders included, scanned
  recursively) that doesn't already have a matching `-nobackground` file is
  offered in the picker. There's no required naming convention for source
  files.
- The output name is `<name-without-extension>-nobackground.<ext>`, keeping
  the original extension (e.g. `product.jpg` -> `product-nobackground.jpg`)
  and landing in the same subfolder as its source. The removed background is
  always filled with solid white, regardless of provider.
- A file that already looks like an output (ends in `-nobackground.<ext>`)
  is never itself offered as something to process.
