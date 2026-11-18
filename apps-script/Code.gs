/**
 * WK LV As-Built — Nyanza : synchronisation server (Google Apps Script)
 * (c) 2026 Eng. Wilbert KIRARA, Expert Surveyor in Electrical Power Lines. All rights reserved.
 * ---------------------------------------------------------------------
 * Receives the points + stamped photos from the phones and stores them in:
 *   - this Google Sheet: one tab per layer (Transformers, Poles, Customers),
 *     one row per point, updated in place when the point is edited
 *   - a Drive folder "WK LV As-Built - Nyanza Photos/<Transformer>/"
 *
 * SETUP (once): new Google Sheet > Extensions > Apps Script > paste this file > Save >
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone) > copy the /exec URL
 * > in the app: Export > Automatic sync > Server settings > paste > Test & save.
 * TOKEN must equal SYNC_TOKEN in app.js.
 */
const TOKEN = 'wklvnyz-7Qm2Xc9TfR4pLs8VdK3w';
const SHEET_ID = '1Arle-vNaPLpHZDYff3MTZtBxY37G78dALa9XITsF4T8'; // Google Sheet "WK LV As-Built - Nyanza"
const ROOT_FOLDER = 'WK LV As-Built - Nyanza Photos';
const TABS = ['Transformers', 'Poles', 'Customers'];
const TEXT_COLS = ['Meter_number', 'ID', 'Phone_number', 'UPI', 'HSE No.', 'POLES', 'Pole_Numbe', 'From_Pole'];
const TAIL = ['Photo', 'Photo File ID', 'Received (server)', 'Status'];

function doGet() { return out({ ok: true, app: 'WK LV As-Built Nyanza sync', time: new Date().toISOString() }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: 'unauthorised' });
    if (d.action === 'ping') return out({ ok: true });
    if (d.action === 'delete') return out(markDeleted(d.id));
    if (d.action === 'upsert') return out(upsert(d));
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function book_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

/* the tab of a layer; its header = Record ID + the app's columns + Photo / Status */
function tab_(name, header) {
  const ss = book_();
  let sh = ss.getSheetByName(name);
  const full = ['Record ID'].concat(header).concat(TAIL);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, full.length).setValues([full]).setFontWeight('bold').setBackground('#d9e2f3');
    sh.setFrozenRows(1);
  } else {
    // add any new column the app sends at the end, before nothing is lost
    const cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    full.forEach(function (h) { if (cur.indexOf(h) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold').setBackground('#d9e2f3'); cur.push(h); } });
  }
  return sh;
}

function headers_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}

function folder_(trf) {
  const it = DriveApp.getFoldersByName(ROOT_FOLDER);
  const root = it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER);
  const name = trf || 'No transformer';
  const sub = root.getFoldersByName(name);
  return sub.hasNext() ? sub.next() : root.createFolder(name);
}

function upsert(d) {
  if (!d.id || !d.sheet || !d.header || !d.row) return { ok: false, error: 'missing data' };
  const sh = tab_(d.sheet, d.header);
  const H = headers_(sh);
  let row = findRow_(sh, d.id);
  const rec = { 'Record ID': d.id };
  d.header.forEach(function (h, i) { rec[h] = d.row[i]; });
  if (row) {
    const prev = sh.getRange(row, 1, 1, H.length).getValues()[0];
    rec['Photo'] = prev[H.indexOf('Photo')]; rec['Photo File ID'] = prev[H.indexOf('Photo File ID')];
  }
  if (d.photo) {
    if (rec['Photo File ID']) { try { DriveApp.getFileById(rec['Photo File ID']).setTrashed(true); } catch (e) {} }
    const blob = Utilities.newBlob(Utilities.base64Decode(d.photo), 'image/jpeg', d.photoName || (d.id + '.jpg'));
    const f = folder_(d.trf).createFile(blob);
    rec['Photo File ID'] = f.getId(); rec['Photo'] = f.getUrl();
  }
  rec['Received (server)'] = new Date();
  rec['Status'] = 'OK';
  const values = H.map(function (h) { const v = rec[h]; return v === undefined || v === null ? '' : v; });
  if (!row) { row = sh.getLastRow() + 1; }
  // identifiers stay text (no lost leading zeros, no scientific notation)
  H.forEach(function (h, i) { if (TEXT_COLS.indexOf(h) >= 0) sh.getRange(row, i + 1).setNumberFormat('@'); });
  sh.getRange(row, 1, 1, H.length).setValues([values]);
  return { ok: true, id: d.id, photo: rec['Photo'] || '' };
}

function markDeleted(id) {
  const ss = book_();
  for (const name of TABS) {
    const sh = ss.getSheetByName(name); if (!sh) continue;
    const row = findRow_(sh, id); if (!row) continue;
    const H = headers_(sh);
    sh.getRange(row, H.indexOf('Status') + 1).setValue('DELETED on phone ' + new Date().toISOString());
    sh.getRange(row, 1, 1, H.length).setFontColor('#9ca3af');
    return { ok: true, id: id };
  }
  return { ok: true, id: id, note: 'not found' };
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
