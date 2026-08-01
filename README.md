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

`DROPBOX_FOLDER` is the Dropbox path to scan (must start with `/`). Change it
per machine/environment as needed — this is how test vs. production folders
are kept separate.

`.env` is gitignored and never committed.

### 4. Run

```bash
npm start
```

First run downloads the segmentation model (~80MB, one-time, cached
afterward), so it'll be noticeably slower than later runs.

## How it decides what to process

- A file is a **source image** if its name matches `*-r.*` (e.g. `product-r.jpg`).
- Its expected output is `<name-without-extension>-nobackground.<ext>`,
  keeping the original extension (e.g. `product-r-nobackground.jpg`). The
  removed background is filled with solid white.
- Supported extensions: `.jpg`, `.jpeg`, `.png`, `.webp`. Anything else is
  skipped with a warning.
- If that output file already exists in the folder, the source is skipped.
