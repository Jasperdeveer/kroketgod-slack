// ── Het Grote Vetbad: kansen, de Vetpot en Dubbel of niks ────────────────────
//
// Alleen de rekenkunde en de toetsen. Het posten, de knoppen en de state staan in index.js.
//
// DE KANSEN. Er is nog maar één jackpot: de VETPOT, ×3 én de hele pot. Op verzoek van de eigenaar
// veel zeldzamer dan de oude jackpot (6%, en in de praktijk door het Gefluisterde Voorrecht bijna
// 13% van alle offers): 1% per offer, en HOOGSTENS ÉÉN KEER PER WEEK voor het hele genootschap.
// Valt er in een week al een jackpot, dan wordt een volgende jackpotworp een verdubbeling. Geen
// enkele achterdeur omzeilt dat plafond — het Gefluisterde Voorrecht levert geen jackpot meer,
// en de handmatige override valt er ook onder.
//
// De kans die de jackpot inleverde, is verschoven naar verdubbelen en minder verlies, zodat het
// huisvoordeel precies blijft wat het was: −5% per ingezet punt. Zonder die compensatie zakte de
// verwachting naar −17% en werd offeren een veel slechtere deal — het tegendeel van de bedoeling.
//   1%  Vetpot     ×3 én de hele pot (hoogstens één per week)
//   37% verdubbeld +inzet
//   17% terug      0
//   45% verzwolgen −inzet (in index.js soms gedempt voor wie achterloopt, zie vetbadTeruggave)
//
// DE VETPOT. Een oplopende pot die iedereen ziet groeien. Hij wordt gevuld uit het huisvoordeel:
// van elk verlies druipt een twintigste in de pot in plaats van te verdampen. De verliezer
// verliest precies evenveel als vroeger; alleen houdt "de bank" minder. Collectief gaat de
// verwachting daarmee van −5% naar −2,75% per ingezet punt — nog steeds een put, geen kraan. Dat
// is dragend: het Vetbad is al eens een geldmachine geweest (zie getGeluk in index.js), en een pot
// die méér uitkeert dan het huisvoordeel opbrengt drukt punten bij.
// De pot ROLT DOOR over de zondagse reset (keuze van de eigenaar): hij blijft staan tot iemand
// hem wint. Daarom een plafond — zonder plafond beslist één worp na een maand de hele week.
//
// DUBBEL OF NIKS. Na elke winst één knop: de winst van dat offer nog eens inzetten, 50/50.
// Eerlijk (verwachting precies nul), telt niet als offer, en hoogstens één keer per winst — een
// ketting verdubbelt exponentieel. Wie zijn winst al heeft uitgegeven, kan hem niet meer inzetten:
// verliezen zou dan punten afnemen die er niet meer zijn.
//
// Puur: geen I/O, geen klok, geen Math.random — de aanroeper geeft worpen en tijd mee.
// Zie vetbad.test.js.

'use strict';

// Bovengrenzen van de worp (0 ≤ worp < 1), oplopend. Hele procenten, geen breuken die optellen:
// 0,40 + 0,45 is in floating point 0,8500000000000001 (zie eerwaarde.js).
const GRENZEN = [
  ['vetpot', 0.01],
  ['dubbel', 0.38],
  ['terug', 0.55],
  ['verzwolgen', 1],
];
const JACKPOT_FACTOR = 3;

const VETPOT_AANDEEL = 0.05;   // van elk verloren punt druipt een twintigste in de pot
const VETPOT_START = 10;       // waarmee de Raad de pot opent (eenmalig)
const VETPOT_MAX = 50;         // wat erboven druipt, loopt over de rand en is weg

const DUBBEL_GELDIG_MS = 15 * 60 * 1000;
const DUBBEL_BEWAAR_MS = 24 * 60 * 60 * 1000;

function uitkomstVan(worp) {
  for (const [naam, grens] of GRENZEN) if (worp < grens) return naam;
  return 'verzwolgen';
}

// Is de jackpot deze week nog te winnen? `vetpot.jackpotWeek` = de maandag van de week waarin hij
// het laatst viel.
function jackpotVrij(vetpot, week) {
  return !!week && vetpot?.jackpotWeek !== week;
}

// De uitkomst mét het weekplafond: een jackpotworp in een week die zijn jackpot al had, wordt een
// verdubbeling (de beste uitkomst die er dan nog is).
function beslisUitkomst(worp, { jackpotVrij: vrij }) {
  const u = uitkomstVan(worp);
  return u === 'vetpot' && !vrij ? 'dubbel' : u;
}

// Wat het offer de speler oplevert, vóór een eventuele demping van het verlies.
function vetbadDelta(uitkomst, inzet, pot = 0) {
  switch (uitkomst) {
    case 'vetpot': return inzet * JACKPOT_FACTOR + pot;
    case 'dubbel': return inzet;
    case 'terug': return 0;
    default: return -inzet;
  }
}

// Hoeveel van een verlies in de pot druipt: het verwachte deel, met een worp voor de breuk, zodat
// het gemiddelde exact VETPOT_AANDEEL is zonder halve punten.
function potInleg(verlies, worp) {
  const verwacht = Math.max(0, Number(verlies) || 0) * VETPOT_AANDEEL;
  const heel = Math.floor(verwacht);
  return heel + (worp < verwacht - heel ? 1 : 0);
}

// De pot na een inleg, met het plafond. `overloop` is wat over de rand ging.
function naInleg(pot, inleg) {
  const nieuw = Math.max(0, Number(pot) || 0) + Math.max(0, inleg);
  return { pot: Math.min(VETPOT_MAX, nieuw), overloop: Math.max(0, nieuw - VETPOT_MAX) };
}

// Verwachte opbrengst per ingezet punt, zonder demping. `collectief` telt de inleg in de pot als
// teruggegeven (hij komt ooit bij een speler terecht); anders telt alleen het spel zelf.
function verwachtingPerPunt({ collectief = false } = {}) {
  const kans = {};
  let vorige = 0;
  for (const [naam, grens] of GRENZEN) { kans[naam] = grens - vorige; vorige = grens; }
  const spel = kans.vetpot * JACKPOT_FACTOR + kans.dubbel - kans.verzwolgen;
  return collectief ? spel + kans.verzwolgen * VETPOT_AANDEEL : spel;
}

// ── Dubbel of niks ────────────────────────────────────────────────────────────

function dubbelOfNiksDelta(winst, worp) {
  return worp < 0.5 ? winst : -winst;
}

// Mag deze speler deze kans nu spelen? `stand` = zijn huidige kroketpunten.
function toetsDubbel(kans, userId, nu, stand) {
  if (!kans) return { ok: false, reden: 'onbekend' };
  if (kans.userId !== userId) return { ok: false, reden: 'niet_uw' };
  if (kans.gespeeld) return { ok: false, reden: 'gespeeld' };
  if (nu - kans.ts > DUBBEL_GELDIG_MS) return { ok: false, reden: 'verlopen' };
  if ((Number(stand) || 0) < kans.winst) return { ok: false, reden: 'uitgegeven' };
  return { ok: true };
}

// Oude kansen opruimen (gespeeld of niet), zodat het bestand niet eeuwig groeit.
function ruimKansen(kansen, nu) {
  return Object.fromEntries(Object.entries(kansen || {}).filter(([, k]) => nu - (k?.ts || 0) < DUBBEL_BEWAAR_MS));
}

module.exports = {
  GRENZEN, JACKPOT_FACTOR, VETPOT_AANDEEL, VETPOT_START, VETPOT_MAX, DUBBEL_GELDIG_MS, DUBBEL_BEWAAR_MS,
  uitkomstVan, jackpotVrij, beslisUitkomst, vetbadDelta, potInleg, naInleg, verwachtingPerPunt,
  dubbelOfNiksDelta, toetsDubbel, ruimKansen,
};
