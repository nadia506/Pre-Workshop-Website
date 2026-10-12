# Day Reconstruction

Pre-workshop instrument for the Focus Plant study. Participants reconstruct one or more workdays as a timeline (blocks tagged Deep work / Meeting / Exercise / Social, with an optional note), rate the day overall, answer (the first time) a short background survey, and submit everything with one button. Submissions land in a Google Sheet.

No build step, no framework, no server. Four static files plus one Apps Script.

```
index.html              page markup
styles.css              styles (design tokens at the top of :root; dark mode below)
config.js               ← everything you are likely to change: sheet URL, tags, questions
app.js                  timeline interaction, autosave, submit
apps-script/Code.gs     Google Apps Script that receives submissions and writes the sheet
```

## Run locally

Open `index.html` in a browser. That's it.

In VS Code, the **Live Server** extension (right-click `index.html` → *Open with Live Server*) reloads on save and serves at `http://127.0.0.1:5500/`, which is nicer for testing the sheet submission than `file://`.

Everything a participant types is autosaved to `localStorage` in that browser. To reset while testing: footer → *Clear everything on this device*, or DevTools → Application → Local Storage → delete `focus-daybook-v1`.

## Connect the Google Sheet (≈3 minutes)

1. Create a Google Sheet. **Extensions → Apps Script**.
2. Replace the sample code with `apps-script/Code.gs`. Save.
3. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (not "Anyone with Google account" — that shows participants a login page and nothing is saved)
   - Deploy → authorize (Advanced → Go to … → Allow)
4. Copy the Web app URL (ends in `/exec`) into `SHEET_ENDPOINT` in `config.js`.
5. Open that URL in a browser: you should see *Day Reconstruction endpoint is running.*
6. Submit a test day from the page with the name `TEST`. A `responses` tab appears in the sheet. Delete the TEST rows before the study.

If you later edit `Code.gs`: **Deploy → Manage deployments → ✎ → Version: New version → Deploy.** Saving alone does not update the live endpoint. The URL stays the same.

Optional: set the same random string in `TOKEN` (Code.gs) and `SHEET_TOKEN` (config.js) so stray posts to the URL are rejected.

## Deploy the page

Any static host works. GitHub Pages is the least effort:

1. Push this folder to a GitHub repo (public, or private on a paid plan).
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
3. The page is at `https://<user>.github.io/<repo>/` within a minute or two.

Participants identify themselves by name (no accounts). Map names to participant IDs in the sheet before analysis. A link like `https://…/index.html?name=Jane%20Doe` prefills the name; participants can still edit it.

## What's in the sheet

One tab, `responses`, one row per submission:

| column | what |
|---|---|
| `submitted` | when the row arrived |
| `name`, `day` | who, which day (a re-submission adds a new row; the latest row per name + day is current) |
| `timeline` | one line per block: `09:00–10:00  Meeting — Weekly lab meeting` |
| `wellbeing`, `productivity`, `focus` | the day ratings (0–10) |
| `tasks`, `environment`, `devices`, `strategies`, `distractions` | the background survey (sent with every submission) |
| `json` | the complete payload, including blocks as structured data (start/end minutes, tag, note) for analysis |

Columns are added automatically if you change the questions.

## Changing the questions

All in `config.js`:

- `BACKGROUND` — the "About your work" survey, answered once per participant and sent with every submission. All questions required. Two more from the protocol are included commented out.
- `DEFAULT_TAGS` — the four activity tags; every block needs one. Participants can rename, add and delete tags themselves. `HUES` sets each tag's colour.
- `DAY_SCALES` — the "Your day overall" ratings. These are required to submit a day.
- `REFLECTION` — optional "Looking back" questions shown after the ratings. Empty by default, which hides the panel.

Question objects take `type: 'text'` (default; optional `placeholder`) or `type: 'scale'` with `min`, `max`, `lo`, `hi` for a button row.

Participant-facing copy (the line under the title, hints, button labels) is in `index.html` and the inspector hint list in `app.js` (`renderInspector`).

## How the page behaves

- One Submit sends the current day (timeline, ratings) together with the background answers. With `SHEET_ENDPOINT` set, it posts JSON to the sheet and the day is marked *Submitted* only when the script answers `{ok:true}`. On failure nothing is lost: the data stays on the device and the participant can download or copy it to email instead.
- With `SHEET_ENDPOINT` empty, submit downloads the JSON file instead (useful for local testing).
- The background panel collapses once all its questions are answered; it reopens on click, and edits count as edits to the current day.
- A new block shows the four tags inside it; tapping one colours the block, then an optional note can be typed in place. Submit requires every block to have a tag.
- Blocks snap to 15 minutes and never overlap. On touch, tap a block to select it, then drag; on desktop, drag directly. Arrow keys move a focused block; Shift+Arrow resizes it.
