// ── Heilige verbonden: de regels voor verbonden van twee of drie ──────────────
//
// Een verbond was altijd een paar: allianties.json bewaarde { a: 'b', b: 'a' } en de hele code ging
// uit van "de" bondgenoot. Op verzoek van de eigenaar kan iemand zich nu aansluiten bij een verbond
// dat al uit twee leden bestaat. Dit bestand bevat alleen de regels; posten, knoppen en state staan
// in index.js.
//
// HOOGSTENS DRIE. Met vier actieve leden blijft er dan altijd iemand buiten het verbond — en dat is
// dragend, want bondgenoten mogen elkaar niet duelleren of beroven. Een verbond van vier zou het
// halve spel stilleggen.
//
// AANSLUITEN IS EEN VERZOEK. Een paar sluiten gaat zoals altijd direct. Maar wie zich bij een
// bestaand verbond wil voegen, vraagt dat aan; één van de huidige leden moet binnen 24 uur
// accepteren. Een verbond deelt ook de val (een ban sleept iedereen mee), dus niemand mag zich
// ongevraagd in andermans verbond dringen.
//
// OPSLAG. Nieuw formaat: { [userId]: [bondgenootIds…] }, altijd symmetrisch. Het oude formaat
// (één id als tekst) wordt bij het lezen omgezet, zodat bestaande paren gewoon blijven staan.
//
// Puur: geen I/O, geen klok. Zie verbond.test.js.

'use strict';

const VERBOND_MAX = 3;
const VERZOEK_GELDIG_MS = 24 * 60 * 60 * 1000;

// Leest beide formaten en geeft de verbonden als lijst van groepen (gesorteerde id-lijsten van
// minstens twee). Overlappende vermeldingen worden samengevoegd, zodat een half weggeschreven
// bestand nooit twee verbonden voor één lid oplevert.
function groepen(raw) {
  const ouder = new Map();
  const vind = (x) => { while (ouder.get(x) !== x) { ouder.set(x, ouder.get(ouder.get(x))); x = ouder.get(x); } return x; };
  const voeg = (a, b) => {
    for (const x of [a, b]) if (!ouder.has(x)) ouder.set(x, x);
    ouder.set(vind(a), vind(b));
  };
  for (const [id, waarde] of Object.entries(raw || {})) {
    const anderen = Array.isArray(waarde) ? waarde : (waarde ? [waarde] : []);
    for (const ander of anderen) if (typeof ander === 'string' && ander && ander !== id) voeg(id, ander);
  }
  const perWortel = new Map();
  for (const id of ouder.keys()) {
    const w = vind(id);
    if (!perWortel.has(w)) perWortel.set(w, []);
    perWortel.get(w).push(id);
  }
  return [...perWortel.values()].filter(g => g.length >= 2).map(g => g.sort());
}

// Van groepen terug naar het opslagformaat.
function naarOpslag(lijst) {
  const uit = {};
  for (const g of lijst) {
    if (g.length < 2) continue;
    for (const id of g) uit[id] = g.filter(x => x !== id);
  }
  return uit;
}

function groepVan(raw, id) {
  return groepen(raw).find(g => g.includes(id)) || null;
}

function bondgenotenVan(raw, id) {
  const g = groepVan(raw, id);
  return g ? g.filter(x => x !== id) : [];
}

// `id` verlaat zijn verbond. Blijven er twee of meer over, dan blijft dat verbond bestaan; blijft
// er één over, dan is het opgeheven.
function verlaat(raw, id) {
  return naarOpslag(groepen(raw).map(g => g.filter(x => x !== id)));
}

// Een nieuw paar: beide partijen verlaten eerst hun eigen verbond (zoals het altijd ging).
function sluitPaar(raw, a, b) {
  const rest = groepen(verlaat(verlaat(raw, a), b));
  return naarOpslag([...rest, [a, b].sort()]);
}

// Wat betekent "alliantie [naam]" van `vanId` richting `doelId`?
//   zelf          — met uzelf
//   al_verbonden  — u zit al in hetzelfde verbond
//   vol           — het verbond van het doelwit heeft al het maximum
//   verzoek       — het doelwit zit in een verbond met ruimte: aansluiten moet geaccepteerd worden
//   paar          — het doelwit heeft geen verbond: er ontstaat direct een nieuw paar
function beoordeelVerbond(raw, vanId, doelId, max = VERBOND_MAX) {
  if (vanId === doelId) return { soort: 'zelf' };
  const doelGroep = groepVan(raw, doelId);
  if (doelGroep && doelGroep.includes(vanId)) return { soort: 'al_verbonden', groep: doelGroep };
  if (doelGroep) {
    if (doelGroep.length >= max) return { soort: 'vol', groep: doelGroep };
    return { soort: 'verzoek', groep: doelGroep };
  }
  return { soort: 'paar' };
}

// Mag `klikkerId` dit verzoek nu beantwoorden, en kan het nog? `doelId` is het lid dat de aanvrager
// noemde; het verbond is wat dat lid NU heeft, niet wat het had toen het verzoek werd gedaan.
function toetsVerzoek(verzoek, raw, klikkerId, nu, max = VERBOND_MAX) {
  if (!verzoek) return { ok: false, reden: 'onbekend' };
  if (verzoek.gesloten) return { ok: false, reden: 'gesloten' };
  if (nu - verzoek.ts > VERZOEK_GELDIG_MS) return { ok: false, reden: 'verlopen' };
  const groep = groepVan(raw, verzoek.doelId);
  if (!groep) return { ok: false, reden: 'opgeheven' };
  if (!groep.includes(klikkerId)) return { ok: false, reden: 'niet_lid' };
  if (groep.includes(verzoek.vanId)) return { ok: false, reden: 'al_verbonden' };
  if (groep.length >= max) return { ok: false, reden: 'vol' };
  return { ok: true, groep };
}

// Voer een geaccepteerd verzoek uit: de aanvrager verlaat zijn eigen verbond en sluit aan.
function sluitAan(raw, vanId, doelId) {
  const zonder = verlaat(raw, vanId);
  const lijst = groepen(zonder);
  const i = lijst.findIndex(g => g.includes(doelId));
  if (i < 0) return zonder;
  lijst[i] = [...lijst[i], vanId].sort();
  return naarOpslag(lijst);
}

// Eén willekeurige uit `kandidaten` (worp 0 ≤ w < 1), of null.
function kiesEen(kandidaten, worp) {
  if (!kandidaten.length) return null;
  return kandidaten[Math.min(kandidaten.length - 1, Math.floor(worp * kandidaten.length))];
}

// Namen als "A", "A en B" of "A, B en C".
function namenLijst(namen) {
  if (namen.length <= 1) return namen.join('');
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`;
}

module.exports = {
  VERBOND_MAX, VERZOEK_GELDIG_MS,
  groepen, naarOpslag, groepVan, bondgenotenVan, verlaat, sluitPaar,
  beoordeelVerbond, toetsVerzoek, sluitAan, kiesEen, namenLijst,
};
