# PDFDock — Free PDF Editor (100% client-side)

A complete, professional PDF editor that runs entirely in your
visitor's browser. Add text, draw signatures, white-out content,
highlight, draw shapes, stamp images, fill AcroForm fields, rotate/
delete/add pages, and export — vector or rasterized. **No uploads, no
server, no sign-up, no paid API or service anywhere.**

Built with Next.js 16 (static export), Tailwind CSS 4, pdf-lib,
pdf.js v6 (workers vendored locally — no CDN), TypeScript, zustand.
Design language: Discovery Blue (matches the FreeSeak family).

---

## 1. What's inside

| Layer | Where |
| --- | --- |
| PDF engine (open, render, export, rasterize) | `src/lib/editor/engine.ts` |
| Coordinate math (rotation-safe display ⇄ PDF space) | `src/lib/editor/geometry.ts` |
| Editor state (objects, pages, undo/redo, tools) | `src/lib/editor/store.ts` |
| Annotation model | `src/lib/editor/types.ts` |
| Font model (12 standard PDF fonts, zero-byte embedding) | `src/lib/editor/fonts.ts` |
| Sample document generator | `src/lib/editor/sample.ts` |
| The editor UI (workspace, dialogs, rail, properties) | `src/components/editor/` |
| Site config — **the one file you edit** | `src/lib/site.ts` |
| GitHub Pages deploy workflow | `.github/workflows/deploy-pages.yml` |
| Vendored pdf.js workers | `public/pdf.worker.min.mjs`, `public/pdf.renderer.min.mjs` |

### Features

- **Add text** — click the page, type. Helvetica / Times / Courier in
  all four styles, any size and colour. Exported as real, selectable,
  searchable PDF text (not screenshots).
- **Signature pad** — draw with mouse/pen/finger; trimmed and placed
  with a transparent background; movable and resizable.
- **White-out** — cover anything, then type over it. Rasterize on
  export for true redaction.
- **Highlight, rectangle, ellipse, line, pen** — full shape set with
  colour, stroke width, opacity and fill control.
- **Images & stamps** — PNG/JPG anywhere on the page.
- **Fill forms** — real AcroForm text fields, checkboxes, dropdowns and
  radio groups; optional flattening on save.
- **Fix pages** — rotate (content rotates with the page), delete, add
  blank pages.
- **Undo/redo** — unlimited (Ctrl+Z / Ctrl+Shift+Z), plus Delete key,
  arrow-key nudging, Ctrl+D duplicate, Esc to deselect.
- **Honest failures** — password-protected and corrupt PDFs get a clear
  message, never a blank screen.

### Two honest limits (stated on the site too)

- Editing existing paragraph text is cover-and-replace (white-out +
  retype) — the same approach desktop editors use; in-place reflow
  rewrite is not feasible in the browser.
- Password-protected PDFs cannot be decrypted client-side.

---

## 2. Run it locally (optional)

```bash
npm install
npm run dev        # http://localhost:3000
```

Requirements: Node 20+.

---

## 3. Deploy: GitHub Pages only (zero cost, ~5 minutes)

This project is a **static site** (`next build` produces plain HTML/
CSS/JS in `out/`) — it needs no server, so GitHub Pages' free tier on
a public repo is all you need. **No Cloudflare, no paid service, and
every future commit redeploys automatically.**

> GitHub Pages serves a *project* site under a sub-path:
> `https://<your-username>.github.io/<repo-name>/`. The included
> workflow builds with that sub-path baked in, so **name the repo
> exactly `pdfdock`** (or edit one line — see Step 5).

### Step 1 — create the GitHub repository

1. Go to **github.com → New repository**.
2. Name it **exactly `pdfdock`**, leave it **Public** (Pages is free
   on public repos), **Create**.
3. On the empty repo page click **"uploading an existing file"**
   (the link at the top of the empty-repo area).
4. Unzip `pdfdock-v1.1.0.zip` on your computer, open the folder,
   **select ALL contents** (including dotfiles like `.gitignore` and
   dotfolders like `.github` — enable "show hidden files" in your
   file manager).
5. Drag everything onto the GitHub upload area, wait for the list to
   fill, then **Commit changes**.
6. Verify the repo root lists `.github`, `.gitignore`,
   `package.json`, `public/`, `src/`. If your file manager skipped
   dotfolders, upload `.github/` and `.gitignore` again — they carry
   the deploy workflow.

### Step 2 — turn GitHub Pages on (one setting, once)

1. In the repo: **Settings → Pages**.
2. Under **Build and deployment → Source**, pick
   **"GitHub Actions"** (not "Deploy from a branch").
3. Nothing else to configure — the included
   `.github/workflows/deploy-pages.yml` does the build and deploy.

### Step 3 — watch the first deploy

1. The upload commit already triggered the workflow — open the
   **Actions** tab and watch **Deploy to GitHub Pages** run
   (checkout → install → lint → build → deploy, ~2 minutes).
2. When the green check appears, your site is live at
   `https://<your-username>.github.io/pdfdock/` — also shown in
   Settings → Pages and on the repo's right sidebar.
3. Open it, drop a PDF, and edit.

Every future push to `main` redeploys automatically. Lint runs first,
so a broken commit never deploys.

### Step 4 — set your real address (the ONE config to change)

Open **`src/lib/site.ts`** and set:

```ts
export const SITE_URL = "https://<your-username>.github.io/pdfdock";
```

Also update the sitemap line in **`public/robots.txt`** to the same
address (plain text, cannot import the constant). Commit — done.
Sitemap, canonical URLs and Open Graph all derive from it.

> Tip: link it from your main site — e.g. an "Edit PDF" card on
> freeseak.com pointing at your `github.io/pdfdock` address.

### Step 5 — used a different repo name? (one-line edit)

The workflow builds with `NEXT_PUBLIC_BASE_PATH: /pdfdock` to match
the repo name. If your repo is named differently (e.g. `pdf-editor`),
open `.github/workflows/deploy-pages.yml` and change that single
value to `/pdf-editor`. Deploying to the `<your-username>.github.io`
root repo or a custom domain instead? Delete the
`NEXT_PUBLIC_BASE_PATH` line entirely — the site then builds for `/`
(no sub-path). The pdf.js worker URLs follow the same variable
automatically, so no other file ever needs touching.

---

## 4. Alternative deploys (not needed for GitHub Pages)

The static export in `out/` runs anywhere static hosting exists:

- **Cloudflare Pages** — connect the repo, build command
  `npm run build`, output `out`, `NODE_VERSION` = `22`.
- **Cloudflare Workers assets** — locally:
  `npm install && npm run build && npx wrangler deploy`
  (uses the included `wrangler.jsonc`, which serves `./out`).

Both still work unchanged: without `NEXT_PUBLIC_BASE_PATH` set, the
build targets `/` (root) exactly like v1.0.0.

---

## 5. Updating later (drag-and-drop, no CLI)

1. Unzip the new version, select all contents, drag into the GitHub
   repo page (*Add file → Upload files*), **Commit**.
2. The workflow rebuilds and redeploys automatically — about 2
   minutes later the update is live on your `github.io` address.

---

## 6. Quality rules in this repo

- **Everything client-side.** No uploads, no API calls, no analytics,
  no CDN at runtime (pdf.js workers are local static files).
- **Unused code fails CI** (`no-unused-vars` is an error, enforced on
  every push).
- **Version + changelog:** every update bumps `version` in
  `package.json` and adds a line in `CHANGELOG.md`.

## 7. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Workflow fails on "next: not found" | Should not happen (Node 22 is pinned) — re-check `.github/workflows/deploy-pages.yml` is in the repo. |
| Site loads but looks unstyled, or the editor spins forever on open | Sub-path mismatch: the repo name and `NEXT_PUBLIC_BASE_PATH` in `deploy-pages.yml` must match exactly (`/pdfdock` ↔ repo `pdfdock`). |
| Pages tab shows no deploy / "404" at the URL | Settings → Pages → Source must be **GitHub Actions**; then re-run the workflow from the Actions tab. |
| Editor opens but pages don't render | The two `public/pdf.*.mjs` files are missing from the repo — re-upload the whole `public/` folder. |
| Old address still in Google / share links | Check Step 4 — `SITE_URL` in `src/lib/site.ts` + `public/robots.txt`. |
| Custom domain later | Settings → Pages → Custom domain (site then serves at root `/`; delete the `NEXT_PUBLIC_BASE_PATH` line in the workflow). |
