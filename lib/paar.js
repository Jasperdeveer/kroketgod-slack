// ── De paarstaat: wat er tussen twee leden hangt ──────────────────────────────
// Eén bron van waarheid voor alles wat zich tussen precies twee leden opbouwt: kerven (onrecht
// dat nog niet vergeven is), de eeuwige twist (het aartsvijandschap na genoeg duels) en de
// verhoogde inzet die daaruit volgt.
//
// Waarom dit één module is en geen drie: de Kerfstok, De Eeuwige Twist en De Vetevrede verhogen
// alle drie de duelinzet voor hetzelfde paar. Los gebouwd stapelen ze op elkaar en kan één duel
// tussen twee leden plots vijf punten kosten bij weeksaldi van vier. Hier wordt de inzet één
// keer berekend, met één plafond, uit alle bronnen samen.
//
// Pure functies zonder projectstate. De opslag (`kerfstok.json`) en de Slack-kant staan in
// index.js; hier staat alleen de rekenkunde. Zie lib/paar.test.js.

'use strict';

// Een paar is ONGERICHT voor de twist (A tegen B is hetzelfde vijandschap als B tegen A) en
// GERICHT voor kerven (A kan drie kerven tegen B hebben terwijl B er nul tegen A heeft).
function paarSleutel(a, b) {
  return [String(a), String(b)].sort().join('|');
}

function kerfSleutel(gekerkte, dader) {
  return `${gekerkte}>${dader}`;
}

// ── Kerven ────────────────────────────────────────────────────────────────────
// Een kerf staat voor eenzijdig onrecht: iets wat een ander lid u aandeed zonder dat u ervoor
// koos. Een duel dat u zelf begon levert nooit een kerf op — u zocht het zelf op.
const KERF_GEWICHT = {
  roof_gelukt:    2,  // hij kraakte uw kluis
  duel_verloren:  1,  // maar alleen als de ánder het duel begon (zie boekKerf in index.js)
  premie_geind:   1,  // hij inde de premie die op uw hoofd stond
  troon_verloren: 1,  // hij stootte u van de troon
};

// Hoeveel kerven er hoogstens tussen één paar kunnen staan. Zonder plafond loopt de inzet bij
// een reeks rooftochten door tot iemands hele week op één duel staat.
const KERF_MAX = 4;

// Per paar per dag hoogstens één kerf. Voorkomt dat een enkele slechte middag vier kerven
// oplevert en de stok in één keer volloopt.
const KERF_PER_DAG = 1;

function kerfBij(stok, gekerkte, dader, soort, dagSleutel) {
  const gewicht = KERF_GEWICHT[soort];
  if (!gewicht || !gekerkte || !dader || gekerkte === dader) return { stok, gewijzigd: false };
  const sleutel = kerfSleutel(gekerkte, dader);
  const rec = { kerven: 0, laatsteDag: null, hoogsteOoit: 0, ...(stok[sleutel] || {}) };
  if (rec.laatsteDag === dagSleutel) return { stok, gewijzigd: false }; // al gekerfd vandaag
  const nieuw = Math.min(KERF_MAX, rec.kerven + gewicht);
  if (nieuw === rec.kerven) return { stok, gewijzigd: false };          // plafond bereikt
  const bij = {
    ...rec,
    kerven: nieuw,
    laatsteDag: dagSleutel,
    hoogsteOoit: Math.max(rec.hoogsteOoit || 0, nieuw),
  };
  return { stok: { ...stok, [sleutel]: bij }, gewijzigd: true, kerven: nieuw, soort };
}

function kerven(stok, gekerkte, dader) {
  return stok?.[kerfSleutel(gekerkte, dader)]?.kerven || 0;
}

// Vergiffenis wist de hele stok in één keer. Bewust niet één kerf per keer: vergeven is een
// gebaar, geen afbetaling, en een teller die je met vier gebaren moet leegmaken is boekhouding.
function vergeef(stok, gekerkte, dader) {
  const sleutel = kerfSleutel(gekerkte, dader);
  if (!stok?.[sleutel]?.kerven) return { stok, gewijzigd: false, gewist: 0 };
  const gewist = stok[sleutel].kerven;
  return {
    stok: { ...stok, [sleutel]: { ...stok[sleutel], kerven: 0, vergevenTs: null } },
    gewijzigd: true, gewist,
  };
}

// Alle openstaande kerven van een lid, aflopend. Voedt de App Home-kaart en de Zwartgeblakerde.
function kerfstokVan(stok, userId) {
  return Object.entries(stok || {})
    .filter(([k, v]) => k.startsWith(`${userId}>`) && (v.kerven || 0) > 0)
    .map(([k, v]) => ({ daderId: k.split('>')[1], kerven: v.kerven, hoogsteOoit: v.hoogsteOoit || v.kerven }))
    .sort((a, b) => b.kerven - a.kerven || a.daderId.localeCompare(b.daderId));
}

// ── De Eeuwige Twist ──────────────────────────────────────────────────────────
// Na genoeg duels tussen hetzelfde paar verklaart de Kroket God hen aartsvijanden. Eenmalig per
// paar, voor het bestaan van het genootschap.
const TWIST_DUELS = 4;

function twistRijp(duelhistorie, a, b) {
  const paar = duelhistorie?.[a]?.tegen?.[b];
  if (!paar) return false;
  return (paar.gewonnen || 0) + (paar.verloren || 0) >= TWIST_DUELS;
}

// De onderlinge stand. Positief = `a` staat voor.
function twistStand(duelhistorie, a, b) {
  const paar = duelhistorie?.[a]?.tegen?.[b] || {};
  const voor = paar.gewonnen || 0;
  const tegen = paar.verloren || 0;
  return { voor, tegen, verschil: voor - tegen };
}

// ── De inzet ──────────────────────────────────────────────────────────────────
// Één berekening, alle bronnen. Kerven verhogen de inzet van precies dat duel; een verklaarde
// twist verhoogt hem met één; een verklaarde vete van het Rijk verdubbelt de basis.
//
// Het ARMOEDEPLAFOND is de belangrijkste regel: de inzet is nooit meer dan de helft van wat de
// armste van de twee bezit, en nooit minder dan 1. Zonder dat kan een verloren wraakduel
// iemands hele week zijn — en de eigenaar heeft straf op de roem-as uitdrukkelijk afgewezen,
// dus de puntenkant mag niet ongelimiteerd bijten.
const INZET_BASIS = 1;
const INZET_MAX = 4;

function duelInzet({ kerven = 0, twist = false, vete = false, bezitA = 0, bezitB = 0 } = {}) {
  let inzet = INZET_BASIS + Math.min(kerven, KERF_MAX);
  if (twist) inzet += 1;
  if (vete) inzet *= 2;
  inzet = Math.min(INZET_MAX, inzet);
  const armste = Math.min(bezitA, bezitB);
  // Halve beurs van de armste, naar beneden. Bij 1 punt blijft de inzet dus 1: er moet altijd
  // gedueld kúnnen worden, anders sluit armoede je uit — precies de fout die de audit aanwees.
  const plafond = Math.max(1, Math.floor(armste / 2));
  return Math.max(1, Math.min(inzet, plafond));
}

// De redenen achter de inzet, als leesbare regels. Een verhoogde inzet die niemand kan
// verklaren is een bug in de beleving, ook als de rekenkunde klopt.
function inzetRedenen({ kerven = 0, twist = false, vete = false } = {}) {
  const uit = [];
  // "kerf" wordt "kerven": de f wordt een v, dus geen simpele -ven-suffix.
  if (kerven > 0) uit.push(`${kerven} openstaande ${kerven === 1 ? 'kerf' : 'kerven'}`);
  if (twist) uit.push('eeuwige twist');
  if (vete) uit.push('vete van het Rijk');
  return uit;
}

module.exports = {
  paarSleutel, kerfSleutel,
  KERF_GEWICHT, KERF_MAX, KERF_PER_DAG,
  kerfBij, kerven, vergeef, kerfstokVan,
  TWIST_DUELS, twistRijp, twistStand,
  INZET_BASIS, INZET_MAX, duelInzet, inzetRedenen,
};
