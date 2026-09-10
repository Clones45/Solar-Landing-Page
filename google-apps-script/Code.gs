/* ============================================================
   SolarWave lead receiver  (Google Apps Script)

   Paste this whole file into the Sheet's Extensions > Apps Script editor,
   replacing everything there. Then: Deploy > Manage deployments > pencil icon
   > Version: "New version" > Deploy. The web app URL stays the same.

   What it does
   - Lead submissions  -> new row in the "Leads" tab + email alert
   - Bill photo uploads -> file saved in the Drive folder below, link written
                          into the lead's row (bill_photo column) + email alert
   ============================================================ */

const SHEET_NAME   = 'Leads';
const NOTIFY_EMAIL = 'granadaclyde1@gmail.com';  // leave '' to skip email alerts
const PHOTO_FOLDER = 'SolarWave Bill Photos';    // created in your Drive on first upload

const HEADERS = ['submitted_at', 'lead_id', 'full_name', 'phone', 'email', 'contact_method_label',
  'city', 'province', 'bill_label', 'ownership_label', 'property_type_label', 'priority_label',
  'roof_label', 'timeline_label', 'lead_temperature', 'score', 'qualified', 'flags',
  'recommended_system', 'typical_system_size', 'bill_photo',
  'utm_source', 'utm_campaign', 'utm_content', 'fbclid', 'page_url'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const result = body.type === 'bill_photo' ? saveBillPhoto(body) : saveLead(body);
    return respond(result);
  } catch (err) {
    return respond({ ok: false, error: String((err && err.message) || err) });
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- sheet helpers ---------- */

// Returns the Leads sheet and its header list. Adds any missing header columns,
// so older sheets pick up new fields (lead_id, bill_photo) without manual edits.
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const lastCol = sheet.getLastColumn();
  const existing = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter(Boolean) : [];
  const missing = HEADERS.filter(h => existing.indexOf(h) < 0);
  if (missing.length) sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  if (sheet.getFrozenRows() === 0) sheet.setFrozenRows(1);
  return { sheet: sheet, cols: existing.concat(missing) };
}

function rowFor(cols, obj) {
  return cols.map(h => (obj[h] === undefined || obj[h] === null) ? '' : String(obj[h]));
}

/* ---------- leads ---------- */

function saveLead(lead) {
  const { sheet, cols } = getSheet();
  sheet.appendRow(rowFor(cols, lead));
  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(NOTIFY_EMAIL,
      'New solar lead: ' + lead.full_name + ' (' + lead.lead_temperature + ')',
      leadSummary(lead));
  }
  return { ok: true, lead_id: lead.lead_id || '' };
}

function leadSummary(lead) {
  return [
    'Name: ' + lead.full_name,
    'Phone: ' + lead.phone,
    'Reach via: ' + lead.contact_method_label,
    'Location: ' + lead.city + ', ' + lead.province,
    'Bill: ' + lead.bill_label,
    'Ownership: ' + lead.ownership_label,
    'Property: ' + lead.property_type_label,
    'Wants: ' + lead.priority_label,
    'Roof: ' + lead.roof_label,
    'Timeline: ' + lead.timeline_label,
    'Score: ' + lead.score + ' (' + lead.lead_temperature + ')',
    'Qualified: ' + lead.qualified,
    lead.flags ? 'Flags: ' + lead.flags : null,
    'Lead ID: ' + lead.lead_id,
    '',
    'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].filter(line => line !== null).join('\n');
}

/* ---------- bill photos ---------- */

function saveBillPhoto(p) {
  if (!p.data) throw new Error('No file data received');
  const mime = p.mime || 'image/jpeg';
  const ext = mime === 'application/pdf' ? 'pdf' : ((mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg'));
  const safeName = String(p.full_name || 'lead').replace(/[^\w\- ]+/g, '').trim() || 'lead';
  const stamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyyMMdd-HHmm');
  const name = (p.lead_id || stamp) + ' - ' + safeName + '.' + ext;

  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), mime, name);
  const file = getPhotoFolder().createFile(blob);
  const url = file.getUrl();

  // Write the link into the matching lead row (search newest rows first)
  const { sheet, cols } = getSheet();
  const idCol = cols.indexOf('lead_id') + 1;
  const photoCol = cols.indexOf('bill_photo') + 1;
  let linked = false;
  if (p.lead_id && sheet.getLastRow() > 1) {
    const ids = sheet.getRange(2, idCol, sheet.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(p.lead_id)) {
        sheet.getRange(i + 2, photoCol).setValue(url);
        linked = true;
        break;
      }
    }
  }
  if (!linked) {
    sheet.appendRow(rowFor(cols, {
      submitted_at: new Date().toISOString(), lead_id: p.lead_id || '', full_name: p.full_name || '',
      phone: p.phone || '', bill_photo: url, flags: 'photo_without_lead'
    }));
  }

  if (NOTIFY_EMAIL) {
    MailApp.sendEmail(NOTIFY_EMAIL,
      'Bill photo received: ' + (p.full_name || p.lead_id),
      'Lead: ' + (p.full_name || '') + ' (' + (p.phone || '') + ')\nLead ID: ' + (p.lead_id || '') + '\nFile: ' + url);
  }
  return { ok: true, file: url };
}

function getPhotoFolder() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}

/* ---------- editor tests (pick one in the Run dropdown) ---------- */

function testLead() {
  const fake = { postData: { contents: JSON.stringify({
    submitted_at: new Date().toISOString(), lead_id: 'SW-TEST-0001', full_name: 'Test Lead (delete me)',
    phone: '+639171234567', email: 'test@example.com', contact_method_label: 'Phone call',
    city: 'Cabanatuan City', province: 'Nueva Ecija', bill_label: '₱6,000 – ₱10,000',
    ownership_label: 'Owner', property_type_label: 'Residential', priority_label: 'Savings and backup',
    roof_label: 'Metal / GI sheet', timeline_label: 'As soon as possible',
    lead_temperature: 'hot', score: 7, qualified: true, flags: '',
    recommended_system: 'Hybrid with battery backup', typical_system_size: '5 – 8 kWp',
    utm_source: 'editor-test', page_url: 'editor-test'
  }) } };
  Logger.log(doPost(fake).getContent());
}

// Uploads a tiny 1x1 test image and links it to the SW-TEST-0001 row from testLead().
// Running this also grants the script its Google Drive permission.
function testPhoto() {
  const fake = { postData: { contents: JSON.stringify({
    type: 'bill_photo', lead_id: 'SW-TEST-0001', full_name: 'Test Lead (delete me)', phone: '+639171234567',
    filename: 'test.png', mime: 'image/png',
    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  }) } };
  Logger.log(doPost(fake).getContent());
}
