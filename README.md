# Handoff: Location Book — film art-department location planner

## Overview
**Location Book** is a working tool for a film **art director**. The user imports a **shooting
schedule exported as PDF from Fuzzlecheck**, and the app automatically extracts every scene and
groups them into **locations**. For each location the art director records the **adjustments** they
need to make to the set (paint walls, remove furniture, swap lamps, drill for curtain rails, etc.),
the **prep & wrap** time, the shoot days, address, and a set of **reference images** (photos,
sketches, measurements, designs, moodboard) — which can be drawn on / annotated (iPad + Apple
Pencil friendly). Finally the user **exports a PDF deck per location** (or batch-exports several at
once) in 16:10 laptop format.

The single most important thing this product must nail: **it has to be crystal-clear what needs to
be adjusted per location.** The adjustments feature leads the UI and the export.

## About the Design Files
The files in this bundle are a **fully working design reference built in HTML + React (via in-browser
Babel)** — a high-fidelity functional prototype showing the intended look *and* behavior, including a
real PDF parser. **They are not meant to be shipped as-is.** The task is to **recreate this design in
the target codebase's environment** (e.g. a real React/Vite/Next app, Vue, etc.) using its established
patterns, build pipeline, and component library. If no environment exists yet, pick an appropriate
modern stack (React + Vite + TypeScript is a natural fit here) and implement the design there. Lift the
parser logic and data model almost verbatim (they are framework-agnostic plain JS); rebuild the UI
components idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, interactions and a real working parser are
all here. Recreate the UI faithfully (this document + the files give exact values), but use the
codebase's own primitives (buttons, modals, icons) where it has them.

---

## Tech at a glance (current prototype)
- **React 18** + **in-browser Babel** (`<script type="text/babel">`). In production, replace Babel with
  a real build (Vite/Next) and convert `.jsx` files to modules with proper imports instead of the
  current `window.*` globals pattern.
- **No backend.** All data is local:
  - **Structured state** (locations model, edits, adjustments, gallery item metadata, removed list,
    active id) is JSON in **localStorage** under key `lb_state_v1`/`lb_state_v2` (debounced 250 ms).
  - **Image blobs** are stored in **IndexedDB** (db `lb_images`, store `imgs`) keyed by generated id;
    object URLs are created on demand. The structured state only stores the **image ids**, never the
    blobs.
- **PDF parsing** is done client-side with **pdf-parse 2.4.5** (browser build) — see `app/App.jsx`
  `parsePdfText()`. The text is then run through the schedule parser in `app/parser.js`.
- **PDF export** is done by rendering fixed 1280×800 "deck pages" and using the browser's native
  **print to PDF** (`window.print()`) with `@page { size: 1280px 800px; margin: 0 }`.

> In a real codebase you may swap localStorage/IndexedDB for a proper datastore and the print-based
> export for a server-side or canvas/PDF-lib generator. The *data model* and *parser* are the durable
> parts; keep them.

---

## The Fuzzlecheck parser (most important logic — port verbatim)
File: **`app/parser.js`**. Two pure functions on `window.LB`:

### `parseSchedule(text) → { scenes, days, regions }`
Parses the raw text extracted from a Fuzzlecheck schedule PDF. The format (line-based) looks like:
```
The Camino                         ← schedule title (first non-empty line)
Shooting Schedule 260518
SHOOT START
Mon 31/08/2026 - Pages: 5 4/8       ← day header (weekday date - Day #N / Pages / "Day Off")
	Extras: 1
Croatia - Summer                    ← region/season banner ("<Region> - <Season>")
1.79 EXT/DAY Y/ Farm Milan/ yard 1 2b, 3b, 8, 9, 10   ← scene line
summer 01 - 1987 The friends say goodbye... pgs        ← synopsis line (may be glued to scene line)
```
Per **scene** it extracts: `number` (e.g. `1.79`), `type` (INT/EXT/I+E), `tod` (DAY/NIGHT/…),
`country` (single-letter code), `setPath` + `segments` (the set path split on `/`, e.g.
`Farm Milan / yard`), `location` (first segment), `pageLength`, `cast`, `extras`, `dayNumber`,
`date`, `region`, and from the synopsis line: `season`, `storyNum`, `year`, `synopsis`.
Edge cases handled: synopsis glued onto the scene line, missing country code, "Day Off" days,
production-note continuation lines.

### `buildModel(parsed) → { locations, days, regions, sceneTotal }`
Groups scenes into locations and **auto-merges typo/label duplicates** while keeping genuinely
different sets apart. Key steps:
- `keyOf(name)` normalizes: strip parentheticals, curly→straight quotes, `poss. Croatia`, `?`,
  collapse whitespace, lowercase, **de-duplicate immediately-repeated words** (`Saugues Saugues` →
  `saugues`).
- Locations sorted by scene count; each new key is merged into an existing accepted location if it is
  a **prefix** of it (dropping trailing words) or within **Levenshtein distance ≤ 2** (for keys ≥ 8
  chars) — this collapses `Le Puy-en-Velay` / `Le puy-En-Valay`, `Monistrol` / `Minostrol`, etc.
- Each location object: `{ id, name, regions[], sets[], dayNums[], shootDates[{dayNumber,date,weekday}],
  sceneCount, scenes[] }`. `sets` = the set names within the location (segments after the first), i.e.
  the **"locations within the location"** (living room, garden, kitchen…).

This conservative auto-merge intentionally leaves some sub-locations separate; the user can finish the
job manually (rename / combine — see Interactions).

---

## Data model

### Location (derived from schedule — read-only base)
```
{ id, name, regions: string[], sets: string[], dayNums: number[],
  shootDates: { dayNumber, date "DD/MM/YYYY", weekday }[], sceneCount, scenes: Scene[] }
```

### Edit (per-location user data — keyed by location id in `state.edits`)
```
{
  name?: string,                 // user rename override (display name = edit.name || loc.name)
  address: string,
  access: string,                // parking / load-in notes
  prepDays: number,
  wrapDays: number,
  cover: imgId | null,           // cover photo (IndexedDB id)
  adjustments: Adjustment[],
  galleries: { photos: Img[], sketches: Img[], measurements: Img[], designs: Img[], moodboard: Img[] },
  notes: string
}
```

### Adjustment (the core feature)
```
{ id, cat: 'paint'|'remove'|'dress'|'build'|'electric'|'repair'|'other',
  text: string, area: string,   // area = room/zone, e.g. "Living room", "Garden"
  done: boolean, measure: string, thumb: imgId | null }
```
Adjustments are grouped by `area` in the UI and the export.

### Gallery image item
```
{ id: imgId,                     // original image (IndexedDB)
  cap: string,                   // short caption
  note: string,                  // free note shown next to the picture
  strokes: Stroke[],             // vector annotation strokes (normalized 0..1 coords)
  annotatedId?: imgId }          // flattened image with drawing baked in (used for display/export)
Stroke = { color: string, w: number (fraction of width), pts: [x,y][] (0..1) }
```
Display/export uses `annotatedId || id` (helper `shownId(item)`).

### App state
```
{ model, edits: {[locId]: Edit}, removed: locId[], activeId, scheduleName }
```

---

## Screens / Views

### 1. App shell
- **Layout:** CSS grid, `grid-template-columns: 312px 1fr`, full viewport height, `overflow: hidden`.
  Left = Sidebar, right = scrolling main area.
- Warm "paper & ink" aesthetic. Theme is switchable (see Design Tokens → Themes).

### 2. Sidebar (`app/Sidebar.jsx`)
- **Header:** brand "● Locations" (serif), schedule name with film icon.
- **View tabs:** segmented "Overview / List" toggle (accent fill on active).
- **Search:** filters locations by name or scene synopsis.
- **Location list:** grouped by region (schedule order) or sorted by scene count / A–Z (Tweak).
  Each row: 38×38 **cover thumbnail** (or placeholder), name, scene count, "N adj · M days", and a
  thin progress bar (adjustments done / total).
- **Hidden section:** removed locations collapse here with a **Restore** button.
- **Footer:** "Export decks…" (primary) and "Import schedule".

### 3. Visual Overview board (`app/Board.jsx`) — default view
- **Header:** kicker "<schedule> · visual overview", H1 "All locations", count "N locations · M with a
  cover photo", and "Export…" primary button.
- **Per region:** a section header (region name + count + rule) then a **card grid**
  (`repeat(auto-fill, minmax(244px, 1fr))`, gap 18px).
- **Location card** (`.loc-card`, radius 14, 1px border, soft shadow, lift on hover):
  - **Cover** area, aspect 5/4: cover photo (object-fit: cover) or a hatched "drop a photo"
    placeholder. Drag-drop an image here to set the cover. Badges top-left: "done/total adj" (accent),
    "N 📷". Camera button (appears on hover) to pick a file.
  - **Body:** drag-grip (⠿), location name (serif 17, click to open; click again / menu to rename
    inline), kebab (⋯) menu, meta line "N sc · M days · K photos", adjustment progress bar.
  - **Drag-to-combine:** the whole card is draggable; dropping it onto another card merges them — an
    accent overlay "Combine into '<name>'" appears on the drop target.

### 4. Location file (`app/LocationFile.jsx`) — the working editor
Scrolling document, max-width 980px, centered. Sticky topbar with breadcrumb + "Export…" / "Export
this deck".
- **Cover banner:** full-width 220px drop zone / cover image.
- **Hero:** kicker (region), editable H1 title (contenteditable; rename merges on title collision),
  meta tags (scenes, shoot days, sets, adjustments), and a ⋯ menu (Rename / Cover / **Combine with…** /
  Remove).
- **Address & access** card (two inputs) + **Prep / Wrap** metric steppers (big serif number with −/+).
- **§01 Shoot days:** cards "DAY n / weekday date".
- **§02 Adjustments** (`app/Adjustments.jsx`) — *the priority section*:
  - Summary bar: change count, area count, and a stacked **category breakdown bar** + done count.
  - **Composer:** category picker (color chips), text input, area input (datalist of known
    areas/sets), Add.
  - Grouped by **area** (room/zone). Each adjustment row: check (done), category chip (editable via
    popover), editable text, measurement input, area input, a 46×46 reference thumbnail (drop/click),
    delete.
- **§03 Scenes here:** read-only table from the schedule, grouped by shoot day (number, INT/EXT·TOD,
  synopsis, set path, season/year). Tweak: "by day" / "flat".
- **§04 Visual references:** four stacked galleries — **Photos, Sketches, Measurements, Designs,
  Moodboard** (5 kinds). Each is a responsive grid (`minmax(150px,1fr)`) of image cells + a dropzone.
  Each cell: image, caption overlay, a **note** textarea beneath, a **Draw** (pen) button, remove.
- **§05 Notes:** free textarea.

### 5. Annotator (`app/Annotator.jsx`) — draw on a photo (iPad / Apple Pencil)
Full-screen modal. Left = image with a transparent `<canvas>` overlay using **Pointer Events**
(`touch-action: none`) so finger/Pencil drawing works. Right rail: pen color swatches (6), pen sizes
(S/M/L), Undo, Clear, a Note textarea, Cancel / Save. Strokes are stored normalized (0..1); on Save the
drawing is **baked** into a flattened JPEG (`bakeAnnotation`) stored as `annotatedId`.

### 6. Export deck (`app/Deck.jsx`) — 1280×800 (16:10)
Dark stage; pages scaled to fit; "Save PDF" triggers `window.print()`.
- **Cover page** (optional): full-bleed cover photo with gradient + title + stat row, or a typographic
  fallback.
- **Overview page** (always, leads the deck): header (optional cover thumb, region kicker, title,
  address) + a 4-stat block (Scenes / Shoot / Prep / Wrap). Body is **3 columns**:
  1. **Adjustments** — grouped by area, category-color ticks, measurements highlighted.
  2. **Scenes** — grouped by shoot day ("Day n · weekday date"), each line `number  synopsis`
     (single-line, ellipsis).
  3. **Meta** — Areas / sets (chips), Access, Visual references count, Notes.
- **Scene breakdown page** (optional, off by default — the overview already lists scenes): full
  two-column scene table with synopsis + day/year, paginated at 40/page.
- **Appendix pages:** one per non-empty gallery (Photos/Sketches/Measurements/Designs/Moodboard),
  paginated at **4 images/page**. Images are shown **uncropped** (object-fit: contain) on a soft mat
  (`#ece4d2`), caption + note beneath. (Earlier versions cropped to fill — do **not** crop.)

### 7. Modals
- **Import** (`ImportModal` in App.jsx): drag/drop or pick a Fuzzlecheck PDF → parses live → shows a
  summary (N locations · M scenes · K shoot days) → "Use this schedule" (existing edits are kept for
  locations that still exist).
- **Export** (`ExportModal`): "Include in each deck" chips (Cover page / Scene breakdown page / Photos
  / Sketches / Measurements / Designs / Moodboard — Scene breakdown **off** by default), then a list of
  locations grouped by country/region with **checkbox selection per country or per location**, then
  "Export N decks". Builds one combined print document.
- **Combine** (`CombineModal`): "Merge into '<base>'" — search + checkbox list of other locations
  (grouped by region); confirm folds them into the base location.

---

## Interactions & Behavior
- **Import** parses entirely in the browser; replacing the schedule keeps edits for surviving location
  ids and clears `removed`.
- **Rename** (card inline, or location H1 contenteditable): on blur, if the new name matches another
  location's display name (normalized), the two **auto-combine**.
- **Combine** (3 ways): drag a card onto another; ⋯ → "Combine with…"; or rename to an existing name.
  Merge = union of scenes/dayNums/shootDates/regions/sets; adjustments and all galleries concatenated;
  prep/wrap = max; address/access/cover = first non-empty; notes joined. The drop **target** is the
  keeper. Always show a **toast with Undo** (snapshot the previous state).
- **Remove** location → moves id into `removed[]`, toast with Undo, restorable from sidebar "Hidden".
- **Cover / gallery images:** drag-drop or file pick → stored in IndexedDB, id saved in state.
- **Annotation:** pointer-events drawing; Save bakes a flattened image; the badge (pen icon) marks
  annotated items.
- **Export → print:** the deck view sets `@page` size and uses `window.print()`; the user picks
  landscape, margins "None".
- **Persistence:** every state change is debounced-saved to localStorage; image object URLs are cached
  per session.
- **Touch:** annotator canvas uses `touch-action: none`; hit targets are comfortable. The app is used
  on **laptop and iPad**.

## State Management
Single `state` object in the root `App` component (`useState`), persisted to localStorage (debounced).
Derived: `visibleLocs` (model minus removed), `activeLoc`, `edit`. Mutations: `patchById`,
`renameLoc` (with auto-merge), `mergeLocations`, `removeLoc`/`restoreLoc`, `applyImport`. Transient UI
state: `view` (board/file), modal flags (`showImport`, `showExport`, `combineBase`), `deck`
(`{entries, opts}`), `toast` (`{msg, undo}`). Tweaks (theme/accent/navSort/sceneView/deckCover) come
from a small `useTweaks` hook persisted separately.

## Design Tokens

### Colors — "paper" theme (default)
```
--paper  #f1ece1   app background
--card   #faf7f0   panels / cards
--card-2 #f5f1e8   insets
--ink    #211c15   primary text
--ink-2  #6f6859   muted text
--ink-3  #a59c89   faint
--line   #ddd5c4   hairlines
--line-2 #cabfa8   stronger rule
--accent #9e3b2e   oxblood (primary action / category "paint")
--accent-soft #f0ddd6
--good   #4f6f3f
--warn   #b07a1e
```
### Themes (switchable via Tweaks; `data-theme` on `<html>`)
- **blueprint:** cool greys/blues, `--accent #1f5fa6`.
- **studio:** near-black (`--paper #16140f`, `--card #211e17`), `--accent #d98b5f`.
- **Accent options:** `#9e3b2e` (default), `#4f6f3f`, `#2f5d8c`, `#9a6a17`, `#7a4a5e`.

### Adjustment category colors (OKLCH)
```
paint    oklch(0.62 0.12 40)    remove   oklch(0.56 0.04 250)
dress    oklch(0.56 0.09 150)   build    oklch(0.64 0.10 70)
electric oklch(0.58 0.10 245)   repair   oklch(0.55 0.08 330)
other    oklch(0.60 0.02 90)
```

### Typography
- **Serif** (display/headings): **Spectral** (Google) — weights 400/500/600, italic 500.
- **UI / sans:** **Archivo** (Google) — 400/500/600/700.
- **Mono** (labels, technical data, scene numbers): **IBM Plex Mono** — 400/500/600.
- Base body 14px / line-height 1.45. Kicker labels: mono ~10.5px, letter-spacing .14em, uppercase.
- Deck title up to 58px (overview) / 104px (cover), scaled down for long names.
- **Minimum sizes:** deck/export body never below ~11px at 1280×800; app body 12–14px.

### Spacing / radius / shadow
- Card radius **12–14px**; inputs/buttons **7–9px**; pills/chips **14–20px**.
- Card shadow: `0 1px 2px rgba(40,32,18,.05), 0 8px 28px rgba(40,32,18,.07)`; hover lift adds a larger
  soft shadow + `translateY(-2px)`.
- Section gaps ~30px; card grids gap 14–18px.
- Hit targets ≥ ~28px; primary buttons 7px×13px padding.

### Deck (export) palette — independent of app theme, always light "document"
```
page bg #f7f3ea, ink #221d15, --dk-line #d9d0bd, --dk-line2 #c3b7a0,
--dk-ink2 #6d6657, --dk-ink3 #a59c89, --dk-card #fffdf8, --dk-accent #9e3b2e,
appendix image mat #ece4d2
```

## Assets
- **Fonts:** Spectral, Archivo, IBM Plex Mono (Google Fonts). Use the codebase's font-loading approach.
- **Icons:** a small custom inline-SVG set (`Icon` in `app/components.jsx`, 18×18 viewBox, currentColor
  stroke). Replace with the codebase's icon library; names used: search, plus, check, trash, image,
  upload, download, x, chevron(/D), cal, pin, ruler, layers, film, edit, dots, grid, list, arrow,
  reset, sliders, page, grip.
- **No raster brand assets.** The only images are user-uploaded photos.
- **Sample data:** `sample-fuzzlecheck-schedule.pdf` (the "The Camino" schedule) is included for
  testing the parser. `app/seed.js` is the pre-parsed model used as the demo's initial state.
- **Emoji:** a single 📷 on card badges — optional, drop if undesired.

## Files (in this bundle)
- `Location Book.html` — entry point; loads fonts, styles, scripts, mounts `<LB_App/>`.
- `app/parser.js` — **Fuzzlecheck parser + location model builder** (plain JS; port verbatim).
- `app/seed.js` — pre-parsed demo model (`window.LB_SEED`).
- `app/db.js` — IndexedDB image store + localStorage state helpers.
- `app/components.jsx` — shared atoms: `Icon`, `IconBtn`, `Stepper`, `Img` (async IndexedDB image),
  `Menu` (portaled popover), `CoverDrop`, `useDrop`, `filesToIds`, `locName`, constants (`CATS`).
- `app/Adjustments.jsx` — adjustments composer + grouped list (the priority feature).
- `app/Sidebar.jsx` — sidebar nav (overview/list, search, hidden/restore).
- `app/Board.jsx` — visual overview board + draggable location cards (drag-to-combine).
- `app/LocationFile.jsx` — location editor (cover, meta, scenes, galleries, notes).
- `app/Annotator.jsx` — pointer-events drawing/annotation + bake-to-image.
- `app/Deck.jsx` — 1280×800 export deck (cover / overview / scene breakdown / appendix) + print.
- `app/App.jsx` — root: state, persistence, import/export/combine modals, routing.
- `app/styles.css`, `app/styles-2.css` — all styling + theme tokens.
- `app/tweaks-panel.jsx` — the in-prototype "Tweaks" panel (prototype-only; not needed in production).
- `sample-fuzzlecheck-schedule.pdf` — sample import for testing.

### Notes for the implementer
- Keep `parser.js` and the data model intact — they encode hard-won handling of the Fuzzlecheck format
  and the location auto-merge. Everything else can be rebuilt idiomatically.
- The `window.*` global wiring and in-browser Babel are prototype scaffolding — replace with real
  modules/imports and a build step.
- Consider replacing print-to-PDF with a deterministic generator (pdf-lib / server render) if you need
  reliable pagination headless; the current pages are plain DOM at a fixed 1280×800 so they translate
  directly to a canvas or PDF page.
