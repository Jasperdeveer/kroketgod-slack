// ── Backups van de spelstaat ───────────────────────────────────────────────────
// Dagelijkse kopie van alle state naast index.js, zeven dagen bewaard. De lijst is de basis
// plus wat features declareren (zie lib/registry.js), zodat een nieuwe feature zijn state niet
// kan vergeten. controleerBackupDekking() waarschuwt bij opstarten over bestanden die niemand
// backupt — precies het gat waardoor de veiling-escrow buiten de backup viel.

const fs = require('fs');
const path = require('path');

const { FEATURES } = require('./registry.js');

const PROJECT_DIR = path.join(__dirname, '..');

// Basislijst: state van de kern (scores, leden, straffen, geschiedenis). Feature-eigen state
// komt uit de registry, zie backupBestanden().
const BACKUP_BASIS = [
  'scores.json', 'members.json', 'verbanning.json', 'achievements.json',
  'streaks.json', 'stemmen.json', 'allianties.json', 'geleKaarten.json',
  'vergrijpen.json', 'weekgebeurtenissen.json', 'eerGegeven.json',
  'verdacht.json', 'missie.json', 'roem.json', 'statistiekhistorie.json',
  'geplandeberichten.json', 'personas.json', 'powerups.json', 'winkelhistorie.json',
  // Kern-spelstaat die niet bij één feature hoort.
  'troon.json', 'troonduel.json', 'cooldowns.json', 'duels.json', 'vetbad.json',
  // Permanent prestige: hoe vaak iemand kroket-held van de week was. Viel buiten de dekking, en
  // dit is niet terug te rekenen uit iets anders — precies het soort verlies dat de
  // startup-controle hieronder hoort te voorkomen.
  'heldentitels.json',
  'kroketgok.json', 'kroket_van_de_dag.json', 'goudenkroket.json', 'profetie.json',
  'weekreset.json', 'kroketevent.json',
  // Opgebouwde inhoud & configuratie — kost de meeste moeite om terug te krijgen.
  'kennisbank.json', 'instellingen.json', 'quiz.json', 'geluk.json',
];

// Basislijst + alles wat features declareren. Functie (geen const) omdat features zich
// tijdens het laden van de module registreren, ná deze definitie.
function backupBestanden() {
  return [...new Set([...BACKUP_BASIS, ...FEATURES.flatMap(f => f.state || [])])];
}

// Startup-controle op drift: staat er state op schijf die niemand backupt? Dat is precies hoe
// de veiling-escrow buiten de backup viel. Waarschuwt alleen — nooit blokkeren bij opstarten.
const BACKUP_NEGEER = new Set([
  'package.json', 'package-lock.json', 'members.json',
  // Puur afgeleid of triviaal herbouwbaar:
  'auditlog.json', 'llmstats.json', 'frituurlog.json', 'overslaan.json',
  'geschiedenis.json', 'test_kanalen.json',
]);

function controleerBackupDekking() {
  try {
    const gedekt = new Set(backupBestanden());
    const opSchijf = fs.readdirSync(PROJECT_DIR).filter(f => f.endsWith('.json'));
    const vergeten = opSchijf.filter(f => !gedekt.has(f) && !BACKUP_NEGEER.has(f));
    if (vergeten.length) {
      console.warn(`⚠️ Niet in de backup: ${vergeten.join(', ')} — registreer ze bij een feature (state) of in BACKUP_BASIS.`);
    }
  } catch (_) {}
}

function maakBackup() {
  try {
    const backupDir = path.join(PROJECT_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

    const datumStempel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    for (const bestand of backupBestanden()) {
      const bron = path.join(PROJECT_DIR, bestand);
      if (!fs.existsSync(bron)) continue;
      const doel = path.join(backupDir, `${datumStempel}_${bestand}`);
      fs.copyFileSync(bron, doel);
    }

    // Verwijder backups ouder dan 7 dagen
    const grens = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const f of fs.readdirSync(backupDir)) {
      const p = path.join(backupDir, f);
      if (fs.statSync(p).mtimeMs < grens) fs.unlinkSync(p);
    }
    console.log(`💾 Backup gemaakt (${datumStempel})`);
  } catch (err) {
    console.error('⚠️ Backup mislukt:', err.message);
  }
}

module.exports = {
  BACKUP_BASIS,
  backupBestanden,
  controleerBackupDekking,
  maakBackup,
};
