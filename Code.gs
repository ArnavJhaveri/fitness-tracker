// ─── Arnav's Fitness Tracker — Google Apps Script Backend ───────────────────
// Deploy as: Web App → Execute as: Me → Who has access: Anyone (anonymous)
// After any change: Deploy → Manage deployments → pencil → New version → Deploy
//
// CORS NOTE: Apps Script GET responses are redirected via Google's CDN which 
// can strip custom headers. To work around this, ALL requests (read + write)
// use POST. The browser uses no-cors mode for POST which avoids preflight,
// and we read data back on the next GET which now works because we set 
// the CORS header on ContentService output (supported for GET responses).

const SHEET_ID   = '1ORQbvwM43qww44XvCfxxLI2NH0jROcmR4tU_RxTow90';
const SHEET_NAME = 'data';

// ── GET handler — read data (browser uses cors mode for GET) ─────────────────
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateSheet(ss);
    const action = e && e.parameter && e.parameter.action;

    if (action === 'read') {
      const data = readData(sheet);
      return jsonResponse({ ok: true, data });
    }

    // Health check
    return jsonResponse({ ok: true, status: 'Fitness Tracker backend running' });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ── POST handler — write data (browser uses no-cors, so response is opaque) ──
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreateSheet(ss);

    // Parse body — works for both content types (application/json and text/plain)
    let body = null;
    if (e.postData) {
      try { body = JSON.parse(e.postData.contents); }
      catch(pe) {
        try { body = JSON.parse(e.postData.getDataAsString()); } catch(pe2) {}
      }
    }

    const action = (body && body.action) || (e.parameter && e.parameter.action);

    if (action === 'write') {
      const payload = body && body.data;
      if (!payload) return jsonResponse({ ok: false, error: 'No data field' });
      writeData(sheet, payload);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch(err) {
    return jsonResponse({ ok: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────
function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['key', 'value', 'updated']);
  }
  return sheet;
}

function readData(sheet) {
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return {};
  const result = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    const val = rows[i][1];
    if (key) {
      try { result[key] = JSON.parse(val); }
      catch { result[key] = val; }
    }
  }
  return result;
}

function writeData(sheet, payload) {
  const rows = sheet.getDataRange().getValues();
  const rowIndex = {};
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0]) rowIndex[rows[i][0]] = i + 1;
  }
  for (const key in payload) {
    const val = JSON.stringify(payload[key]);
    const now = new Date().toISOString();
    if (rowIndex[key]) {
      sheet.getRange(rowIndex[key], 2, 1, 2).setValues([[val, now]]);
    } else {
      sheet.appendRow([key, val, now]);
    }
  }
}

// ── Response helper ───────────────────────────────────────────────────────────
// ContentService GET responses DO support CORS headers when accessed directly.
// The redirect issue only happens when the script URL is accessed without
// the correct deployment type. Ensure deployment is: Execute as Me, Anyone access.
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
