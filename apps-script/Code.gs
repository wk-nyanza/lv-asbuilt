/**
 * WK LV As-Built — Nyanza : synchronisation server (Google Apps Script)
 * (c) 2026 Eng. Wilbert KIRARA, Expert Surveyor in Electrical Power Lines. All rights reserved.
 * ---------------------------------------------------------------------------
 * Receives the points + stamped photos from the phones and stores them in:
 *   - this Google Sheet: one tab per layer (Transformers, Poles, Customers),
 *     one row per point, updated in place when the point is edited
 *   - Google Drive, one folder per transformer, same layout as the design packages:
 *       WK LV As-Built - Nyanza/<Sector>/<Transformer>/
 *           Information Data/   Excel (RESERVE) + CSV tables, updated by the phones
 *           KMZ/                Google Earth file
 *           Shapefile/          Transformer, Poles, LV_Network, Customers, Service_Cable (TM Rwanda)
 *           Photos/Transformer, Photos/Poles, Photos/Customers
 *           Map PDF/, MXD/      for the office
 *           Backup/             phone backup (.wklv.json) of this transformer
 *
 * SETUP (once): Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 * > copy the /exec URL > in the app: Export > Automatic sync > Server settings.
 * TOKEN must equal SYNC_TOKEN in app.js.
 */
const TOKEN = 'wklvnyz-7Qm2Xc9TfR4pLs8VdK3w';
const SHEET_ID = '1Arle-vNaPLpHZDYff3MTZtBxY37G78dALa9XITsF4T8'; // Google Sheet "WK LV As-Built - Nyanza"
const ROOT_FOLDER = 'WK LV As-Built - Nyanza';
const OLD_ROOT = 'WK LV As-Built - Nyanza Photos';          // first version: photos only
const TABS = ['Transformers', 'Poles', 'Customers'];
const PHOTO_SUB = { Transformers: 'Photos/Transformer', Poles: 'Photos/Poles', Customers: 'Photos/Customers' };
const SUBFOLDERS = ['Information Data', 'KMZ', 'Shapefile', 'Photos/Transformer', 'Photos/Poles', 'Photos/Customers', 'Map PDF', 'MXD', 'Backup'];
const TEXT_COLS = ['Meter_number', 'ID', 'Phone_number', 'UPI', 'HSE No.', 'POLES', 'Pole_Numbe', 'From_Pole'];
const TAIL = ['Photo', 'Photo File ID', 'Received (server)', 'Status'];

function doGet() { return out({ ok: true, app: 'WK LV As-Built Nyanza sync', version: 6, time: new Date().toISOString() }); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad request' }); }
  if (d.token !== TOKEN) return out({ ok: false, error: 'unauthorised' });
  if (d.action === 'ping') return out({ ok: true, version: 6 });
  if (d.action === 'pull') { try { return out(pull(d.agent)); } catch (err) { return out({ ok: false, error: String(err) }); } }   // read only: no lock
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) return out({ ok: false, error: 'server busy, retry' });
  try {
    if (d.action === 'delete') return out(markDeleted(d.id));
    if (d.action === 'upsert') return out(upsert(d));
    if (d.action === 'files') return out(saveFiles(d));
    if (d.action === 'folders') return out(makeFolders(d.trfs || []));
    if (d.action === 'migrate') return out(migrate());
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function book_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

/* ---------- Drive folders (ids cached in the script properties) ---------- */
function child_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function cached_(key, make) {
  const P = PropertiesService.getScriptProperties();
  const id = P.getProperty(key);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const f = make(); P.setProperty(key, f.getId()); return f;
}
function root_() {
  return cached_('root', function () { const it = DriveApp.getFoldersByName(ROOT_FOLDER); return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_FOLDER); });
}
function clean_(s) { return String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim(); }
/* folder of a transformer, under its sector; the whole package layout is created the first time */
function trfFolder_(trf, sector) {
  const name = clean_(trf) || 'No transformer';
  return cached_('trf:' + name, function () {
    const sec = clean_(sector) || 'Other';
    const f = child_(child_(root_(), sec), name);
    SUBFOLDERS.forEach(function (p) { sub_(f, name, p); });
    return f;
  });
}
function sub_(trfFolder, trfName, path) {
  return cached_('sub:' + trfName + '|' + path, function () {
    let f = trfFolder; path.split('/').forEach(function (n) { f = child_(f, n); }); return f;
  });
}
function folderFor_(trf, sector, path) { const f = trfFolder_(trf, sector); return sub_(f, clean_(trf) || 'No transformer', path); }

function makeFolders(trfs) {
  const done = [];
  trfs.forEach(function (t) { if (t && t.n) { trfFolder_(t.n, t.s); done.push(t.n); } });
  return { ok: true, folders: done.length, root: root_().getUrl() };
}

/* ---------- sheet ---------- */
function tab_(name, header) {
  const ss = book_();
  let sh = ss.getSheetByName(name);
  const full = ['Record ID'].concat(header).concat(TAIL);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, full.length).setValues([full]).setFontWeight('bold').setBackground('#d9e2f3');
    sh.setFrozenRows(1);
  } else {
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
    const f = folderFor_(d.trf, d.sector || rec['Sector'], PHOTO_SUB[d.sheet] || 'Photos').createFile(blob);
    rec['Photo File ID'] = f.getId(); rec['Photo'] = f.getUrl();
  }
  rec['Received (server)'] = new Date();
  rec['Status'] = 'OK';
  const values = H.map(function (h) { const v = rec[h]; return v === undefined || v === null ? '' : v; });
  if (!row) { row = sh.getLastRow() + 1; }
  H.forEach(function (h, i) { if (TEXT_COLS.indexOf(h) >= 0) sh.getRange(row, i + 1).setNumberFormat('@'); });
  sh.getRange(row, 1, 1, H.length).setValues([values]);
  return { ok: true, id: d.id, photo: rec['Photo'] || '' };
}

/* data files of one transformer (KMZ, shapefiles, Excel, CSV, backup): the newest replaces the previous one */
function saveFiles(d) {
  if (!d.trf || !d.files) return { ok: false, error: 'missing data' };
  let n = 0;
  d.files.forEach(function (x) {
    const folder = folderFor_(d.trf, d.sector, x.folder || 'Information Data');
    const old = folder.getFilesByName(x.name);
    while (old.hasNext()) old.next().setTrashed(true);
    const bytes = x.b64 != null ? Utilities.base64Decode(x.b64) : Utilities.newBlob(x.text || '').getBytes();
    folder.createFile(Utilities.newBlob(bytes, x.mime || 'application/octet-stream', x.name)); n++;
  });
  return { ok: true, files: n, folder: trfFolder_(d.trf, d.sector).getUrl() };
}

/* moves the photos of the first version (one flat folder per transformer) into the new layout */
function migrate() {
  const ss = book_(); let moved = 0;
  TABS.forEach(function (name) {
    const sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    const H = headers_(sh), iF = H.indexOf('Photo File ID'), iT = H.indexOf('TRF_Name'), iS = H.indexOf('Sector'), iSt = H.indexOf('Status');
    const V = sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues();
    V.forEach(function (r) {
      const id = r[iF]; if (!id) return;
      if (iSt >= 0 && String(r[iSt]).indexOf('DELETED') === 0) return;
      try { const f = DriveApp.getFileById(id); if (f.isTrashed()) return; f.moveTo(folderFor_(r[iT], r[iS], PHOTO_SUB[name])); moved++; } catch (e) {}
    });
  });
  // the old folders are trashed only when nothing is left in them
  let trashed = 0;
  const it = DriveApp.getFoldersByName(OLD_ROOT);
  while (it.hasNext()) {
    const o = it.next(); let empty = !o.getFiles().hasNext();
    const subs = o.getFolders();
    while (subs.hasNext()) { const s = subs.next(); if (s.getFiles().hasNext() || s.getFolders().hasNext()) empty = false; }
    if (empty) { o.setTrashed(true); trashed++; }
  }
  return { ok: true, moved: moved, oldFoldersTrashed: trashed, root: root_().getUrl() };
}

/* same person even with a small spelling change (Ntaganza / Ntaganzwa) */
function toks_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean).sort(); }
function sameName_(a, b) {
  if (!a.length || a.length !== b.length) return false;
  return a.every(function (t, i) { const u = b[i]; return t === u || (t.slice(0, 5) === u.slice(0, 5) && Math.abs(t.length - u.length) <= 2); });
}

/* every point an agent sent (deleted ones excluded): lets a phone get back its own work */
function pull(agent) {
  if (!String(agent || '').trim()) return { ok: false, error: 'missing agent' };
  const want = toks_(agent);
  const ss = book_(), data = {};
  TABS.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) { data[name] = { header: [], rows: [] }; return; }
    const H = headers_(sh), iA = H.indexOf('Agent'), iSt = H.indexOf('Status');
    const V = sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getDisplayValues();
    data[name] = { header: H, rows: V.filter(function (r) { return sameName_(want, toks_(r[iA])) && String(r[iSt]).indexOf('DELETED') !== 0; }) };
  });
  return { ok: true, data: data };
}

function markDeleted(id) {
  const ss = book_();
  for (const name of TABS) {
    const sh = ss.getSheetByName(name); if (!sh) continue;
    const row = findRow_(sh, id); if (!row) continue;
    const H = headers_(sh);
    sh.getRange(row, H.indexOf('Status') + 1).setValue('DELETED on phone ' + new Date().toISOString());
    sh.getRange(row, 1, 1, H.length).setFontColor('#9ca3af');
    const iF = H.indexOf('Photo File ID');
    if (iF >= 0) { const pid = sh.getRange(row, iF + 1).getValue(); if (pid) { try { DriveApp.getFileById(pid).setTrashed(true); } catch (e) {} } }
    return { ok: true, id: id };
  }
  return { ok: true, id: id, note: 'not found' };
}

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
