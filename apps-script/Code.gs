/**
 * Day Reconstruction → Google Sheet endpoint
 *
 * SETUP (about 3 minutes)
 * 1. Open the Google Sheet named in SHEET_ID below. Extensions → Apps Script.
 * 2. Delete the sample code, paste this whole file, press Save (disk icon).
 * 3. Deploy → New deployment → gear icon → Web app.
 *      Execute as: Me
 *      Who has access: Anyone          ← must be "Anyone", not "Anyone with Google account",
 *                                         or participants get a login page and nothing is saved.
 *    Deploy → Authorize access (choose your account → Advanced → Go to … → Allow).
 * 4. Copy the Web app URL (ends in /exec) into SHEET_ENDPOINT in config.js.
 * 5. Test: open the URL in a browser — you should see "Day Reconstruction endpoint is running."
 *
 * CHANGING THIS CODE LATER
 *   Deploy → Manage deployments → pencil icon → Version: "New version" → Deploy.
 *   The URL stays the same. (Just pressing Save does not update the live endpoint.)
 *
 * WHAT GETS WRITTEN — one tab, "responses", one row per submit (created automatically):
 *   submitted | name | day | timeline | wellbeing | productivity | focus |
 *   tasks | environment | devices | strategies | distractions | json
 *   timeline is one line per block ("09:00–10:00  Meeting — note"); json is the complete payload.
 *   Re-submissions add a new row; the latest row per name + day is current.
 */

// The spreadsheet that receives submissions (the long id in its URL). With this set, the script works
// whether it lives inside that sheet (Extensions → Apps Script) or as a standalone script.
const SHEET_ID = '1OayyN-yNKYX0TNXjdSN_pZ2jbIqNcvjEp-7vuA1glk8';
const TOKEN = ''; // optional: set the same value in SHEET_TOKEN in config.js to reject stray posts

function book() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet() {
  return ContentService.createTextOutput('Day Reconstruction endpoint is running.');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (TOKEN && data.token !== TOKEN) return reply({ ok: false, error: 'bad token' });
    const ss = book();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (data.schema === 'day-reconstruction/2') writeDay(ss, data);
      else return reply({ ok: false, error: 'unexpected payload' });
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function writeDay(ss, d) {
  const receivedAt = new Date();
  const blocks = d.blocks || [];
  const ratings = d.ratings || {};
  const background = d.background || {};

  // One readable line per block, e.g. "09:00–10:00  Meeting — Weekly lab meeting"
  const timeline = blocks.map(function (b) {
    return b.start + '–' + b.end + '  ' + (b.tag || 'Untagged') + (b.note ? ' — ' + b.note : '');
  }).join('\n');

  const row = {
    submitted: receivedAt,
    name: d.name || '',
    day: d.date,
    timeline: timeline,
    wellbeing: ratings.wellbeing,
    productivity: ratings.productivity,
    focus: ratings.focus,
  };
  Object.keys(background).forEach(function (k) { row[k] = background[k]; });
  row.json = JSON.stringify(d);

  const sh = sheetNamed(ss, 'responses');
  appendObjects(sh, [row]);
  // keep the timeline cell readable: wrap text, align to top
  const last = sh.getLastRow();
  sh.getRange(last, 1, 1, sh.getLastColumn()).setVerticalAlignment('top');
  const tlCol = headerIndex(sh, 'timeline');
  if (tlCol) sh.getRange(last, tlCol).setWrap(true);
}

function headerIndex(sh, name) {
  const headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  const i = headers.indexOf(name);
  return i < 0 ? 0 : i + 1;
}

function sheetNamed(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.setFrozenRows(1); }
  return sh;
}

// Reads the header row, adds any missing columns, and appends rows in header order.
function appendObjects(sh, objs) {
  if (!objs.length) return;
  let headers = sh.getLastRow() >= 1 ? sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].filter(String) : [];
  const wanted = [];
  objs.forEach(function (o) { Object.keys(o).forEach(function (k) { if (headers.indexOf(k) < 0 && wanted.indexOf(k) < 0) wanted.push(k); }); });
  if (wanted.length) {
    headers = headers.concat(wanted);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  const rows = objs.map(function (o) { return headers.map(function (h) { const v = o[h]; return v === undefined || v === null ? '' : v; }); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}
