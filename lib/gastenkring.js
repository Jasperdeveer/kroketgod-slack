// ── De gastenkring: persona's weten van elkaar ─────────────────────────────────
// Elke gast (persona) krijgt in zijn prompt te zien wie er nog meer in het kanaal rondloopt, elk
// met één zin uit het eigen profiel. Zo kan Benito de weekvijand bij naam noemen en weet Alex Soze
// dat er een Tante Truus is (verzoek van de eigenaar, oktober 2026).
//
// Heel soms reageert een gast INHOUDELIJK op een andere: na een bericht van een gast een kleine
// kans dat een ander erop ingaat. Nooit door in een keten — een antwoord op een antwoord komt er
// niet — en in het hele kanaal hoogstens eens per ONDERLING_COOLDOWN_MS, zodat het iets blijft
// om op te kijken en geen persona-ruis wordt.
//
// Puur: geen I/O, op de meegegeven `rng` na. Zie gastenkring.test.js.

'use strict';

const { AFKORTING_VOOR_PUNT } = require('./tekst.js');

const ONDERLING_KANS = 0.07;
const ONDERLING_COOLDOWN_MS = 3 * 3_600_000;
const ANDEREN_MAX = 6;
const SCHETS_MAX = 160;

// Eén zin over een gast, uit de eerste echte alinea van zijn profiel: geen kopjes, geen opmaak,
// geen "Jij bent" vooraan (de schets gaat over iemand anders). Hoofdletterzinnen worden eerst
// door de aanroeper omgezet (ontschreeuw), anders schreeuwt het lijstje.
function schetsVan(profiel) {
  const alinea = String(profiel ?? '')
    .split(/\n\s*\n/)
    .map(a => a.split('\n').filter(r => !/^\s*(#|\/\/|━|=)/.test(r)).join(' '))
    .map(a => a.replace(/[*_>#`]/g, '').replace(/\s+/g, ' ').trim())
    .find(a => a.length >= 30 && !/:$/.test(a)) || '';
  const kern = alinea.replace(/^jij bent\s+/i, '');
  // De eerste zinsgrens die geen afkorting of initiaal is ("Mr. Satébal", "Donald J. Trump").
  let zin = kern;
  for (const m of kern.matchAll(/[.!?](?=\s)/g)) {
    const ervoor = kern.slice(0, m.index + 1);
    if (m[0] === '.' && (AFKORTING_VOOR_PUNT.test(ervoor) || /(?:^|[\s(])\p{Lu}\.$/u.test(ervoor))) continue;
    zin = kern.slice(0, m.index + 1);
    break;
  }
  return zin.length > SCHETS_MAX ? `${zin.slice(0, SCHETS_MAX - 1).replace(/\s+\S*$/, '')}…` : zin;
}

// De andere gasten voor in de prompt van `naam`: actief, niet hijzelf, niet een gerichte persona
// (die hoort bij één lid). Hoogstens ANDEREN_MAX.
function andereGasten(personas, naam) {
  return Object.values(personas || {})
    .filter(p => p?.naam && p.naam !== naam && p.actief !== false && !p.alleenVoorLid)
    .slice(0, ANDEREN_MAX);
}

// Wie mag reageren op een bericht van `sprekerNaam`? Iemand die ongevraagd mag invallen, niet
// gericht is, niet de spreker zelf, en niet in zijn eigen cooldown zit (`inCooldown(id)`).
function kandidatenVoorOnderling(personas, sprekerNaam, inCooldown = () => false) {
  return Object.entries(personas || {})
    .filter(([id, p]) => p?.naam && p.naam !== sprekerNaam && p.actief !== false && p.ongevraagd
      && !p.alleenVoorLid && !inCooldown(id));
}

// Valt de worp, en is de kanaalbrede rem verstreken? Geeft dan één kandidaat terug, anders null.
function kiesAntwoorder(kandidaten, { laatste = 0, nu, kans = ONDERLING_KANS, cooldownMs = ONDERLING_COOLDOWN_MS, rng = Math.random }) {
  if (!kandidaten.length || nu - laatste < cooldownMs) return null;
  if (rng() >= kans) return null;
  return kandidaten[Math.floor(rng() * kandidaten.length) % kandidaten.length];
}

module.exports = {
  ONDERLING_KANS, ONDERLING_COOLDOWN_MS, ANDEREN_MAX, SCHETS_MAX,
  schetsVan, andereGasten, kandidatenVoorOnderling, kiesAntwoorder,
};
