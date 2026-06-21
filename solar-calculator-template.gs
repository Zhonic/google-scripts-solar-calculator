/*************************************************************
 * Solar Pricing Calculator — Google Apps Script backend
 * -----------------------------------------------------------
 * Created by: Harnish Patel
 * Last edited: 21/06/2026
 * Template Version: 1
 *
 * A self-hosted internal sales calculator. Deploys as a Google
 * Apps Script web app; pricing is stored centrally in a Google
 * Sheet so a whole sales team shares one source of truth, while
 * only named admins can edit it.
 *
 * Pairs with the "Index" HTML file in the same Apps Script project.
 *
 * What it does:
 *  - doGet()      serves the calculator page
 *  - getConfig()  returns the shared pricing config (any user with access)
 *  - saveConfig() writes the config — but ONLY for the admin emails below.
 *                 The check runs on the server, so it can't be bypassed
 *                 by editing the page in the browser.
 *
 * Pricing is stored as JSON text in cell A1 of a sheet tab named "Config".
 *************************************************************/

/* === 1) EDIT THIS: the Google accounts allowed to edit pricing ===
   Use the exact Google/Workspace login emails of your admins. */
var ADMIN_EMAILS = [
  'you@yourcompany.com.au',
  'second-admin@yourcompany.com.au'
];

/* === 2) Branding shown in the page title. The in-page masthead text
   lives in Index.html (search BRAND_NAME there). === */
var APP_TITLE = 'Solar Pricing Calculator';

/* === 3) Leave blank if this script is BOUND to the Sheet (created via the
   Sheet's Extensions > Apps Script). Otherwise paste the Sheet's ID here. === */
var SPREADSHEET_ID = '';

var CONFIG_SHEET = 'Config';   // tab that stores the JSON
var CONFIG_CELL  = 'A1';

/** Serves the calculator page. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Returns { config: <object|null>, isAdmin: <bool> }. Callable by anyone with access. */
function getConfig() {
  var sh = getConfigSheet_();
  var raw = sh.getRange(CONFIG_CELL).getValue();
  var config = null;
  if (raw && String(raw).trim()) {
    try { config = JSON.parse(raw); } catch (e) { config = null; }
  }
  return { config: config, isAdmin: isAdmin_() };
}

/** Saves config JSON. Server-side admin check — non-admins are rejected. */
function saveConfig(jsonString) {
  if (!isAdmin_()) {
    throw new Error('You do not have permission to edit pricing.');
  }
  var parsed;
  try { parsed = JSON.parse(jsonString); }
  catch (e) { throw new Error('Could not save: the data was not valid.'); }

  var json = JSON.stringify(parsed);
  if (json.length > 45000) {
    // A single sheet cell holds ~50,000 chars. Warn well before the limit.
    throw new Error('Config is too large to store in one cell. Contact your developer.');
  }
  getConfigSheet_().getRange(CONFIG_CELL).setValue(json);
  return { ok: true, savedBy: currentEmail_(), at: new Date().toISOString() };
}

/* ---------- helpers ---------- */
function getSS_() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}
function getConfigSheet_() {
  var ss = getSS_();
  if (!ss) {
    throw new Error('No spreadsheet found. Either bind this script to a Sheet, or set SPREADSHEET_ID.');
  }
  var sh = ss.getSheetByName(CONFIG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG_SHEET);
    sh.getRange('A1').setNote('Pricing config (JSON). Edited via the calculator Admin panel — avoid editing by hand.');
  }
  return sh;
}
function currentEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; }
  catch (e) { return ''; }
}
function isAdmin_() {
  var email = currentEmail_().toLowerCase();
  if (!email) return false;
  for (var i = 0; i < ADMIN_EMAILS.length; i++) {
    if (String(ADMIN_EMAILS[i]).toLowerCase() === email) return true;
  }
  return false;
}
