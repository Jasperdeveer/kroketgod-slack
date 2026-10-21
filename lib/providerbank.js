// ── De bank: schakels die STUK zijn, niet druk ─────────────────────────────────
// Een provider die 401/402/403/404 geeft lost dat niet binnen een minuut op: een verkeerde sleutel,
// een opgebruikt gratis quotum, een opgeruimd model. Zo'n schakel hoort op de bank, zodat de keten
// hem niet bij elk bericht opnieuw een dode round-trip laat maken.
//
// Dat gebeurde wél, en honderden keren per dag (productielog: SambaNova 401/402 ×241, Cerebras 402
// ×71, OpenRouter 404 ×44). Twee oorzaken:
//   · de bank stond in het geheugen, en de dagelijkse pm2-herstart van 03:00 maakte hem leeg;
//   · hij gold een vast halfuur, dus een schakel die al dagen dood is kreeg 48 kansen per dag.
// Vandaar: de bank staat in cooldowns.json (overleeft een herstart en een deploy), en een schakel
// die na zijn bankstraf meteen wéér faalt gaat een trede hoger: 30 min → 2 uur → 24 uur. Eén
// geslaagde aanroep haalt hem van de bank en zet de trap terug op nul.
//
// Daarnaast een vaste bankstraf tot een opgegeven moment (`bankTot`), voor fouten waarvan het einde
// bekend is: een Gemini-sleutel met zijn dagquotum op staat tot middernacht Pacific-tijd op de bank.
//
// Sleutels zijn vrije strings ('cerebras:gpt-oss-120b', 'gemini-sleutel:3f2a9c1d', 'gemini-beeld').
// NOOIT een API-sleutel zelf als banksleutel gebruiken: dit bestand staat leesbaar op de Pi en gaat
// mee in de backup. Gebruik een hash (zie sleutelId).

const crypto = require('crypto');
const { readJSON, writeJSON } = require('./state.js');

const BANK_BESTAND = 'cooldowns.json';
const BANK_VELD = 'llmBank';

const BANK_TRAPPEN_MS = [30 * 60_000, 2 * 60 * 60_000, 24 * 60 * 60_000];

// Na zo lang zonder nieuwe fout vergeten we de trap: een schakel die vorige week één keer faalde,
// begint vandaag weer op een halfuur in plaats van meteen op twee uur.
const TRAP_VERGEET_MS = 48 * 60 * 60_000;

// Korte, niet-terug te rekenen vingerafdruk van een API-sleutel, om hem in de bank te noemen.
function sleutelId(sleutel) {
  return crypto.createHash('sha256').update(String(sleutel)).digest('hex').slice(0, 8);
}

function leesBank() {
  const data = readJSON(BANK_BESTAND, {});
  const bank = data[BANK_VELD];
  return bank && typeof bank === 'object' ? bank : {};
}

// Lezen en schrijven in één synchrone slag: cooldowns.json delen we met de frituur-, roof- en
// genade-cooldowns van index.js, en die doen hun lees-wijzig-schrijf ook zonder await ertussen.
function wijzigBank(fn, nu) {
  const data = readJSON(BANK_BESTAND, {});
  const bank = data[BANK_VELD] && typeof data[BANK_VELD] === 'object' ? data[BANK_VELD] : {};
  const uit = fn(bank);
  // Opruimen: verlopen en lang vergeten regels weg, zodat het bestand niet groeit.
  for (const [sleutel, regel] of Object.entries(bank)) {
    if (regel.tot <= nu && nu - (regel.laatsteFout || 0) > TRAP_VERGEET_MS) delete bank[sleutel];
  }
  data[BANK_VELD] = bank;
  writeJSON(BANK_BESTAND, data);
  return uit;
}

// De bankregel van `sleutel` als hij NU op de bank zit, anders null.
function bankStatus(sleutel, nu = Date.now()) {
  const regel = leesBank()[sleutel];
  return regel && regel.tot > nu ? regel : null;
}

const isGebankt = (sleutel, nu = Date.now()) => !!bankStatus(sleutel, nu);

// Zet een stukke schakel op de bank, een trede hoger dan de vorige keer als die nog vers is.
// Zit hij er al op (een tweede verzoek dat tegelijk liep), dan verandert er niets: anders zou één
// storing met drie gelijktijdige berichten meteen naar 24 uur doorschieten.
// Geeft { nieuw, tot, trap } terug; `trap` telt vanaf 1, voor de logregel.
function bankStuk(sleutel, { status = null, reden = '', label = null } = {}, nu = Date.now()) {
  return wijzigBank((bank) => {
    const oud = bank[sleutel];
    if (oud && oud.tot > nu) return { nieuw: false, tot: oud.tot, trap: (oud.trap ?? 0) + 1 };
    // Alleen een eerdere STUK-straf telt als trede; een verlopen dagquotum (trap null) niet.
    const vers = oud && Number.isInteger(oud.trap) && nu - (oud.laatsteFout || 0) <= TRAP_VERGEET_MS;
    const trap = vers ? Math.min(oud.trap + 1, BANK_TRAPPEN_MS.length - 1) : 0;
    const tot = nu + BANK_TRAPPEN_MS[trap];
    bank[sleutel] = { tot, trap, status, reden, label: label || oud?.label || null, sinds: nu, laatsteFout: nu };
    return { nieuw: true, tot, trap: trap + 1 };
  }, nu);
}

// Zet `sleutel` op de bank tot een vast moment (bv. middernacht Pacific bij een dagquotum).
// Raakt de trap niet: een opgebruikt dagquotum zegt niets over of de schakel stuk is.
function bankTot(sleutel, tot, { status = null, reden = '', label = null } = {}, nu = Date.now()) {
  return wijzigBank((bank) => {
    const oud = bank[sleutel];
    if (oud && oud.tot >= tot) return { nieuw: false, tot: oud.tot };
    bank[sleutel] = { tot, trap: oud?.trap ?? null, status, reden, label: label || oud?.label || null, sinds: nu, laatsteFout: nu };
    return { nieuw: !(oud && oud.tot > nu), tot };
  }, nu);
}

// Een geslaagde aanroep: van de bank af en de trap terug op nul. Schrijft alleen als er iets te
// wissen valt, want dit draait na élk geslaagd modelantwoord.
function geefVrij(sleutel) {
  if (!(sleutel in leesBank())) return false;
  wijzigBank((bank) => { delete bank[sleutel]; }, Date.now());
  return true;
}

// Alles wat nu op de bank zit, eerstvolgende terugkeer bovenaan. Voor het dashboard en de logs.
function bankLijst(nu = Date.now()) {
  return Object.entries(leesBank())
    .filter(([, r]) => r.tot > nu)
    .map(([sleutel, r]) => ({
      sleutel,
      label: r.label || sleutel,
      status: r.status ?? null,
      reden: r.reden || '',
      trap: Number.isInteger(r.trap) ? r.trap + 1 : null,
      tot: r.tot,
      restMs: r.tot - nu,
    }))
    .sort((a, b) => a.tot - b.tot);
}

// Dashboardknop "reset cooldowns": iedereen terug in de keten, trappen op nul.
function wisBank() {
  const data = readJSON(BANK_BESTAND, {});
  if (!data[BANK_VELD]) return;
  delete data[BANK_VELD];
  writeJSON(BANK_BESTAND, data);
}

module.exports = {
  BANK_TRAPPEN_MS, TRAP_VERGEET_MS,
  sleutelId, bankStatus, isGebankt, bankStuk, bankTot, geefVrij, bankLijst, wisBank,
};
