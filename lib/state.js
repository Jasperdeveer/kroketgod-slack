// ── State: JSON-bestanden lezen en schrijven ───────────────────────────────────
// Alle spelstaat leeft in losse JSON-bestanden naast index.js. Deze module is bewust vrij van
// projectkennis: geen bestandsnamen, geen schema's — alleen robuust lezen en schrijven.
// Paden worden opgelost t.o.v. de projectmap (de map boven lib/).

const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.join(__dirname, '..');

const fileCache = new Map();

function readJSON(filename, fallback = undefined) {
  const filePath = path.join(PROJECT_DIR, filename);
  try {
    const stat = fs.statSync(filePath);
    const cached = fileCache.get(filename);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fileCache.set(filename, { mtimeMs: stat.mtimeMs, data });
    return data;
  } catch (err) {
    // `undefined` = geen fallback opgegeven → gooien. Een expliciete `null` is een geldige
    // fallback (bv. loadMissie: "geen actieve missie") en wordt gewoon teruggegeven.
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    // Corrupt JSON (bv. afgekapt bij stroomuitval op de Pi): bestand veiligstellen en met de
    // fallback door — anders blijft élke read op dit bestand crashen tot iemand handmatig ingrijpt.
    if (err instanceof SyntaxError && fallback !== undefined) {
      try { fs.renameSync(filePath, `${filePath}.corrupt.${Date.now()}`); } catch (_) {}
      console.error(`⚠️ ${filename} corrupt — veiliggesteld als .corrupt-bestand, fallback gebruikt.`);
      return fallback;
    }
    throw err;
  }
}

function writeJSON(filename, data) {
  const filePath = path.join(PROJECT_DIR, filename);
  const tmpPath  = `${filePath}.tmp`;
  // Atomic write: schrijf naar temp, fsync (anders kan een stroomuitval op de Pi een leeg
  // bestand achterlaten ondanks de rename), hernoem (rename is atomic op POSIX).
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
  // Cache direct bijwerken zodat de volgende read niet onnodig van disk leest
  try {
    const stat = fs.statSync(filePath);
    fileCache.set(filename, { mtimeMs: stat.mtimeMs, data });
  } catch (_) {}
}

module.exports = { readJSON, writeJSON };
