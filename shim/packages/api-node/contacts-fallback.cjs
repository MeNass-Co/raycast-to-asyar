// Fallback for Raycast's swift Contacts tool when the host lacks the Contacts TCC grant:
// read the AddressBook SQLite stores directly (readable with Full Disk Access).
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { globSync } = require('node:fs');

let cache = null;
function load() {
  if (cache) return cache;
  const byPhoneSuffix = new Map(); const byEmail = new Map(); const byId = new Map();
  const home = os.homedir();
  const dbs = [
    ...globSync(path.join(home, 'Library/Application Support/AddressBook/Sources/*/AddressBook-v22.abcddb')),
    path.join(home, 'Library/Application Support/AddressBook/AddressBook-v22.abcddb'),
  ].filter((p) => fs.existsSync(p));
  for (const file of dbs) {
    let db;
    try { db = new DatabaseSync(file, { readOnly: true }); } catch { continue; }
    try {
      const recs = db.prepare('SELECT Z_PK, ZUNIQUEID, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION, ZNICKNAME, ZTHUMBNAILIMAGEDATA, ZIMAGEDATA FROM ZABCDRECORD').all();
      const phones = db.prepare('SELECT ZOWNER, ZFULLNUMBER, ZCOUNTRYCODE FROM ZABCDPHONENUMBER').all();
      const emails = db.prepare('SELECT ZOWNER, ZADDRESS FROM ZABCDEMAILADDRESS').all();
      const pk = new Map();
      for (const r of recs) {
        const id = String(r.ZUNIQUEID ?? `${file}:${r.Z_PK}`);
        const givenName = r.ZFIRSTNAME ?? ''; const familyName = r.ZLASTNAME ?? '';
        const displayName = `${givenName} ${familyName}`.trim() || r.ZORGANIZATION || r.ZNICKNAME || '';
        const img = imageBytes(r.ZTHUMBNAILIMAGEDATA) ?? imageBytes(r.ZIMAGEDATA);
        const c = { id, givenName, familyName, displayName, phoneNumbers: [], emailAddresses: [], matchedChatIdentifiers: [], imageData: img ? Buffer.from(img).toString('base64') : null };
        pk.set(r.Z_PK, c); byId.set(id, c);
      }
      for (const p of phones) { const c = pk.get(p.ZOWNER); if (!c || !p.ZFULLNUMBER) continue; c.phoneNumbers.push({ number: p.ZFULLNUMBER, countryCode: p.ZCOUNTRYCODE ?? null }); const d = digits(p.ZFULLNUMBER); if (d.length >= 7) byPhoneSuffix.set(d.slice(-7), c); }
      for (const e of emails) { const c = pk.get(e.ZOWNER); if (!c || !e.ZADDRESS) continue; c.emailAddresses.push(String(e.ZADDRESS).toLowerCase()); byEmail.set(String(e.ZADDRESS).toLowerCase(), c); }
    } catch { /* skip broken store */ } finally { try { db.close(); } catch {} }
  }
  cache = { byPhoneSuffix, byEmail, byId };
  return cache;
}
const digits = (s) => String(s).replace(/\D/g, '');
// AddressBook stores images with a 1-byte type prefix before the JPEG/PNG/HEIC payload; some rows hold only a reference id.
function imageBytes(blob) {
  if (!blob) return null;
  const b = Buffer.from(blob);
  const magic = [[0xff, 0xd8, 0xff], [0x89, 0x50, 0x4e, 0x47]];
  for (let off = 0; off < Math.min(8, b.length); off++) for (const m of magic) if (m.every((x, i) => b[off + i] === x)) return b.subarray(off);
  return null;
}

exports.fetchContactsForChatIdentifiers = async function (chatIdentifiers) {
  const { byPhoneSuffix, byEmail } = load();
  const out = new Map();
  for (const idRaw of chatIdentifiers ?? []) {
    const id = String(idRaw ?? '').trim(); if (!id) continue;
    let c = null;
    if (id.includes('@')) c = byEmail.get(id.toLowerCase()) ?? null;
    else { const d = digits(id); if (d.length >= 7) c = byPhoneSuffix.get(d.slice(-7)) ?? null; }
    if (!c) continue;
    const prev = out.get(c.id) ?? { ...c, matchedChatIdentifiers: [], imageData: null };
    prev.matchedChatIdentifiers.push(id);
    out.set(c.id, prev);
  }
  return [...out.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
};
exports.fetchContactPhotosForContactIds = async function (contactIds) {
  const { byId } = load();
  return (contactIds ?? []).map((id) => ({ id, imageData: byId.get(id)?.imageData ?? null })).filter((p) => p.imageData);
};
exports.fetchAllContacts = async function () {
  const { byId } = load();
  return [...byId.values()].filter((c) => c.displayName && (c.phoneNumbers.length || c.emailAddresses.length)).map((c) => ({ ...c, imageData: null })).sort((a, b) => a.displayName.localeCompare(b.displayName));
};
